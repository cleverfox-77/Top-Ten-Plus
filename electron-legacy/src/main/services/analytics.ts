import { getDb } from '../db/database'
import { requireAuth, requireAdmin } from '../session'
import { fromBase, round2 } from '../../shared/units'
import type { FabricUnit } from '../../shared/types'

export interface DashboardSummary {
  ordersToday: number
  ordersThisMonth: number
  revenueThisMonth: number
  outstandingDue: number
  lowStockCount: number
  statusCounts: Record<string, number>
  myOrdersThisMonth: number
}

export function summary(): DashboardSummary {
  const user = requireAuth()
  const db = getDb()
  const ordersToday = (
    db.prepare("SELECT COUNT(*) c FROM orders WHERE order_date = date('now','localtime')").get() as {
      c: number
    }
  ).c
  const monthStart = "date('now','localtime','start of month')"
  const ordersThisMonth = (
    db.prepare(`SELECT COUNT(*) c FROM orders WHERE order_date >= ${monthStart}`).get() as {
      c: number
    }
  ).c
  const revenueThisMonth = (
    db
      .prepare(
        `SELECT COALESCE(SUM(total_price),0) s FROM orders WHERE order_date >= ${monthStart} AND status <> 'cancelled'`
      )
      .get() as { s: number }
  ).s
  const outstandingDue = (
    db
      .prepare("SELECT COALESCE(SUM(due_amount),0) s FROM orders WHERE status <> 'cancelled'")
      .get() as { s: number }
  ).s
  const lowStockCount = (
    db
      .prepare(
        'SELECT COUNT(*) c FROM fabrics WHERE low_stock_threshold > 0 AND quantity_base <= low_stock_threshold'
      )
      .get() as { c: number }
  ).c
  const statusRows = db
    .prepare('SELECT status, COUNT(*) c FROM orders GROUP BY status')
    .all() as { status: string; c: number }[]
  const statusCounts: Record<string, number> = {}
  for (const r of statusRows) statusCounts[r.status] = r.c

  const myOrdersThisMonth = (
    db
      .prepare(`SELECT COUNT(*) c FROM orders WHERE created_by = ? AND order_date >= ${monthStart}`)
      .get(user.id) as { c: number }
  ).c

  return {
    ordersToday,
    ordersThisMonth,
    revenueThisMonth: round2(revenueThisMonth),
    outstandingDue: round2(outstandingDue),
    lowStockCount,
    statusCounts,
    myOrdersThisMonth
  }
}

export interface FabricSoldRow {
  fabric_id: number
  name: string
  quantity_used_display: number
  unit: FabricUnit
  value_bdt: number
}

/** Fabric sold, valued in BDT, by fabric over a time period (plan §11). */
export function fabricSold(from?: string | null, to?: string | null): FabricSoldRow[] {
  requireAdmin()
  const db = getDb()
  const where: string[] = ["o.status <> 'cancelled'", 'oi.fabric_id IS NOT NULL']
  const params: unknown[] = []
  if (from) {
    where.push('o.order_date >= ?')
    params.push(from)
  }
  if (to) {
    where.push('o.order_date <= ?')
    params.push(to)
  }
  const rows = db
    .prepare(
      `SELECT oi.fabric_id, oi.fabric_quantity_used, oi.fabric_unit,
              f.name, f.unit AS fabric_unit_pref, f.cost_price_per_unit
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN fabrics f ON f.id = oi.fabric_id
       WHERE ${where.join(' AND ')}`
    )
    .all(...params) as {
    fabric_id: number
    fabric_quantity_used: number
    fabric_unit: FabricUnit
    name: string
    fabric_unit_pref: FabricUnit
    cost_price_per_unit: number | null
  }[]

  const agg = new Map<number, FabricSoldRow>()
  for (const r of rows) {
    // Normalise usage to the fabric's preferred unit for consistent totals & pricing.
    const usedBase = r.fabric_quantity_used * unitCm(r.fabric_unit)
    const usedInPref = usedBase / unitCm(r.fabric_unit_pref)
    const value = usedInPref * (r.cost_price_per_unit ?? 0)
    const existing = agg.get(r.fabric_id)
    if (existing) {
      existing.quantity_used_display = round2(existing.quantity_used_display + usedInPref)
      existing.value_bdt = round2(existing.value_bdt + value)
    } else {
      agg.set(r.fabric_id, {
        fabric_id: r.fabric_id,
        name: r.name,
        quantity_used_display: round2(usedInPref),
        unit: r.fabric_unit_pref,
        value_bdt: round2(value)
      })
    }
  }
  return [...agg.values()].sort((a, b) => b.value_bdt - a.value_bdt)
}

function unitCm(unit: FabricUnit): number {
  const map: Record<FabricUnit, number> = { cm: 1, inch: 2.54, feet: 30.48, meter: 100, gaz: 91.44 }
  return map[unit]
}

export interface StockRow {
  id: number
  name: string
  color: string | null
  unit: FabricUnit
  quantity_display: number
  low: boolean
}

export function stockRemaining(): StockRow[] {
  requireAuth()
  const rows = getDb()
    .prepare('SELECT id, name, color, unit, quantity_base, low_stock_threshold FROM fabrics ORDER BY name')
    .all() as {
    id: number
    name: string
    color: string | null
    unit: FabricUnit
    quantity_base: number
    low_stock_threshold: number
  }[]
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    unit: r.unit,
    quantity_display: round2(fromBase(r.quantity_base, r.unit)),
    low: r.low_stock_threshold > 0 && r.quantity_base <= r.low_stock_threshold
  }))
}

export interface RevenuePoint {
  period: string
  revenue: number
  orders: number
}

export function revenueOverTime(
  granularity: 'day' | 'month' = 'day',
  from?: string | null,
  to?: string | null
): RevenuePoint[] {
  requireAdmin()
  const db = getDb()
  const fmt = granularity === 'month' ? "strftime('%Y-%m', order_date)" : 'order_date'
  const where: string[] = ["status <> 'cancelled'"]
  const params: unknown[] = []
  if (from) {
    where.push('order_date >= ?')
    params.push(from)
  }
  if (to) {
    where.push('order_date <= ?')
    params.push(to)
  }
  return db
    .prepare(
      `SELECT ${fmt} AS period, COALESCE(SUM(total_price),0) AS revenue, COUNT(*) AS orders
       FROM orders WHERE ${where.join(' AND ')}
       GROUP BY period ORDER BY period`
    )
    .all(...params) as RevenuePoint[]
}

export function bestSellingGarments(): { garment_type: string; count: number; revenue: number }[] {
  requireAdmin()
  return getDb()
    .prepare(
      `SELECT garment_type, COUNT(*) AS count, COALESCE(SUM(price),0) AS revenue
       FROM order_items GROUP BY garment_type ORDER BY count DESC`
    )
    .all() as { garment_type: string; count: number; revenue: number }[]
}

export function topCustomers(): { id: number; name: string; phone: string; orders: number; spend: number }[] {
  requireAdmin()
  return getDb()
    .prepare(
      `SELECT c.id, c.name, c.phone, COUNT(o.id) AS orders, COALESCE(SUM(o.total_price),0) AS spend
       FROM customers c JOIN orders o ON o.customer_id = c.id
       WHERE o.status <> 'cancelled'
       GROUP BY c.id ORDER BY spend DESC LIMIT 10`
    )
    .all() as { id: number; name: string; phone: string; orders: number; spend: number }[]
}

export function salesManagerPerformance(): { id: number; name: string; orders: number; revenue: number }[] {
  requireAdmin()
  return getDb()
    .prepare(
      `SELECT u.id, u.name, COUNT(o.id) AS orders, COALESCE(SUM(o.total_price),0) AS revenue
       FROM users u JOIN orders o ON o.created_by = u.id
       WHERE o.status <> 'cancelled'
       GROUP BY u.id ORDER BY revenue DESC`
    )
    .all() as { id: number; name: string; orders: number; revenue: number }[]
}

export function averageOrderValue(): number {
  requireAdmin()
  const r = getDb()
    .prepare("SELECT COALESCE(AVG(total_price),0) v FROM orders WHERE status <> 'cancelled'")
    .get() as { v: number }
  return round2(r.v)
}
