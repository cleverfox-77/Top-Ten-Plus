// Shared domain types used by both the Electron main process and the renderer.

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
  active: number
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

export interface Order {
  id: number
  customer_id: number
  order_date: string
  expected_delivery_date: string | null
  status: OrderStatus
  payment_method: PaymentMethod
  total_price: number
  amount_paid: number
  due_amount: number
  due_date: string | null
  created_by: number
  created_at: string
  // joined fields
  customer_name?: string
  customer_phone?: string
  created_by_name?: string
  items?: OrderItem[]
}

export interface StockMovement {
  id: number
  fabric_id: number
  fabric_name?: string
  change_amount: number // in centimeters; negative = deduction
  reason: 'new_stock' | 'order_deduction' | 'correction'
  reference_order_id: number | null
  created_by: number
  created_by_name?: string
  created_at: string
}

export interface SmsLog {
  id: number
  customer_id: number
  customer_name?: string
  customer_phone?: string
  order_id: number | null
  message: string
  type: 'order_confirmation' | 'ready_notice'
  status: 'sent' | 'failed' | 'stubbed'
  sent_at: string
}

// ---- IPC payloads ----

export interface NewOrderItemInput {
  garment_type: GarmentType
  measurements: Record<string, number | string | null>
  style_options: Record<string, unknown>
  fabric_id: number | null
  fabric_quantity_used: number | null
  fabric_unit: FabricUnit | null
  price: number
}

export interface NewOrderInput {
  customer_id: number
  expected_delivery_date: string | null
  payment_method: PaymentMethod
  amount_paid: number
  due_date: string | null
  status: OrderStatus
  items: NewOrderItemInput[]
}

export interface Session {
  user: User
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }
