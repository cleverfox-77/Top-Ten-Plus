'use server'

import { and, eq, gt, gte, lte, ne, sql, desc } from 'drizzle-orm'
import { db } from '@/db'
import { orders, orderItems, fabrics, customers, users } from '@/db/schema'
import { requireAuth, requireAdmin } from '@/lib/session'
import { run } from '@/lib/result'
import { CM_PER_UNIT, fromBase, round2 } from '@/lib/units'
import type {
  DashboardSummary,
  FabricSoldRow,
  StockRow,
  RevenuePoint,
  FabricUnit
} from '@/lib/types'

export async function summary() {
  return run<DashboardSummary>(async () => {
    const user = await requireAuth()

    const [today] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.order_date, sql`current_date`))

    const monthStart = sql`date_trunc('month', current_date)`
    const [month] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(orders)
      .where(gte(orders.order_date, monthStart))

    const [rev] = await db
      .select({ s: sql<number>`coalesce(sum(${orders.total_price}),0)::float8` })
      .from(orders)
      .where(and(gte(orders.order_date, monthStart), ne(orders.status, 'cancelled')))

    const [due] = await db
      .select({ s: sql<number>`coalesce(sum(${orders.due_amount}),0)::float8` })
      .from(orders)
      .where(ne(orders.status, 'cancelled'))

    const [low] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(fabrics)
      .where(and(gt(fabrics.low_stock_threshold, 0), lte(fabrics.quantity_base, fabrics.low_stock_threshold)))

    const statusRows = await db
      .select({ status: orders.status, c: sql<number>`count(*)::int` })
      .from(orders)
      .groupBy(orders.status)
    const statusCounts: Record<string, number> = {}
    for (const r of statusRows) statusCounts[r.status] = Number(r.c)

    const [mine] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.created_by, user.id), gte(orders.order_date, monthStart)))

    return {
      ordersToday: Number(today.c),
      ordersThisMonth: Number(month.c),
      revenueThisMonth: round2(Number(rev.s)),
      outstandingDue: round2(Number(due.s)),
      lowStockCount: Number(low.c),
      statusCounts,
      myOrdersThisMonth: Number(mine.c)
    }
  })
}

export async function fabricSold(from?: string | null, to?: string | null) {
  return run<FabricSoldRow[]>(async () => {
    await requireAdmin()
    const conds = [ne(orders.status, 'cancelled'), sql`${orderItems.fabric_id} is not null`]
    if (from) conds.push(gte(orders.order_date, from))
    if (to) conds.push(lte(orders.order_date, to))

    const rows = await db
      .select({
        fabric_id: orderItems.fabric_id,
        used: orderItems.fabric_quantity_used,
        used_unit: orderItems.fabric_unit,
        name: fabrics.name,
        pref_unit: fabrics.unit,
        cost: fabrics.cost_price_per_unit
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.order_id))
      .innerJoin(fabrics, eq(fabrics.id, orderItems.fabric_id))
      .where(and(...conds))

    const agg = new Map<number, FabricSoldRow>()
    for (const r of rows) {
      if (!r.fabric_id || !r.used || !r.used_unit) continue
      const usedBase = r.used * CM_PER_UNIT[r.used_unit as FabricUnit]
      const usedInPref = usedBase / CM_PER_UNIT[r.pref_unit as FabricUnit]
      const value = usedInPref * (r.cost ?? 0)
      const ex = agg.get(r.fabric_id)
      if (ex) {
        ex.quantity_used_display = round2(ex.quantity_used_display + usedInPref)
        ex.value_bdt = round2(ex.value_bdt + value)
      } else {
        agg.set(r.fabric_id, {
          fabric_id: r.fabric_id,
          name: r.name,
          quantity_used_display: round2(usedInPref),
          unit: r.pref_unit as FabricUnit,
          value_bdt: round2(value)
        })
      }
    }
    return [...agg.values()].sort((a, b) => b.value_bdt - a.value_bdt)
  })
}

