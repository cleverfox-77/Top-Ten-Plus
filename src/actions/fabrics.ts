'use server'

import { and, desc, eq, gte, ilike, lte, or, ne, sql, gt } from 'drizzle-orm'
import { db } from '@/db'
import { fabrics, stockMovements, suppliers, users } from '@/db/schema'
import { requireAuth, requireAdmin } from '@/lib/session'
import { fabricSchema, receiveStockSchema, returnStockSchema } from '@/lib/validation'
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
        .where(or(ilike(fabrics.product_id, q), ilike(fabrics.name, q), ilike(fabrics.color, q)))
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

/** Exact barcode / product-id lookup (for scanners & product search). */
export async function findByBarcode(code: string) {
  return run<Fabric | undefined>(async () => {
    await requireAuth()
    const q = code.trim()
    if (!q) return undefined
    const [row] = await db
      .select()
      .from(fabrics)
      .where(ilike(fabrics.product_id, q))
      .limit(1)
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
        await tx.insert(stockMovements).values({
          fabric_id: row.id,
          change_amount: baseQty,
          reason: 'new_stock',
          supplier_id: data.supplier_id ?? null,
          challan_number: data.challan_number ?? null,
          unit_cost: data.cost_price_per_unit ?? null,
          payment_type: data.payment_type ?? null,
          created_by: admin.id
        })
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

/** Receive stock (add) with full receiving details — supplier, challan, cost, cash/due. */
export async function receiveStock(input: unknown) {
  return run<Fabric>(async () => {
    const admin = await requireAdmin()
    const data = receiveStockSchema.parse(input)
    const change = toBase(data.quantity, data.unit)
    return db.transaction(async (tx) => {
      const [fabric] = await tx.select().from(fabrics).where(eq(fabrics.id, data.fabric_id)).limit(1)
      if (!fabric) throw new Error('Fabric not found')

      const patch: Record<string, unknown> = { quantity_base: sql`${fabrics.quantity_base} + ${change}` }
      if (data.selling_price_per_unit != null) patch.selling_price_per_unit = data.selling_price_per_unit
      if (data.unit_cost != null) patch.cost_price_per_unit = data.unit_cost

      const [row] = await tx.update(fabrics).set(patch).where(eq(fabrics.id, data.fabric_id)).returning()
      await tx.insert(stockMovements).values({
        fabric_id: data.fabric_id,
        change_amount: change,
        reason: 'new_stock',
        supplier_id: data.supplier_id ?? null,
        challan_number: data.challan_number ?? null,
        unit_cost: data.unit_cost ?? null,
        payment_type: data.payment_type ?? null,
        created_by: admin.id
      })
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

/** Record a product return — adds the quantity back to stock and logs it. */
export async function recordReturn(input: unknown) {
  return run<Fabric>(async () => {
    const user = await requireAuth()
    const data = returnStockSchema.parse(input)
    const change = toBase(data.quantity, data.unit)
    return db.transaction(async (tx) => {
      const [fabric] = await tx.select().from(fabrics).where(eq(fabrics.id, data.fabric_id)).limit(1)
      if (!fabric) throw new Error('Fabric not found')
      const [row] = await tx
        .update(fabrics)
        .set({ quantity_base: sql`${fabrics.quantity_base} + ${change}` })
        .where(eq(fabrics.id, data.fabric_id))
        .returning()
      await tx.insert(stockMovements).values({
        fabric_id: data.fabric_id,
        change_amount: change,
        reason: 'return',
        note: data.note ?? null,
        created_by: user.id
      })
      return row
    })
  })
}

const movementCols = {
  id: stockMovements.id,
  fabric_id: stockMovements.fabric_id,
  fabric_name: fabrics.name,
  fabric_unit: fabrics.unit,
  change_amount: stockMovements.change_amount,
  reason: stockMovements.reason,
  reference_order_id: stockMovements.reference_order_id,
  supplier_id: stockMovements.supplier_id,
  supplier_name: suppliers.name,
  challan_number: stockMovements.challan_number,
  unit_cost: stockMovements.unit_cost,
  payment_type: stockMovements.payment_type,
  note: stockMovements.note,
  created_by: stockMovements.created_by,
  created_at: stockMovements.created_at,
  created_by_name: users.name
}

export async function fabricMovements(fabricId: number) {
  return run<StockMovement[]>(async () => {
    await requireAuth()
    return db
      .select(movementCols)
      .from(stockMovements)
      .innerJoin(fabrics, eq(fabrics.id, stockMovements.fabric_id))
      .innerJoin(users, eq(users.id, stockMovements.created_by))
      .leftJoin(suppliers, eq(suppliers.id, stockMovements.supplier_id))
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
    if (filters.supplierId) conds.push(eq(stockMovements.supplier_id, filters.supplierId))
    if (filters.reason) conds.push(eq(stockMovements.reason, filters.reason))
    return db
      .select(movementCols)
      .from(stockMovements)
      .innerJoin(fabrics, eq(fabrics.id, stockMovements.fabric_id))
      .innerJoin(users, eq(users.id, stockMovements.created_by))
      .leftJoin(suppliers, eq(suppliers.id, stockMovements.supplier_id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(stockMovements.id))
      .limit(1000)
  })
}
