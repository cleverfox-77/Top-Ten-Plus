'use server'

import { and, desc, eq, ilike, or, ne, sql } from 'drizzle-orm'
import { db } from '@/db'
import { customers, orders, orderItems } from '@/db/schema'
import { requireAuth } from '@/lib/session'
import { customerSchema } from '@/lib/validation'
import { run } from '@/lib/result'
import type { Customer, GarmentType } from '@/lib/types'

export async function listCustomers(search?: string) {
  return run<Customer[]>(async () => {
    await requireAuth()
    if (search && search.trim()) {
      const q = `%${search.trim()}%`
      return db
        .select()
        .from(customers)
        .where(or(ilike(customers.name, q), ilike(customers.phone, q)))
        .orderBy(customers.name)
    }
    return db.select().from(customers).orderBy(customers.name)
  })
}

export async function getCustomer(id: number) {
  return run<Customer | undefined>(async () => {
    await requireAuth()
    const [row] = await db.select().from(customers).where(eq(customers.id, id)).limit(1)
    return row
  })
}

export async function createCustomer(input: unknown) {
  return run<Customer>(async () => {
    await requireAuth()
    const data = customerSchema.parse(input)
    const [existing] = await db
      .select()
      .from(customers)
      .where(eq(customers.phone, data.phone))
      .limit(1)
    if (existing) throw new Error(`A customer with phone ${data.phone} already exists`)

    const [row] = await db
      .insert(customers)
      .values({
        name: data.name,
        phone: data.phone,
        address: data.address ?? null,
        notes: data.notes ?? null
      })
      .returning()
    return row
  })
}

export async function updateCustomer(id: number, input: unknown) {
  return run<Customer>(async () => {
    await requireAuth()
    const data = customerSchema.parse(input)
    const [clash] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.phone, data.phone), ne(customers.id, id)))
      .limit(1)
    if (clash) throw new Error(`Another customer already uses phone ${data.phone}`)

    const [row] = await db
      .update(customers)
      .set({
        name: data.name,
        phone: data.phone,
        address: data.address ?? null,
        notes: data.notes ?? null
      })
      .where(eq(customers.id, id))
      .returning()
    return row
  })
}

// Repeat-customer helper (plan §4): the most recent measurements this customer
// had for a given garment type, so staff can prefill instead of re-measuring.
export async function getLastMeasurements(customerId: number, garmentType: GarmentType) {
  return run<Record<string, unknown> | null>(async () => {
    await requireAuth()
    const [row] = await db
      .select({ m: orderItems.measurements })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.order_id))
      .where(and(eq(orders.customer_id, customerId), eq(orderItems.garment_type, garmentType)))
      .orderBy(desc(orders.order_date), desc(orders.id))
      .limit(1)
    return row?.m ?? null
  })
}
