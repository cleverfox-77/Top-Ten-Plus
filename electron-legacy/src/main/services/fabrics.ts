import { getDb } from '../db/database'
import { requireAuth, requireAdmin } from '../session'
import { fabricSchema } from '../../shared/validation'
import { toBase } from '../../shared/units'
import type { Fabric, FabricUnit, StockMovement } from '../../shared/types'

export function listFabrics(search?: string): Fabric[] {
  requireAuth()
  const db = getDb()
  if (search && search.trim()) {
    const q = `%${search.trim()}%`
    return db
      .prepare(
        `SELECT * FROM fabrics
         WHERE product_id LIKE ? OR name LIKE ? OR color LIKE ?
         ORDER BY name COLLATE NOCASE`
      )
      .all(q, q, q) as Fabric[]
  }
  return db.prepare('SELECT * FROM fabrics ORDER BY name COLLATE NOCASE').all() as Fabric[]
}

export function getFabric(id: number): Fabric | undefined {
  requireAuth()
  return getDb().prepare('SELECT * FROM fabrics WHERE id = ?').get(id) as Fabric | undefined
}

export function lowStockFabrics(): Fabric[] {
  requireAuth()
  return getDb()
    .prepare(
      'SELECT * FROM fabrics WHERE low_stock_threshold > 0 AND quantity_base <= low_stock_threshold ORDER BY name'
    )
    .all() as Fabric[]
}

export function createFabric(input: unknown): Fabric {
  const admin = requireAdmin()
  const data = fabricSchema.parse(input)
  const db = getDb()

  const dupe = db.prepare('SELECT id FROM fabrics WHERE product_id = ?').get(data.product_id)
  if (dupe) throw new Error(`Product ID / barcode "${data.product_id}" already exists`)

  const baseQty = toBase(data.quantity, data.unit)
  const baseLow = toBase(data.low_stock_threshold ?? 0, data.unit)

  const tx = db.transaction(() => {
    const res = db
      .prepare(
        `INSERT INTO fabrics (product_id, name, color, unit, quantity_base, cost_price_per_unit, low_stock_threshold)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.product_id,
        data.name,
        data.color ?? null,
        data.unit,
        baseQty,
        data.cost_price_per_unit ?? null,
        baseLow
      )
    const fabricId = Number(res.lastInsertRowid)
    if (baseQty > 0) {
      db.prepare(
        `INSERT INTO stock_movements (fabric_id, change_amount, reason, created_by)
         VALUES (?, ?, 'new_stock', ?)`
      ).run(fabricId, baseQty, admin.id)
    }
    return fabricId
  })

  return getFabric(tx())!
}

/** Update fabric metadata only. Quantity changes go through addStock/correctStock. */
export function updateFabric(id: number, input: unknown): Fabric {
  requireAdmin()
  const data = fabricSchema.parse(input)
  const db = getDb()
  const clash = db
    .prepare('SELECT id FROM fabrics WHERE product_id = ? AND id <> ?')
    .get(data.product_id, id) as { id: number } | undefined
  if (clash) throw new Error(`Another fabric already uses product ID "${data.product_id}"`)

  const baseLow = toBase(data.low_stock_threshold ?? 0, data.unit)
  db.prepare(
    `UPDATE fabrics SET product_id = ?, name = ?, color = ?, unit = ?, cost_price_per_unit = ?, low_stock_threshold = ?
     WHERE id = ?`
  ).run(
    data.product_id,
    data.name,
    data.color ?? null,
    data.unit,
    data.cost_price_per_unit ?? null,
    baseLow,
    id
  )
  return getFabric(id)!
}

/** Add new stock (positive), recorded as a 'new_stock' movement. */
export function addStock(id: number, quantity: number, unit: FabricUnit): Fabric {
  const admin = requireAdmin()
  if (quantity <= 0) throw new Error('Quantity to add must be greater than zero')
  const db = getDb()
  const fabric = getFabric(id)
  if (!fabric) throw new Error('Fabric not found')

  const change = toBase(quantity, unit)
  const tx = db.transaction(() => {
    db.prepare('UPDATE fabrics SET quantity_base = quantity_base + ? WHERE id = ?').run(change, id)
    db.prepare(
      `INSERT INTO stock_movements (fabric_id, change_amount, reason, created_by)
       VALUES (?, ?, 'new_stock', ?)`
    ).run(id, change, admin.id)
  })
  tx()
  return getFabric(id)!
}

/** Correct stock to an absolute target value, recorded as a 'correction' movement. */
export function correctStock(id: number, targetQuantity: number, unit: FabricUnit): Fabric {
  const admin = requireAdmin()
  if (targetQuantity < 0) throw new Error('Target quantity cannot be negative')
  const db = getDb()
  const fabric = getFabric(id)
  if (!fabric) throw new Error('Fabric not found')

  const target = toBase(targetQuantity, unit)
  const change = target - fabric.quantity_base
  const tx = db.transaction(() => {
    db.prepare('UPDATE fabrics SET quantity_base = ? WHERE id = ?').run(target, id)
    db.prepare(
      `INSERT INTO stock_movements (fabric_id, change_amount, reason, created_by)
       VALUES (?, ?, 'correction', ?)`
    ).run(id, change, admin.id)
  })
  tx()
  return getFabric(id)!
}

export function fabricMovements(fabricId: number): StockMovement[] {
  requireAuth()
  return getDb()
    .prepare(
      `SELECT sm.*, u.name AS created_by_name
       FROM stock_movements sm
       JOIN users u ON u.id = sm.created_by
       WHERE sm.fabric_id = ?
       ORDER BY sm.id DESC`
    )
    .all(fabricId) as StockMovement[]
}
