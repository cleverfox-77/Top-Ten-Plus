import { ipcMain, dialog, BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'
import * as auth from './services/auth'
import * as customers from './services/customers'
import * as fabrics from './services/fabrics'
import * as orders from './services/orders'
import * as sms from './services/sms'
import * as users from './services/users'
import * as analytics from './services/analytics'
import { getDbPath } from './db/database'
import type { ApiResult, GarmentType, FabricUnit, OrderStatus } from '../shared/types'

// Wrap each handler so the renderer always receives a structured result instead
// of an unhandled exception.
function handle<T>(channel: string, fn: (...args: any[]) => T | Promise<T>): void {
  ipcMain.handle(channel, async (_event, ...args): Promise<ApiResult<T>> => {
    try {
      const data = await fn(...args)
      return { ok: true, data }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, error: message }
    }
  })
}

export function registerIpc(): void {
  // --- Auth ---
  handle('auth:login', (input) => auth.login(input))
  handle('auth:logout', () => auth.logout())
  handle('auth:session', () => auth.getSession())

  // --- Customers ---
  handle('customers:list', (search?: string) => customers.listCustomers(search))
  handle('customers:get', (id: number) => customers.getCustomer(id))
  handle('customers:create', (input) => customers.createCustomer(input))
  handle('customers:update', (id: number, input) => customers.updateCustomer(id, input))
  handle('customers:lastMeasurements', (id: number, type: GarmentType) =>
    customers.getLastMeasurements(id, type)
  )

  // --- Fabrics / stock ---
  handle('fabrics:list', (search?: string) => fabrics.listFabrics(search))
  handle('fabrics:get', (id: number) => fabrics.getFabric(id))
  handle('fabrics:lowStock', () => fabrics.lowStockFabrics())
  handle('fabrics:create', (input) => fabrics.createFabric(input))
  handle('fabrics:update', (id: number, input) => fabrics.updateFabric(id, input))
  handle('fabrics:addStock', (id: number, qty: number, unit: FabricUnit) =>
    fabrics.addStock(id, qty, unit)
  )
  handle('fabrics:correctStock', (id: number, qty: number, unit: FabricUnit) =>
    fabrics.correctStock(id, qty, unit)
  )
  handle('fabrics:movements', (id: number) => fabrics.fabricMovements(id))

  // --- Orders ---
  handle('orders:create', (input) => orders.createOrder(input))
  handle('orders:list', (filters) => orders.listOrders(filters))
  handle('orders:get', (id: number) => orders.getOrder(id))
  handle('orders:updateStatus', (id: number, status: OrderStatus) =>
    orders.updateOrderStatus(id, status)
  )
  handle('orders:updatePayment', (id: number, paid: number) => orders.updateOrderPayment(id, paid))

  // --- SMS ---
  handle('sms:sendReady', (orderId: number) => sms.sendReadyNotice(orderId))
  handle('sms:list', () => sms.listSms())
  handle('sms:gatewayEnabled', () => sms.gatewayEnabled())

  // --- Users (admin) ---
  handle('users:list', () => users.listUsers())
  handle('users:create', (input) => users.createUser(input))
  handle('users:update', (id: number, input) => users.updateUser(id, input))
  handle('users:setActive', (id: number, active: boolean) => users.setUserActive(id, active))

  // --- Analytics ---
  handle('analytics:summary', () => analytics.summary())
  handle('analytics:fabricSold', (from, to) => analytics.fabricSold(from, to))
  handle('analytics:stockRemaining', () => analytics.stockRemaining())
  handle('analytics:revenueOverTime', (g, from, to) => analytics.revenueOverTime(g, from, to))
  handle('analytics:bestSelling', () => analytics.bestSellingGarments())
  handle('analytics:topCustomers', () => analytics.topCustomers())
  handle('analytics:salesPerf', () => analytics.salesManagerPerformance())
  handle('analytics:avgOrderValue', () => analytics.averageOrderValue())

  // --- App utilities ---
  handle('app:dbPath', () => getDbPath())
  handle('app:print', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) throw new Error('No active window')
    return await new Promise<boolean>((resolve, reject) => {
      win.webContents.print({ silent: false, printBackground: true }, (success, reason) => {
        if (success) resolve(true)
        else reject(new Error(reason || 'Printing was cancelled'))
      })
    })
  })

  handle('app:exportSalesCsv', async (rows: Record<string, unknown>[]) => {
    const win = BrowserWindow.getFocusedWindow()
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      title: 'Export Sales History',
      defaultPath: `sales-history-${new Date().toISOString().slice(0, 10)}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (canceled || !filePath) return false
    writeFileSync(filePath, toCsv(rows), 'utf8')
    return true
  })
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(',')]
  for (const row of rows) lines.push(headers.map((h) => esc(row[h])).join(','))
  return '﻿' + lines.join('\r\n') // BOM for Excel Unicode (Bangla) support
}
