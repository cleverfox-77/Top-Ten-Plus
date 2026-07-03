import { getDb } from '../db/database'
import { requireAuth } from '../session'
import { customerSchema } from '../../shared/validation'
import type { Customer, GarmentType } from '../../shared/types'

export function listCustomers(search?: string): Customer[] {
  requireAuth()
  const db = getDb()
  if (search && search.trim()) {
    const q = `%${search.trim()}%`
    return db
      .prepare(
        'SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name COLLATE NOCASE'
      )
      .all(q, q) as Customer[]
  }
  return db.prepare('SELECT * FROM customers ORDER BY name COLLATE NOCASE').all() as Customer[]
}

export function getCustomer(id: number): Customer | undefined {
  requireAuth()
  return getDb().prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer | undefined
}

export function createCustomer(input: unknown): Customer {
  requireAuth()
  const data = customerSchema.parse(input)
  const db = getDb()
  const existing = db.prepare('SELECT * FROM customers WHERE phone = ?').get(data.phone) as
    | Customer
    | undefined
  if (existing) throw new Error(`A customer with phone ${data.phone} already exists`)

  const res = db
    .prepare('INSERT INTO customers (name, phone, address, notes) VALUES (?, ?, ?, ?)')
    .run(data.name, data.phone, data.address ?? null, data.notes ?? null)
  return getCustomer(Number(res.lastInsertRowid))!
}

export function updateCustomer(id: number, input: unknown): Customer {
  requireAuth()
  const data = customerSchema.parse(input)
  const db = getDb()
  const clash = db
    .prepare('SELECT id FROM customers WHERE phone = ? AND id <> ?')
    .get(data.phone, id) as { id: number } | undefined
  if (clash) throw new Error(`Another customer already uses phone ${data.phone}`)

  db.prepare('UPDATE customers SET name = ?, phone = ?, address = ?, notes = ? WHERE id = ?').run(
    data.name,
    data.phone,
    data.address ?? null,
    data.notes ?? null,
    id
  )
  return getCustomer(id)!
}

/**
 * Repeat-customer helper (plan §4): the most recent measurements this customer
 * had recorded for a given garment type, so staff can prefill instead of
 * re-measuring from scratch.
 */
export function getLastMeasurements(
  customerId: number,
  garmentType: GarmentType
): Record<string, unknown> | null {
  requireAuth()
  const row = getDb()
    .prepare(
      `SELECT oi.measurements AS m
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.customer_id = ? AND oi.garment_type = ?
       ORDER BY o.order_date DESC, o.id DESC
       LIMIT 1`
    )
    .get(customerId, garmentType) as { m: string } | undefined
  if (!row) return null
  try {
    return JSON.parse(row.m)
  } catch {
    return null
  }
}
