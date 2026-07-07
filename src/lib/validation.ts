// Application-layer validation (implementation plan §3 note) using Zod.
// The database stores measurements & style options as flexible JSON; these
// schemas keep the data consistent regardless.

import { z } from 'zod'

export const garmentTypeSchema = z.enum(['coat', 'pant', 'shirt', 'panjabi'])
export const fabricUnitSchema = z.enum(['inch', 'feet', 'cm', 'meter', 'gaz'])
export const paymentMethodSchema = z.enum(['cash', 'bkash', 'nagad', 'rocket', 'card', 'others'])
export const orderStatusSchema = z.enum([
  'received',
  'in_stitching',
  'ready_for_pickup',
  'delivered',
  'cancelled'
])

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required'),
  phone: z.string().trim().min(1, 'Phone number is required'),
  address: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional()
})

const paymentTypeSchema = z.enum(['cash', 'due'])

export const fabricSchema = z.object({
  product_id: z.string().trim().min(1, 'Product ID / barcode is required'),
  name: z.string().trim().min(1, 'Fabric name is required'),
  color: z.string().trim().nullable().optional(),
  unit: fabricUnitSchema,
  quantity: z.number().nonnegative('Quantity cannot be negative'),
  cost_price_per_unit: z.number().nonnegative().nullable().optional(),
  selling_price_per_unit: z.number().nonnegative().nullable().optional(),
  low_stock_threshold: z.number().nonnegative().default(0),
  // Initial receiving details (optional)
  supplier_id: z.number().int().positive().nullable().optional(),
  challan_number: z.string().trim().nullable().optional(),
  payment_type: paymentTypeSchema.nullable().optional()
})

// One fabric row inside a bulk stock intake.
export const bulkFabricItemSchema = z.object({
  product_id: z.string().trim().min(1, 'Product ID / barcode is required'),
  name: z.string().trim().min(1, 'Fabric name is required'),
  color: z.string().trim().nullable().optional(),
  unit: fabricUnitSchema,
  quantity: z.number().nonnegative('Quantity cannot be negative'),
  cost_price_per_unit: z.number().nonnegative().nullable().optional(),
  selling_price_per_unit: z.number().nonnegative().nullable().optional(),
  low_stock_threshold: z.number().nonnegative().default(0)
})

// Add several fabrics/stocks at once, sharing supplier / challan / payment.
export const bulkFabricsSchema = z.object({
  supplier_id: z.number().int().positive().nullable().optional(),
  challan_number: z.string().trim().nullable().optional(),
  payment_type: paymentTypeSchema.nullable().optional(),
  items: z.array(bulkFabricItemSchema).min(1, 'Add at least one fabric')
})

export const supplierSchema = z.object({
  name: z.string().trim().min(1, 'Supplier name is required'),
  phone: z.string().trim().nullable().optional(),
  address: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional()
})

export const receiveStockSchema = z.object({
  fabric_id: z.number().int().positive(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unit: fabricUnitSchema,
  unit_cost: z.number().nonnegative().nullable().optional(),
  selling_price_per_unit: z.number().nonnegative().nullable().optional(),
  supplier_id: z.number().int().positive().nullable().optional(),
  challan_number: z.string().trim().nullable().optional(),
  payment_type: paymentTypeSchema.nullable().optional()
})

export const returnStockSchema = z.object({
  fabric_id: z.number().int().positive('Select a product'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unit: fabricUnitSchema,
  note: z.string().trim().nullable().optional()
})

export const expenseSchema = z.object({
  category: z.string().trim().min(1, 'Category is required'),
  description: z.string().trim().nullable().optional(),
  amount: z.number().positive('Amount must be greater than zero'),
  spent_on: z.string().min(1, 'Date is required')
})

// Measurements: a flat record of numeric-ish values (blank allowed).
const measurementValue = z.union([z.number(), z.string(), z.null()])
export const measurementsSchema = z.record(measurementValue)
export const styleOptionsSchema = z.record(z.unknown())

export const orderItemSchema = z.object({
  garment_type: garmentTypeSchema,
  measurements: measurementsSchema,
  style_options: styleOptionsSchema,
  fabric_id: z.number().int().positive().nullable(),
  fabric_quantity_used: z.number().nonnegative().nullable(),
  fabric_unit: fabricUnitSchema.nullable(),
  price: z.number().nonnegative('Price cannot be negative')
})

export const paymentLineSchema = z.object({
  method: paymentMethodSchema,
  amount: z.number().nonnegative()
})

export const newOrderSchema = z
  .object({
    customer_id: z.number().int().positive('A customer is required'),
    expected_delivery_date: z.string().nullable(),
    discount: z.number().nonnegative('Discount cannot be negative').default(0),
    payments: z.array(paymentLineSchema).default([]),
    due_date: z.string().nullable(),
    status: orderStatusSchema,
    items: z.array(orderItemSchema).min(1, 'Add at least one garment')
  })
  .refine(
    (o) => o.items.every((it) => it.fabric_id === null || it.fabric_quantity_used !== null),
    { message: 'Enter the fabric quantity used for each garment that has a fabric selected' }
  )

// A batch of payments received later against an order's balance.
export const recordPaymentSchema = z.object({
  order_id: z.number().int().positive(),
  payments: z.array(paymentLineSchema).min(1, 'Add at least one payment')
})

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1)
})

export const userSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  username: z.string().trim().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(4, 'Password must be at least 4 characters').optional(),
  role: z.enum(['admin', 'sales_manager'])
})

export type CustomerInput = z.infer<typeof customerSchema>
export type FabricInput = z.infer<typeof fabricSchema>
export type NewOrderValidated = z.infer<typeof newOrderSchema>
export type UserInput = z.infer<typeof userSchema>
