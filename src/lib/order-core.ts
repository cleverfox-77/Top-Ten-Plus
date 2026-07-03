import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { orders, orderItems, fabrics, stockMovements, smsLog, customers, users } from '@/db/schema'
import { newOrderSchema } from '@/lib/validation'
import { toBase, round2 } from '@/lib/units'
import { GATEWAY_ENABLED, buildConfirmationMessage } from '@/lib/sms-util'
import type { Order, OrderItem } from '@/lib/types'

/** Load a full order with joined customer/staff names and its items. */
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
      amount_paid: orders.amount_paid,
      due_amount: orders.due_amount,
      due_date: orders.due_date,
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

  return { ...order, items }
}

/**
 * Core order-creation logic (plan §3, §6, §9): validate, then in a single
 * transaction insert the order + items, deduct fabric stock with an audit
 * movement, and log the confirmation SMS. Separated from the server action so it
 * can be unit-tested against a real database.
 */
export async function createOrderCore(userId: number, input: unknown): Promise<Order> {
  const data = newOrderSchema.parse(input)

  const totalPrice = round2(data.items.reduce((s, it) => s + it.price, 0))
  const amountPaid = round2(data.amount_paid)
  const dueAmount = round2(Math.max(0, totalPrice - amountPaid))

  const newId = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        customer_id: data.customer_id,
        expected_delivery_date: data.expected_delivery_date,
        status: data.status,
        payment_method: data.payment_method,
        total_price: totalPrice,
        amount_paid: amountPaid,
        due_amount: dueAmount,
        due_date: data.due_date,
        created_by: userId
      })
      .returning({ id: orders.id })

    const orderId = order.id

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
