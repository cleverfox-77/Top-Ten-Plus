'use server'

import { and, desc, eq, gte, ilike, lte, or, ne, sql, gt } from 'drizzle-orm'
import { db } from '@/db'
import { fabrics, stockMovements, users } from '@/db/schema'
import { requireAuth, requireAdmin } from '@/lib/session'
import { fabricSchema } from '@/lib/validation'
import { toBase } from '@/lib/units'
import { run } from '@/lib/result'
import type { Fabric, FabricUnit, StockMovement, StockMovementFilters } from '@/lib/types'

export async function listFabrics(search?: string) {
  return run<Fabric[]>(async () => {
    await requireAuth()
    if (search && search.trim()) {
      const q = `%${search.trim()}%`
      return db
        .select()
        .from(fabrics)
        .where(
          or(ilike(fabrics.product_id, q), ilike(fabrics.name, q), ilike(fabrics.color, q))
        )
        .orderBy(fabrics.name)
    }
    return db.select().from(fabrics).orderBy(fabrics.name)
  })
}

export async function getFabric(id: number) {
  return run<Fabric | undefined>(async () => {
    await requireAuth()
    const [row] = await db.select().from(fabrics).where(eq(fabrics.id, id)).limit(1)
    return row
  })
}

export async function lowStockFabrics() {
  return run<Fabric[]>(async () => {
    await requireAuth()
    return db
      .select()
      .from(fabrics)
      .where(and(gt(fabrics.low_stock_threshold, 0), lte(fabrics.quantity_base, fabrics.low_stock_threshold)))
      .orderBy(fabrics.name)
  })
}

export async function createFabric(input: unknown) {
  return run<Fabric>(async () => {
    const admin = await requireAdmin()
    const data = fabricSchema.parse(input)
    const [dupe] = await db
      .select({ id: fabrics.id })
      .from(fabrics)
      .where(eq(fabrics.product_id, data.product_id))
      .limit(1)
    if (dupe) throw new Error(`Product ID / barcode "${data.product_id}" already exists`)

    const baseQty = toBase(data.quantity, data.unit)
    const baseLow = toBase(data.low_stock_threshold ?? 0, data.unit)

    return db.transaction(async (tx) => {
      const [row] = await tx
        .insert(fabrics)
        .values({
          product_id: data.product_id,
          name: data.name,
          color: data.color ?? null,
          unit: data.unit,
          quantity_base: baseQty,
          cost_price_per_unit: data.cost_price_per_unit ?? null,
          selling_price_per_unit: data.selling_price_per_unit ?? null,
          low_stock_threshold: baseLow
        })
        .returning()
      if (baseQty > 0) {
        await tx
          .insert(stockMovements)
          .values({ fabric_id: row.id, change_amount: baseQty, reason: 'new_stock', created_by: admin.id })
      }
      return row
    })
  })
}

export async function updateFabric(id: number, input: unknown) {
  return run<Fabric>(async () => {
    await requireAdmin()
    const data = fabricSchema.parse(input)
    const [clash] = await db
      .select({ id: fabrics.id })
      .from(fabrics)
      .where(and(eq(fabrics.product_id, data.product_id), ne(fabrics.id, id)))
      .limit(1)
    if (clash) throw new Error(`Another fabric already uses product ID "${data.product_id}"`)

    const baseLow = toBase(data.low_stock_threshold ?? 0, data.unit)
    const [row] = await db
      .update(fabrics)
      .set({
        product_id: data.product_id,
        name: data.name,
        color: data.color ?? null,
        unit: data.unit,
        cost_price_per_unit: data.cost_price_per_unit ?? null,
        selling_price_per_unit: data.selling_price_per_unit ?? null,
        low_stock_threshold: baseLow
      })
      .where(eq(fabrics.id, id))
      .returning()
    return row
  })
}

export async function addStock(
  id: number,
  quantity: number,
  unit: FabricUnit,
  sellingPrice?: number | null
) {
  return run<Fabric>(async () => {
    const admin = await requireAdmin()
    if (quantity <= 0) throw new Error('Quantity to add must be greater than zero')
    const change = toBase(quantity, unit)
    return db.transaction(async (tx) => {
      const [fabric] = await tx.select().from(fabrics).where(eq(fabrics.id, id)).limit(1)
      if (!fabric) throw new Error('Fabric not found')
      const patch: Record<string, unknown> = { quantity_base: sql`${fabrics.quantity_base} + ${change}` }
      // Optionally refresh the selling price when restocking.
      if (sellingPrice !== undefined && sellingPrice !== null) {
        patch.selling_price_per_unit = sellingPrice
      }
      const [row] = await tx.update(fabrics).set(patch).where(eq(fabrics.id, id)).returning()
      await tx
        .insert(stockMovements)
        .values({ fabric_id: id, change_amount: change, reason: 'new_stock', created_by: admin.id })
      return row
    })
  })
}

export async function correctStock(id: number, targetQuantity: number, unit: FabricUnit) {
  return run<Fabric>(async () => {
    const admin = await requireAdmin()
    if (targetQuantity < 0) throw new Error('Target quantity cannot be negative')
    const target = toBase(targetQuantity, unit)
    return db.transaction(async (tx) => {
      const [fabric] = await tx.select().from(fabrics).where(eq(fabrics.id, id)).limit(1)
      if (!fabric) throw new Error('Fabric not found')
      const change = target - fabric.quantity_base
      const [row] = await tx
        .update(fabrics)
        .set({ quantity_base: target })
        .where(eq(fabrics.id, id))
        .returning()
      await tx
        .insert(stockMovements)
        .values({ fabric_id: id, change_amount: change, reason: 'correction', created_by: admin.id })
      return row
    })
  })
}

export async function fabricMovements(fabricId: number) {
  return run<StockMovement[]>(async () => {
    await requireAuth()
    return db
      .select({
        id: stockMovements.id,
        fabric_id: stockMovements.fabric_id,
        change_amount: stockMovements.change_amount,
        reason: stockMovements.reason,
        reference_order_id: stockMovements.reference_order_id,
        created_by: stockMovements.created_by,
        created_at: stockMovements.created_at,
        created_by_name: users.name
      })
      .from(stockMovements)
      .innerJoin(users, eq(users.id, stockMovements.created_by))
      .where(eq(stockMovements.fabric_id, fabricId))
      .orderBy(desc(stockMovements.id))
  })
}

/** Full stock movement log across all fabrics (audit trail, plan §12). */
export async function listStockMovements(filters: StockMovementFilters = {}) {
  return run<StockMovement[]>(async () => {
    await requireAuth()
    const conds = []
    if (filters.from) conds.push(gte(stockMovements.created_at, `${filters.from} 00:00:00`))
    if (filters.to) conds.push(lte(stockMovements.created_at, `${filters.to} 23:59:59`))
    if (filters.fabricId) conds.push(eq(stockMovements.fabric_id, filters.fabricId))
    if (filters.reason) conds.push(eq(stockMovements.reason, filters.reason))
    return db
      .select({
        id: stockMovements.id,
        fabric_id: stockMovements.fabric_id,
        fabric_name: fabrics.name,
        fabric_unit: fabrics.unit,
        change_amount: stockMovements.change_amount,
        reason: stockMovements.reason,
        reference_order_id: stockMovements.reference_order_id,
        created_by: stockMovements.created_by,
        created_at: stockMovements.created_at,
        created_by_name: users.name
      })
      .from(stockMovements)
      .innerJoin(fabrics, eq(fabrics.id, stockMovements.fabric_id))
      .innerJoin(users, eq(users.id, stockMovements.created_by))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(stockMovements.id))
      .limit(1000)
  })
}
