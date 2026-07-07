// Shared domain types used across server actions and the React UI.

export type Role = 'admin' | 'sales_manager'

export type GarmentType = 'coat' | 'pant' | 'shirt' | 'panjabi'

export type OrderStatus =
  | 'received'
  | 'in_stitching'
  | 'ready_for_pickup'
  | 'delivered'
  | 'cancelled'

export type PaymentMethod = 'cash' | 'bkash' | 'nagad' | 'rocket' | 'card' | 'others'

export type FabricUnit = 'inch' | 'feet' | 'cm' | 'meter' | 'gaz'

export interface User {
  id: number
  name: string
  username: string
  role: Role
  active: boolean
  created_at: string
}

export interface Customer {
  id: number
  name: string
  phone: string
  address: string | null
  notes: string | null
  created_at: string
}

export interface Fabric {
  id: number
  product_id: string
  name: string
  color: string | null
  unit: FabricUnit // preferred display/entry unit
  quantity_base: number // stored internally in centimeters
  cost_price_per_unit: number | null // BDT per display unit
  selling_price_per_unit: number | null // BDT per display unit
  low_stock_threshold: number // stored in centimeters
  created_at: string
}

export interface OrderItem {
  id: number
  order_id: number
  garment_type: GarmentType
  measurements: Record<string, number | string | null>
  style_options: Record<string, unknown>
  fabric_id: number | null
  fabric_name?: string | null
  fabric_quantity_used: number | null // in the entered unit
  fabric_unit: FabricUnit | null
  price: number
}

export interface Payment {
  id: number
  order_id: number
  amount: number
  method: PaymentMethod
  created_by: number
  created_by_name?: string
  created_at: string
}

export interface Order {
  id: number
  customer_id: number
  order_date: string
  expected_delivery_date: string | null
  status: OrderStatus
  payment_method: PaymentMethod
  total_price: number // net payable, after discount
  discount: number
  amount_paid: number
  due_amount: number
  due_date: string | null
  delivery_code: string | null
  created_by: number
  created_at: string
  // joined fields
  customer_name?: string
  customer_phone?: string
  created_by_name?: string
  items?: OrderItem[]
  payments?: Payment[]
}

export type StockReason = 'new_stock' | 'order_deduction' | 'correction' | 'return'

export interface StockMovement {
  id: number
  fabric_id: number
  fabric_name?: string
  fabric_product_id?: string | null
  fabric_unit?: FabricUnit
  change_amount: number // in centimeters; negative = deduction
  reason: StockReason
  reference_order_id: number | null
  supplier_id?: number | null
  supplier_name?: string | null
  challan_number?: string | null
  unit_cost?: number | null
  payment_type?: 'cash' | 'due' | null
  note?: string | null
  created_by: number
  created_by_name?: string
  created_at: string
}

export interface Supplier {
  id: number
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
}

export interface SupplierDetail extends Supplier {
  total_received_value: number // sum of unit_cost * qty across receivings
  cash_total: number
  due_total: number
  fabrics_supplied: { fabric_id: number; name: string; receivings: number; qty_base: number }[]
  receivings: StockMovement[]
}

export interface Expense {
  id: number
  category: string
  description: string | null
  amount: number
  spent_on: string
  created_by: number
  created_by_name?: string
  created_at: string
}

export interface StockMovementFilters {
  from?: string | null
  to?: string | null
  fabricId?: number | null
  supplierId?: number | null
  reason?: StockReason | null
}

export interface ExpenseFilters {
  from?: string | null
  to?: string | null
  category?: string | null
}

export interface SmsLog {
  id: number
  customer_id: number
  customer_name?: string
  customer_phone?: string
  order_id: number | null
  message: string
  type: 'order_confirmation' | 'ready_notice' | 'delivered_notice'
  status: 'sent' | 'failed' | 'stubbed'
  sent_at: string
}

// ---- Server-action input DTOs ----

export interface NewOrderItemInput {
  garment_type: GarmentType
  measurements: Record<string, number | string | null>
  style_options: Record<string, unknown>
  fabric_id: number | null
  fabric_quantity_used: number | null
  fabric_unit: FabricUnit | null
  price: number
}

export interface PaymentLine {
  method: PaymentMethod
  amount: number
}

export interface NewOrderInput {
  customer_id: number
  expected_delivery_date: string | null
  discount: number
  payments: PaymentLine[]
  due_date: string | null
  status: OrderStatus
  items: NewOrderItemInput[]
}

// ---- Query / analytics shapes (kept out of 'use server' files) ----

export interface OrderFilters {
  from?: string | null
  to?: string | null
  customerId?: number | null
  garmentType?: string | null
  paymentStatus?: 'paid' | 'due' | null
  status?: OrderStatus | null
  createdBy?: number | null
  search?: string | null
}

export interface DashboardSummary {
  ordersToday: number
  ordersThisMonth: number
  revenueThisMonth: number
  outstandingDue: number
  lowStockCount: number
  statusCounts: Record<string, number>
  myOrdersThisMonth: number
}

export interface FabricSoldRow {
  fabric_id: number
  name: string
  quantity_used_display: number
  unit: FabricUnit
  value_bdt: number
}

export interface StockRow {
  id: number
  name: string
  color: string | null
  unit: FabricUnit
  quantity_display: number
  low: boolean
}

export interface RevenuePoint {
  period: string
  revenue: number
  orders: number
}

