import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  orders,
  orderItems,
  fabrics,
  stockMovements,
  smsLog,
  payments,
  customers,
  users
} from '@/db/schema'
import { newOrderSchema, recordPaymentSchema } from '@/lib/validation'
import { toBase, round2 } from '@/lib/units'
import { GATEWAY_ENABLED, buildConfirmationMessage } from '@/lib/sms-util'
import type { Order, OrderItem, Payment } from '@/lib/types'

/** Load a full order with joined customer/staff names, items and payments. */
export async function hydrate(orderId: number): Promise<Order | undefined> {
  const [order] = await db
    .select({
      id: orders.id,
      customer_id: orders.customer_id,
      order_date: orders.order_date,
      expected_delivery_date: orders.expected_delivery_date,
      status: orders.status,
      payment_method: orders.payment_method,
      total_price: orders.total_price,
      discount: orders.discount,
      amount_paid: orders.amount_paid,
      due_amount: orders.due_amount,
      due_date: orders.due_date,
      delivery_code: orders.delivery_code,
      created_by: orders.created_by,
      created_at: orders.created_at,
      customer_name: customers.name,
      customer_phone: customers.phone,
      created_by_name: users.name
    })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customer_id))
    .innerJoin(users, eq(users.id, orders.created_by))
    .where(eq(orders.id, orderId))
    .limit(1)
  if (!order) return undefined

  const items = (await db
    .select({
      id: orderItems.id,
      order_id: orderItems.order_id,
      garment_type: orderItems.garment_type,
      measurements: orderItems.measurements,
      style_options: orderItems.style_options,
      fabric_id: orderItems.fabric_id,
      fabric_quantity_used: orderItems.fabric_quantity_used,
      fabric_unit: orderItems.fabric_unit,
      price: orderItems.price,
      fabric_name: fabrics.name
    })
    .from(orderItems)
    .leftJoin(fabrics, eq(fabrics.id, orderItems.fabric_id))
    .where(eq(orderItems.order_id, orderId))
    .orderBy(orderItems.id)) as OrderItem[]

  const paymentRows = (await db
    .select({
      id: payments.id,
      order_id: payments.order_id,
      amount: payments.amount,
      method: payments.method,
      created_by: payments.created_by,
      created_at: payments.created_at,
      created_by_name: users.name
    })
    .from(payments)
    .innerJoin(users, eq(users.id, payments.created_by))
    .where(eq(payments.order_id, orderId))
    .orderBy(payments.id)) as Payment[]

  return { ...order, items, payments: paymentRows }
}

/**
 * Core order-creation logic (plan §3, §5, §6, §9): validate, then in a single
 * transaction insert the order + items, record the initial payment(s) — which
 * may be split across cash + card/MFS — deduct fabric stock with an audit
 * movement, and log the confirmation SMS.
 */
export async function createOrderCore(userId: number, input: unknown): Promise<Order> {
  const data = newOrderSchema.parse(input)

  const subtotal = round2(data.items.reduce((s, it) => s + it.price, 0))
  const discount = round2(Math.min(Math.max(0, data.discount), subtotal))
  const totalPrice = round2(subtotal - discount)
  const paidLines = data.payments.filter((p) => p.amount > 0)
  const amountPaid = round2(paidLines.reduce((s, p) => s + p.amount, 0))
  const dueAmount = round2(Math.max(0, totalPrice - amountPaid))
  const primaryMethod = paidLines[0]?.method ?? 'cash'
  // Random 6-digit delivery code — printed on the invoice and job card so the
  // shop can match the customer's copy against the garment at handover.
  const deliveryCode = String(Math.floor(100000 + Math.random() * 900000))

  const newId = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        customer_id: data.customer_id,
        expected_delivery_date: data.expected_delivery_date,
        status: data.status,
        payment_method: primaryMethod,
        total_price: totalPrice,
        discount,
        amount_paid: amountPaid,
        due_amount: dueAmount,
        due_date: data.due_date,
        delivery_code: deliveryCode,
        created_by: userId
      })
      .returning({ id: orders.id })

    const orderId = order.id

    for (const p of paidLines) {
      await tx
        .insert(payments)
        .values({ order_id: orderId, amount: round2(p.amount), method: p.method, created_by: userId })
    }

    for (const it of data.items) {
      await tx.insert(orderItems).values({
        order_id: orderId,
        garment_type: it.garment_type,
        measurements: it.measurements ?? {},
        style_options: it.style_options ?? {},
        fabric_id: it.fabric_id,
        fabric_quantity_used: it.fabric_quantity_used,
        fabric_unit: it.fabric_id ? it.fabric_unit : null,
        price: it.price
      })

      if (it.fabric_id && it.fabric_quantity_used && it.fabric_unit) {
        const [fabric] = await tx
          .select({ name: fabrics.name, quantity_base: fabrics.quantity_base })
          .from(fabrics)
          .where(eq(fabrics.id, it.fabric_id))
          .limit(1)
        if (!fabric) throw new Error('Selected fabric no longer exists')
        const used = toBase(it.fabric_quantity_used, it.fabric_unit)
        if (used > fabric.quantity_base + 1e-6) {
          throw new Error(
            `Not enough "${fabric.name}" in stock for this order. Add stock or reduce the quantity used.`
          )
        }
        await tx
          .update(fabrics)
          .set({ quantity_base: sql`${fabrics.quantity_base} - ${used}` })
          .where(eq(fabrics.id, it.fabric_id))
        await tx.insert(stockMovements).values({
          fabric_id: it.fabric_id,
          change_amount: -used,
          reason: 'order_deduction',
          reference_order_id: orderId,
          created_by: userId
        })
      }
    }

    await tx.insert(smsLog).values({
      customer_id: data.customer_id,
      order_id: orderId,
      message: buildConfirmationMessage(orderId, totalPrice, data.expected_delivery_date),
      type: 'order_confirmation',
      status: GATEWAY_ENABLED ? 'sent' : 'stubbed'
    })

    return orderId
  })

  const created = await hydrate(newId)
  if (!created) throw new Error('Order created but could not be loaded')
  return created
}

/**
 * Record one or more payments received later against an order's balance
 * (plan §5 advance/due). Supports splitting across cash + card/MFS.
 */
export async function recordPaymentCore(userId: number, input: unknown): Promise<Order> {
  const data = recordPaymentSchema.parse(input)
  const lines = data.payments.filter((p) => p.amount > 0)
  if (lines.length === 0) throw new Error('Enter a payment amount greater than zero')

  await db.transaction(async (tx) => {
    const [order] = await tx
      .select({ total_price: orders.total_price })
      .from(orders)
      .where(eq(orders.id, data.order_id))
      .limit(1)
    if (!order) throw new Error('Order not found')

    for (const p of lines) {
      await tx.insert(payments).values({
        order_id: data.order_id,
        amount: round2(p.amount),
        method: p.method,
        created_by: userId
      })
    }

    const [{ paid }] = await tx
      .select({ paid: sql<number>`coalesce(sum(${payments.amount}),0)::float8` })
      .from(payments)
      .where(eq(payments.order_id, data.order_id))
    const amountPaid = round2(Number(paid))
    const due = round2(Math.max(0, order.total_price - amountPaid))

    await tx
      .update(orders)
      .set({ amount_paid: amountPaid, due_amount: due })
      .where(eq(orders.id, data.order_id))
  })

  const updated = await hydrate(data.order_id)
  if (!updated) throw new Error('Order not found')
  return updated
}
