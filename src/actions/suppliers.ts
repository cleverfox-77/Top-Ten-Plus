'use server'

import { and, desc, eq, ilike, or } from 'drizzle-orm'
import { db } from '@/db'
import { suppliers, stockMovements, fabrics, users } from '@/db/schema'
import { requireAuth, requireAdmin } from '@/lib/session'
import { supplierSchema } from '@/lib/validation'
import { fromBase, round2 } from '@/lib/units'
import { run } from '@/lib/result'
import type { Supplier, SupplierDetail, StockMovement } from '@/lib/types'

export async function listSuppliers(search?: string) {
  return run<Supplier[]>(async () => {
    await requireAuth()
    if (search && search.trim()) {
      const q = `%${search.trim()}%`
      return db
        .select()
        .from(suppliers)
        .where(or(ilike(suppliers.name, q), ilike(suppliers.phone, q)))
        .orderBy(suppliers.name)
    }
    return db.select().from(suppliers).orderBy(suppliers.name)
  })
}

export async function createSupplier(input: unknown) {
  return run<Supplier>(async () => {
    await requireAuth()
    const data = supplierSchema.parse(input)
    const [row] = await db
      .insert(suppliers)
      .values({
        name: data.name,
        phone: data.phone ?? null,
        address: data.address ?? null,
        notes: data.notes ?? null
      })
      .returning()
    return row
  })
}

export async function updateSupplier(id: number, input: unknown) {
  return run<Supplier>(async () => {
    await requireAdmin()
    const data = supplierSchema.parse(input)
    const [row] = await db
      .update(suppliers)
      .set({
        name: data.name,
        phone: data.phone ?? null,
        address: data.address ?? null,
        notes: data.notes ?? null
      })
      .where(eq(suppliers.id, id))
      .returning()
    return row
  })
}

/** Full supplier profile: what they supplied and the cash vs due totals. */
export async function getSupplierDetail(id: number) {
  return run<SupplierDetail | undefined>(async () => {
    await requireAuth()
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1)
    if (!supplier) return undefined

    const rows = (await db
      .select({
        id: stockMovements.id,
        fabric_id: stockMovements.fabric_id,
        fabric_name: fabrics.name,
        fabric_unit: fabrics.unit,
        change_amount: stockMovements.change_amount,
        reason: stockMovements.reason,
        reference_order_id: stockMovements.reference_order_id,
        supplier_id: stockMovements.supplier_id,
        challan_number: stockMovements.challan_number,
        unit_cost: stockMovements.unit_cost,
        payment_type: stockMovements.payment_type,
        note: stockMovements.note,
        created_by: stockMovements.created_by,
        created_at: stockMovements.created_at,
        created_by_name: users.name
      })
      .from(stockMovements)
      .innerJoin(fabrics, eq(fabrics.id, stockMovements.fabric_id))
      .innerJoin(users, eq(users.id, stockMovements.created_by))
      .where(and(eq(stockMovements.supplier_id, id), eq(stockMovements.reason, 'new_stock')))
      .orderBy(desc(stockMovements.id))) as StockMovement[]

    let cash = 0
    let due = 0
    const byFabric = new Map<number, { fabric_id: number; name: string; receivings: number; qty_base: number }>()
    for (const r of rows) {
      const unit = r.fabric_unit ?? 'gaz'
      const value = (r.unit_cost ?? 0) * fromBase(r.change_amount, unit)
      if (r.payment_type === 'due') due += value
      else cash += value // treat unspecified as cash
      const f = byFabric.get(r.fabric_id) ?? {
        fabric_id: r.fabric_id,
        name: r.fabric_name ?? '',
        receivings: 0,
        qty_base: 0
      }
      f.receivings += 1
      f.qty_base += r.change_amount
      byFabric.set(r.fabric_id, f)
    }

    return {
      ...supplier,
      total_received_value: round2(cash + due),
      cash_total: round2(cash),
      due_total: round2(due),
      fabrics_supplied: [...byFabric.values()],
      receivings: rows
    }
  })
}
