import bcrypt from 'bcryptjs'
import { getDb } from './database'
import { toBase } from '../../shared/units'

/** Seed default staff accounts and sample fabric on first run. */
export function seedIfEmpty(): void {
  const db = getDb()
  const userCount = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c

  if (userCount === 0) {
    const insert = db.prepare(
      'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)'
    )
    insert.run('Shop Admin', 'admin', bcrypt.hashSync('admin123', 10), 'admin')
    insert.run('Sales Manager', 'sales', bcrypt.hashSync('sales123', 10), 'sales_manager')
  }

  const fabricCount = (db.prepare('SELECT COUNT(*) AS c FROM fabrics').get() as { c: number }).c
  if (fabricCount === 0) {
    const admin = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get() as
      | { id: number }
      | undefined
    const insertFabric = db.prepare(
      `INSERT INTO fabrics (product_id, name, color, unit, quantity_base, cost_price_per_unit, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    const insertMove = db.prepare(
      `INSERT INTO stock_movements (fabric_id, change_amount, reason, created_by)
       VALUES (?, ?, 'new_stock', ?)`
    )
    const samples = [
      { pid: 'FB-1001', name: 'Wool Blend Suiting', color: 'Charcoal', unit: 'gaz' as const, qty: 40, cost: 850, low: 5 },
      { pid: 'FB-1002', name: 'Cotton Shirting', color: 'Sky Blue', unit: 'gaz' as const, qty: 60, cost: 320, low: 8 },
      { pid: 'FB-1003', name: 'Panjabi Cotton', color: 'Off White', unit: 'gaz' as const, qty: 30, cost: 400, low: 5 }
    ]
    for (const s of samples) {
      const baseQty = toBase(s.qty, s.unit)
      const baseLow = toBase(s.low, s.unit)
      const res = insertFabric.run(s.pid, s.name, s.color, s.unit, baseQty, s.cost, baseLow)
      if (admin) insertMove.run(Number(res.lastInsertRowid), baseQty, admin.id)
    }
  }
}
