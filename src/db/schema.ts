import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  doublePrecision,
  date,
  timestamp,
  jsonb,
  index
} from 'drizzle-orm/pg-core'
import type {
  Role,
  GarmentType,
  OrderStatus,
  PaymentMethod,
  FabricUnit
} from '@/lib/types'

// Data model per implementation plan §12. Garment measurements & style choices
// are stored as JSONB so adding a garment type/field is a code change, not a
// migration. Fabric quantities are stored in a base unit (centimeters).
//
// JS property names are kept in snake_case to match the domain types returned to
// the UI, so query rows map straight onto Customer/Fabric/Order/etc.

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: text('role').$type<Role>().notNull(),
  active: boolean('active').notNull().default(true),
  created_at: timestamp('created_at', { mode: 'string' }).notNull().defaultNow()
})

export const customers = pgTable(
  'customers',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    phone: text('phone').notNull().unique(),
    address: text('address'),
    notes: text('notes'),
    created_at: timestamp('created_at', { mode: 'string' }).notNull().defaultNow()
  },
  (t) => ({ nameIdx: index('idx_customers_name').on(t.name) })
)

export const fabrics = pgTable('fabrics', {
  id: serial('id').primaryKey(),
  product_id: text('product_id').notNull().unique(),
  name: text('name').notNull(),
  color: text('color'),
  unit: text('unit').$type<FabricUnit>().notNull().default('gaz'),
  quantity_base: doublePrecision('quantity_base').notNull().default(0), // centimeters
  cost_price_per_unit: doublePrecision('cost_price_per_unit'), // BDT per display unit
  selling_price_per_unit: doublePrecision('selling_price_per_unit'), // BDT per display unit
  low_stock_threshold: doublePrecision('low_stock_threshold').notNull().default(0), // centimeters
  created_at: timestamp('created_at', { mode: 'string' }).notNull().defaultNow()
})

export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    customer_id: integer('customer_id')
      .notNull()
      .references(() => customers.id),
    order_date: date('order_date').notNull().defaultNow(),
    expected_delivery_date: date('expected_delivery_date'),
    status: text('status').$type<OrderStatus>().notNull().default('received'),
    payment_method: text('payment_method').$type<PaymentMethod>().notNull().default('cash'),
    total_price: doublePrecision('total_price').notNull().default(0), // net payable, after discount
    discount: doublePrecision('discount').notNull().default(0),
    amount_paid: doublePrecision('amount_paid').notNull().default(0),
    due_amount: doublePrecision('due_amount').notNull().default(0),
    due_date: date('due_date'),
    delivery_code: text('delivery_code'), // random 6-digit code to match at delivery
    created_by: integer('created_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { mode: 'string' }).notNull().defaultNow()
  },
  (t) => ({
    customerIdx: index('idx_orders_customer').on(t.customer_id),
    dateIdx: index('idx_orders_date').on(t.order_date)
  })
)

// Every payment against an order is a row here (initial deposit, later due
// payments, and split cash + card/MFS). orders.amount_paid caches the sum.
export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    order_id: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    amount: doublePrecision('amount').notNull(),
    method: text('method').$type<PaymentMethod>().notNull(),
    created_by: integer('created_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { mode: 'string' }).notNull().defaultNow()
  },
  (t) => ({ orderIdx: index('idx_payments_order').on(t.order_id) })
)

export const orderItems = pgTable(
  'order_items',
  {
    id: serial('id').primaryKey(),
    order_id: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    garment_type: text('garment_type').$type<GarmentType>().notNull(),
    measurements: jsonb('measurements')
      .$type<Record<string, number | string | null>>()
      .notNull()
      .default({}),
    style_options: jsonb('style_options')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    fabric_id: integer('fabric_id').references(() => fabrics.id),
    fabric_quantity_used: doublePrecision('fabric_quantity_used'),
    fabric_unit: text('fabric_unit').$type<FabricUnit>(),
    price: doublePrecision('price').notNull().default(0)
  },
  (t) => ({ orderIdx: index('idx_items_order').on(t.order_id) })
)

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: serial('id').primaryKey(),
    fabric_id: integer('fabric_id')
      .notNull()
      .references(() => fabrics.id),
    change_amount: doublePrecision('change_amount').notNull(), // cm; negative = deduction
    reason: text('reason')
      .$type<'new_stock' | 'order_deduction' | 'correction' | 'return'>()
      .notNull(),
    reference_order_id: integer('reference_order_id').references(() => orders.id),
    // Receiving details (used when reason = 'new_stock')
    supplier_id: integer('supplier_id').references(() => suppliers.id),
    challan_number: text('challan_number'),
    unit_cost: doublePrecision('unit_cost'), // BDT per display unit at receiving
    payment_type: text('payment_type').$type<'cash' | 'due'>(),
    note: text('note'), // e.g. return reason
    created_by: integer('created_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at', { mode: 'string' }).notNull().defaultNow()
  },
  (t) => ({
    fabricIdx: index('idx_movements_fabric').on(t.fabric_id),
    supplierIdx: index('idx_movements_supplier').on(t.supplier_id)
  })
)

export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  address: text('address'),
  notes: text('notes'),
  created_at: timestamp('created_at', { mode: 'string' }).notNull().defaultNow()
})

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  category: text('category').notNull(),
  description: text('description'),
  amount: doublePrecision('amount').notNull(),
  spent_on: date('spent_on').notNull().defaultNow(),
  created_by: integer('created_by')
    .notNull()
    .references(() => users.id),
  created_at: timestamp('created_at', { mode: 'string' }).notNull().defaultNow()
})

export const smsLog = pgTable('sms_log', {
  id: serial('id').primaryKey(),
  customer_id: integer('customer_id')
    .notNull()
    .references(() => customers.id),
  order_id: integer('order_id').references(() => orders.id),
  message: text('message').notNull(),
  type: text('type').$type<'order_confirmation' | 'ready_notice'>().notNull(),
  status: text('status').$type<'sent' | 'failed' | 'stubbed'>().notNull(),
  sent_at: timestamp('sent_at', { mode: 'string' }).notNull().defaultNow()
})
