// Thin client-side wrapper over the server actions. Unwraps ActionResult (throws
// on error) so page components can use plain try/catch. Printing and CSV export
// are browser-side operations in the web app.

import type { ActionResult } from '@/lib/result'
import type {
  User,
  Customer,
  Fabric,
  FabricUnit,
  Order,
  OrderStatus,
  StockMovement,
  SmsLog,
  GarmentType,
  NewOrderInput,
  PaymentLine,
  OrderFilters,
  DashboardSummary,
  FabricSoldRow,
  StockRow,
  RevenuePoint,
  StockMovementFilters
} from '@/lib/types'

import { loginAction, logoutAction, sessionAction } from '@/actions/auth'
import * as C from '@/actions/customers'
import * as F from '@/actions/fabrics'
import * as O from '@/actions/orders'
import * as S from '@/actions/sms'
import * as U from '@/actions/users'
import * as A from '@/actions/analytics'

function unwrap<T>(r: ActionResult<T>): T {
  if (!r.ok) throw new Error(r.error)
  return r.data
}

export const api = {
  auth: {
    login: async (username: string, password: string) =>
      unwrap<User>(await loginAction({ username, password })),
    logout: async () => unwrap(await logoutAction()),
    session: async () => unwrap<User | null>(await sessionAction())
  },
  customers: {
    list: async (search?: string) => unwrap<Customer[]>(await C.listCustomers(search)),
    get: async (id: number) => unwrap<Customer | undefined>(await C.getCustomer(id)),
    create: async (input: Partial<Customer>) => unwrap<Customer>(await C.createCustomer(input)),
    update: async (id: number, input: Partial<Customer>) =>
      unwrap<Customer>(await C.updateCustomer(id, input)),
    lastMeasurements: async (id: number, type: GarmentType) =>
      unwrap<Record<string, unknown> | null>(await C.getLastMeasurements(id, type))
  },
  fabrics: {
    list: async (search?: string) => unwrap<Fabric[]>(await F.listFabrics(search)),
    get: async (id: number) => unwrap<Fabric | undefined>(await F.getFabric(id)),
    lowStock: async () => unwrap<Fabric[]>(await F.lowStockFabrics()),
    create: async (input: unknown) => unwrap<Fabric>(await F.createFabric(input)),
    update: async (id: number, input: unknown) => unwrap<Fabric>(await F.updateFabric(id, input)),
    addStock: async (id: number, qty: number, unit: FabricUnit) =>
      unwrap<Fabric>(await F.addStock(id, qty, unit)),
    correctStock: async (id: number, qty: number, unit: FabricUnit) =>
      unwrap<Fabric>(await F.correctStock(id, qty, unit)),
    movements: async (id: number) => unwrap<StockMovement[]>(await F.fabricMovements(id)),
    stockMovements: async (filters: StockMovementFilters) =>
      unwrap<StockMovement[]>(await F.listStockMovements(filters))
  },
  orders: {
    create: async (input: NewOrderInput) => unwrap<Order>(await O.createOrder(input)),
    list: async (filters: OrderFilters) => unwrap<Order[]>(await O.listOrders(filters)),
    get: async (id: number) => unwrap<Order | undefined>(await O.getOrder(id)),
    updateStatus: async (id: number, status: OrderStatus) =>
      unwrap<Order>(await O.updateOrderStatus(id, status)),
    recordPayment: async (orderId: number, lines: PaymentLine[]) =>
      unwrap<Order>(await O.recordPayment({ order_id: orderId, payments: lines }))
  },
  sms: {
    sendReady: async (orderId: number) => unwrap<SmsLog>(await S.sendReadyNotice(orderId)),
    list: async () => unwrap<SmsLog[]>(await S.listSms()),
    gatewayEnabled: async () => unwrap<boolean>(await S.gatewayEnabled())
  },
  users: {
    list: async () => unwrap<User[]>(await U.listUsers()),
    create: async (input: unknown) => unwrap<User>(await U.createUser(input)),
    update: async (id: number, input: unknown) => unwrap<User>(await U.updateUser(id, input)),
    setActive: async (id: number, active: boolean) => unwrap<User>(await U.setUserActive(id, active))
  },
  analytics: {
    summary: async () => unwrap<DashboardSummary>(await A.summary()),
    fabricSold: async (from?: string | null, to?: string | null) =>
      unwrap<FabricSoldRow[]>(await A.fabricSold(from, to)),
    stockRemaining: async () => unwrap<StockRow[]>(await A.stockRemaining()),
    revenueOverTime: async (g: 'day' | 'month', from?: string | null, to?: string | null) =>
      unwrap<RevenuePoint[]>(await A.revenueOverTime(g, from, to)),
    bestSelling: async () =>
      unwrap<{ garment_type: string; count: number; revenue: number }[]>(await A.bestSellingGarments()),
    topCustomers: async () =>
      unwrap<{ id: number; name: string; phone: string; orders: number; spend: number }[]>(
        await A.topCustomers()
      ),
    salesPerf: async () =>
      unwrap<{ id: number; name: string; orders: number; revenue: number }[]>(
        await A.salesManagerPerformance()
      ),
    avgOrderValue: async () => unwrap<number>(await A.averageOrderValue())
  },
  app: {
    print: () => window.print(),
    exportSalesCsv: (rows: Record<string, unknown>[]): boolean => {
      if (rows.length === 0) return false
      const headers = Object.keys(rows[0])
      const esc = (v: unknown): string => {
        const s = v === null || v === undefined ? '' : String(v)
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }
      const lines = [headers.join(',')]
      for (const row of rows) lines.push(headers.map((h) => esc(row[h])).join(','))
      const csv = '﻿' + lines.join('\r\n') // BOM for Excel Unicode (Bangla)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sales-history-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      return true
    }
  }
}
