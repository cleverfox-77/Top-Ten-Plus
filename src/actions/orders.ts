'use server'

import { and, desc, eq, gt, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { orders, orderItems, customers, users } from '@/db/schema'
import { requireAuth } from '@/lib/session'
import { run } from '@/lib/result'
import { hydrate, createOrderCore, recordPaymentCore } from '@/lib/order-core'
import type { Order, OrderStatus, GarmentType, OrderFilters } from '@/lib/types'

export async function getOrder(id: number) {
  return run<Order | undefined>(async () => {
    await requireAuth()
    return hydrate(id)
  })
}

export async function createOrder(input: unknown) {
  return run<Order>(async () => {
    const user = await requireAuth()
    return createOrderCore(user.id, input)
  })
}

export async function listOrders(filters: OrderFilters = {}) {
  return run<Order[]>(async () => {
    await requireAuth()
    const conds = []
    if (filters.from) conds.push(gte(orders.order_date, filters.from))
    if (filters.to) conds.push(lte(orders.order_date, filters.to))
    if (filters.customerId) conds.push(eq(orders.customer_id, filters.customerId))
    if (filters.status) conds.push(eq(orders.status, filters.status))
    if (filters.createdBy) conds.push(eq(orders.created_by, filters.createdBy))
    if (filters.paymentStatus === 'paid') conds.push(lte(orders.due_amount, 0))
    if (filters.paymentStatus === 'due') conds.push(gt(orders.due_amount, 0))
    if (filters.garmentType) {
      conds.push(
        inArray(
          orders.id,
          db
            .select({ id: orderItems.order_id })
            .from(orderItems)
            .where(eq(orderItems.garment_type, filters.garmentType as GarmentType))
        )
      )
    }
    if (filters.search && filters.search.trim()) {
      const q = `%${filters.search.trim()}%`
      const asId = Number(filters.search.trim())
      const clauses = [ilike(customers.name, q), ilike(customers.phone, q)]
      if (Number.isInteger(asId)) clauses.push(eq(orders.id, asId))
      conds.push(or(...clauses)!)
    }

    const rows = (await db
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
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(orders.id))
      .limit(500)) as (Order & { item_summary?: string })[]

    if (rows.length) {
      const ids = rows.map((r) => r.id)
      const summary = await db
        .select({
          order_id: orderItems.order_id,
          garment_type: orderItems.garment_type,
          c: sql<number>`count(*)::int`
        })
        .from(orderItems)
        .where(inArray(orderItems.order_id, ids))
        .groupBy(orderItems.order_id, orderItems.garment_type)
      const byOrder = new Map<number, string[]>()
      for (const s of summary) {
        const arr = byOrder.get(s.order_id) ?? []
        arr.push(`${s.c}× ${s.garment_type}`)
        byOrder.set(s.order_id, arr)
      }
      for (const r of rows) r.item_summary = (byOrder.get(r.id) ?? []).join(', ')
    }
    return rows
  })
}

export async function updateOrderStatus(id: number, status: OrderStatus) {
  return run<Order>(async () => {
    await requireAuth()
    const [row] = await db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, id))
      .returning({ id: orders.id })
    if (!row) throw new Error('Order not found')
    return (await hydrate(id))!
  })
}

/** Record one or more payments received against an order's balance (§5). */
export async function recordPayment(input: unknown) {
  return run<Order>(async () => {
    const user = await requireAuth()
    return recordPaymentCore(user.id, input)
  })
}
