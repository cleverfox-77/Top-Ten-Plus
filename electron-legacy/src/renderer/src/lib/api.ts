import type {
  ApiResult,
  User,
  Customer,
  Fabric,
  FabricUnit,
  Order,
  OrderStatus,
  StockMovement,
  SmsLog,
  GarmentType,
  NewOrderInput
} from '@shared/types'
import type { OrderFilters } from '../../../main/services/orders'
import type {
  DashboardSummary,
  FabricSoldRow,
  StockRow,
  RevenuePoint
} from '../../../main/services/analytics'

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const res = (await window.api.invoke(channel, ...args)) as ApiResult<T>
  if (!res.ok) throw new Error(res.error)
  return res.data
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      call<User>('auth:login', { username, password }),
    logout: () => call<void>('auth:logout'),
    session: () => call<User | null>('auth:session')
  },
  customers: {
    list: (search?: string) => call<Customer[]>('customers:list', search),
    get: (id: number) => call<Customer | undefined>('customers:get', id),
    create: (input: Partial<Customer>) => call<Customer>('customers:create', input),
    update: (id: number, input: Partial<Customer>) =>
      call<Customer>('customers:update', id, input),
    lastMeasurements: (id: number, type: GarmentType) =>
      call<Record<string, unknown> | null>('customers:lastMeasurements', id, type)
  },
  fabrics: {
    list: (search?: string) => call<Fabric[]>('fabrics:list', search),
    get: (id: number) => call<Fabric | undefined>('fabrics:get', id),
    lowStock: () => call<Fabric[]>('fabrics:lowStock'),
    create: (input: unknown) => call<Fabric>('fabrics:create', input),
    update: (id: number, input: unknown) => call<Fabric>('fabrics:update', id, input),
    addStock: (id: number, qty: number, unit: FabricUnit) =>
      call<Fabric>('fabrics:addStock', id, qty, unit),
    correctStock: (id: number, qty: number, unit: FabricUnit) =>
      call<Fabric>('fabrics:correctStock', id, qty, unit),
    movements: (id: number) => call<StockMovement[]>('fabrics:movements', id)
  },
  orders: {
    create: (input: NewOrderInput) => call<Order>('orders:create', input),
    list: (filters: OrderFilters) => call<Order[]>('orders:list', filters),
    get: (id: number) => call<Order | undefined>('orders:get', id),
    updateStatus: (id: number, status: OrderStatus) =>
      call<Order>('orders:updateStatus', id, status),
    updatePayment: (id: number, paid: number) => call<Order>('orders:updatePayment', id, paid)
  },
  sms: {
    sendReady: (orderId: number) => call<SmsLog>('sms:sendReady', orderId),
    list: () => call<SmsLog[]>('sms:list'),
    gatewayEnabled: () => call<boolean>('sms:gatewayEnabled')
  },
  users: {
    list: () => call<User[]>('users:list'),
    create: (input: unknown) => call<User>('users:create', input),
    update: (id: number, input: unknown) => call<User>('users:update', id, input),
    setActive: (id: number, active: boolean) => call<User>('users:setActive', id, active)
  },
  analytics: {
    summary: () => call<DashboardSummary>('analytics:summary'),
    fabricSold: (from?: string | null, to?: string | null) =>
      call<FabricSoldRow[]>('analytics:fabricSold', from, to),
    stockRemaining: () => call<StockRow[]>('analytics:stockRemaining'),
    revenueOverTime: (g: 'day' | 'month', from?: string | null, to?: string | null) =>
      call<RevenuePoint[]>('analytics:revenueOverTime', g, from, to),
    bestSelling: () =>
      call<{ garment_type: string; count: number; revenue: number }[]>('analytics:bestSelling'),
    topCustomers: () =>
      call<{ id: number; name: string; phone: string; orders: number; spend: number }[]>(
        'analytics:topCustomers'
      ),
    salesPerf: () =>
      call<{ id: number; name: string; orders: number; revenue: number }[]>('analytics:salesPerf'),
    avgOrderValue: () => call<number>('analytics:avgOrderValue')
  },
  app: {
    dbPath: () => call<string>('app:dbPath'),
    print: () => call<boolean>('app:print'),
    exportSalesCsv: (rows: Record<string, unknown>[]) =>
      call<boolean>('app:exportSalesCsv', rows)
  }
}
