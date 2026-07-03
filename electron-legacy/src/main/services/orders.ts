import { getDb } from '../db/database'
import { requireAuth } from '../session'
import { newOrderSchema } from '../../shared/validation'
import { toBase, round2 } from '../../shared/units'
import { logOrderConfirmation } from './sms'
import type { Order, OrderItem, OrderStatus } from '../../shared/types'

export interface OrderFilters {
  from?: string | null
  to?: string | null
  customerId?: number | null
  garmentType?: string | null
  paymentStatus?: 'paid' | 'due' | null
  status?: OrderStatus | null
  createdBy?: number | null
  search?: string | null
}

function hydrateItems(orderId: number): OrderItem[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT oi.*, f.name AS fabric_name
       FROM order_items oi
       LEFT JOIN fabrics f ON f.id = oi.fabric_id
       WHERE oi.order_id = ?
       ORDER BY oi.id`
    )
    .all(orderId) as (Omit<OrderItem, 'measurements' | 'style_options'> & {
    measurements: string
    style_options: string
  })[]
  return rows.map((r) => ({
    ...r,
    measurements: safeJson(r.measurements),
    style_options: safeJson(r.style_options)
  })) as OrderItem[]
}

function safeJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

export function getOrder(id: number): Order | undefined {
  requireAuth()
  const db = getDb()
  const order = db
    .prepare(
      `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, u.name AS created_by_name
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       JOIN users u ON u.id = o.created_by
       WHERE o.id = ?`
    )
    .get(id) as Order | undefined
  if (!order) return undefined
  order.items = hydrateItems(id)
  return order
}

export function createOrder(input: unknown): Order {
  const user = requireAuth()
  const data = newOrderSchema.parse(input)
  const db = getDb()

  const totalPrice = round2(data.items.reduce((sum, it) => sum + it.price, 0))
  const amountPaid = round2(data.amount_paid)
  const dueAmount = round2(Math.max(0, totalPrice - amountPaid))

  const tx = db.transaction(() => {
    const res = db
      .prepare(
        `INSERT INTO orders
         (customer_id, expected_delivery_date, status, payment_method, total_price, amount_paid, due_amount, due_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.customer_id,
        data.expected_delivery_date,
        data.status,
        data.payment_method,
        totalPrice,
        amountPaid,
        dueAmount,
        data.due_date,
        user.id
      )
    const orderId = Number(res.lastInsertRowid)

    const insertItem = db.prepare(
      `INSERT INTO order_items
       (order_id, garment_type, measurements, style_options, fabric_id, fabric_quantity_used, fabric_unit, price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const deductStock = db.prepare(
      'UPDATE fabrics SET quantity_base = quantity_base - ? WHERE id = ?'
    )
    const insertMove = db.prepare(
      `INSERT INTO stock_movements (fabric_id, change_amount, reason, reference_order_id, created_by)
       VALUES (?, ?, 'order_deduction', ?, ?)`
    )

    for (const it of data.items) {
      insertItem.run(
        orderId,
        it.garment_type,
        JSON.stringify(it.measurements ?? {}),
        JSON.stringify(it.style_options ?? {}),
        it.fabric_id,
        it.fabric_quantity_used,
        it.fabric_unit,
        it.price
      )

      // Automatic stock deduction on confirmation (plan §6).
      if (it.fabric_id && it.fabric_quantity_used && it.fabric_unit) {
        const fabric = db
          .prepare('SELECT name, quantity_base FROM fabrics WHERE id = ?')
          .get(it.fabric_id) as { name: string; quantity_base: number } | undefined
        if (!fabric) throw new Error('Selected fabric no longer exists')
        const used = toBase(it.fabric_quantity_used, it.fabric_unit)
        if (used > fabric.quantity_base + 1e-6) {
          throw new Error(
            `Not enough "${fabric.name}" in stock for this order. Add stock or reduce the quantity used.`
          )
        }
        deductStock.run(used, it.fabric_id)
        insertMove.run(it.fabric_id, -used, orderId, user.id)
      }
    }

    // Instant, automatic order-confirmation SMS (plan §9.1) — logged & stubbed.
    logOrderConfirmation(orderId, data.customer_id)

    return orderId
  })

  return getOrder(tx())!
}

export function listOrders(filters: OrderFilters = {}): Order[] {
  requireAuth()
  const db = getDb()
  const where: string[] = []
  const params: unknown[] = []

  if (filters.from) {
    where.push('o.order_date >= ?')
    params.push(filters.from)
  }
  if (filters.to) {
    where.push('o.order_date <= ?')
    params.push(filters.to)
  }
  if (filters.customerId) {
    where.push('o.customer_id = ?')
    params.push(filters.customerId)
  }
  if (filters.status) {
    where.push('o.status = ?')
    params.push(filters.status)
  }
  if (filters.createdBy) {
    where.push('o.created_by = ?')
    params.push(filters.createdBy)
  }
  if (filters.paymentStatus === 'paid') where.push('o.due_amount <= 0')
  if (filters.paymentStatus === 'due') where.push('o.due_amount > 0')
  if (filters.garmentType) {
    where.push('EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.garment_type = ?)')
    params.push(filters.garmentType)
  }
  if (filters.search && filters.search.trim()) {
    where.push('(c.name LIKE ? OR c.phone LIKE ? OR o.id = ?)')
    const q = `%${filters.search.trim()}%`
    params.push(q, q, Number(filters.search.trim()) || -1)
  }

  const sql = `
    SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, u.name AS created_by_name
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    JOIN users u ON u.id = o.created_by
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY o.id DESC
    LIMIT 500`
  const orders = db.prepare(sql).all(...params) as Order[]
  // Attach a lightweight garment-type summary for the list view.
  const summary = db.prepare(
    'SELECT garment_type, COUNT(*) AS c FROM order_items WHERE order_id = ? GROUP BY garment_type'
  )
  for (const o of orders) {
    const rows = summary.all(o.id) as { garment_type: string; c: number }[]
    ;(o as Order & { item_summary?: string }).item_summary = rows
      .map((r) => `${r.c}× ${r.garment_type}`)
      .join(', ')
  }
  return orders
}

export function updateOrderStatus(id: number, status: OrderStatus): Order {
  requireAuth()
  const db = getDb()
  const exists = db.prepare('SELECT id FROM orders WHERE id = ?').get(id)
  if (!exists) throw new Error('Order not found')
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id)
  return getOrder(id)!
}

export function updateOrderPayment(id: number, amountPaid: number): Order {
  requireAuth()
  if (amountPaid < 0) throw new Error('Amount paid cannot be negative')
  const db = getDb()
  const order = db.prepare('SELECT total_price FROM orders WHERE id = ?').get(id) as
    | { total_price: number }
    | undefined
  if (!order) throw new Error('Order not found')
  const paid = round2(amountPaid)
  const due = round2(Math.max(0, order.total_price - paid))
  db.prepare('UPDATE orders SET amount_paid = ?, due_amount = ? WHERE id = ?').run(paid, due, id)
  return getOrder(id)!
}