export async function stockRemaining() {
  return run<StockRow[]>(async () => {
    await requireAuth()
    const rows = await db
      .select({
        id: fabrics.id,
        name: fabrics.name,
        color: fabrics.color,
        unit: fabrics.unit,
        quantity_base: fabrics.quantity_base,
        low_stock_threshold: fabrics.low_stock_threshold
      })
      .from(fabrics)
      .orderBy(fabrics.name)
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      unit: r.unit,
      quantity_display: round2(fromBase(r.quantity_base, r.unit)),
      low: r.low_stock_threshold > 0 && r.quantity_base <= r.low_stock_threshold
    }))
  })
}

export async function revenueOverTime(
  granularity: 'day' | 'month' = 'day',
  from?: string | null,
  to?: string | null
) {
  return run<RevenuePoint[]>(async () => {
    await requireAdmin()
    const period =
      granularity === 'month'
        ? sql<string>`to_char(${orders.order_date}, 'YYYY-MM')`
        : sql<string>`to_char(${orders.order_date}, 'YYYY-MM-DD')`
    const conds = [ne(orders.status, 'cancelled')]
    if (from) conds.push(gte(orders.order_date, from))
    if (to) conds.push(lte(orders.order_date, to))
    const rows = await db
      .select({
        period,
        revenue: sql<number>`coalesce(sum(${orders.total_price}),0)::float8`,
        orders: sql<number>`count(*)::int`
      })
      .from(orders)
      .where(and(...conds))
      .groupBy(period)
      .orderBy(period)
    return rows.map((r) => ({ period: r.period, revenue: Number(r.revenue), orders: Number(r.orders) }))
  })
}

export async function bestSellingGarments() {
  return run<{ garment_type: string; count: number; revenue: number }[]>(async () => {
    await requireAdmin()
    const rows = await db
      .select({
        garment_type: orderItems.garment_type,
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${orderItems.price}),0)::float8`
      })
      .from(orderItems)
      .groupBy(orderItems.garment_type)
      .orderBy(desc(sql`count(*)`))
    return rows.map((r) => ({ garment_type: r.garment_type, count: Number(r.count), revenue: Number(r.revenue) }))
  })
}

export async function topCustomers() {
  return run<{ id: number; name: string; phone: string; orders: number; spend: number }[]>(async () => {
    await requireAdmin()
    const rows = await db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        orders: sql<number>`count(${orders.id})::int`,
        spend: sql<number>`coalesce(sum(${orders.total_price}),0)::float8`
      })
      .from(customers)
      .innerJoin(orders, eq(orders.customer_id, customers.id))
      .where(ne(orders.status, 'cancelled'))
      .groupBy(customers.id)
      .orderBy(desc(sql`coalesce(sum(${orders.total_price}),0)`))
      .limit(10)
    return rows.map((r) => ({ ...r, orders: Number(r.orders), spend: Number(r.spend) }))
  })
}

export async function salesManagerPerformance() {
  return run<{ id: number; name: string; orders: number; revenue: number }[]>(async () => {
    await requireAdmin()
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        orders: sql<number>`count(${orders.id})::int`,
        revenue: sql<number>`coalesce(sum(${orders.total_price}),0)::float8`
      })
      .from(users)
      .innerJoin(orders, eq(orders.created_by, users.id))
      .where(ne(orders.status, 'cancelled'))
      .groupBy(users.id)
      .orderBy(desc(sql`coalesce(sum(${orders.total_price}),0)`))
    return rows.map((r) => ({ ...r, orders: Number(r.orders), revenue: Number(r.revenue) }))
  })
}

export async function averageOrderValue() {
  return run<number>(async () => {
    await requireAdmin()
    const [r] = await db
      .select({ v: sql<number>`coalesce(avg(${orders.total_price}),0)::float8` })
      .from(orders)
      .where(ne(orders.status, 'cancelled'))
    return round2(Number(r.v))
  })
}
