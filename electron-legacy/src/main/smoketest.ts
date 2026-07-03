// Headless end-to-end smoke test of the real service layer, run inside Electron
// (so it uses the Electron-ABI better-sqlite3). Triggered by SMOKE_TEST=1.
// Points at a throwaway userData dir so it never touches real shop data.

import { login } from './services/auth'
import { createCustomer } from './services/customers'
import { getFabric } from './services/fabrics'
import { createOrder, getOrder, listOrders } from './services/orders'
import { listSms } from './services/sms'
import { toBase, round2 } from '../shared/units'

let failures = 0
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    console.log(`  PASS  ${name}`)
  } else {
    failures++
    console.log(`  FAIL  ${name}  ${detail}`)
  }
}

export async function runSmokeTest(): Promise<number> {
  console.log('\n=== Top Ten Plus smoke test ===')

  // Auth
  const user = login({ username: 'admin', password: 'admin123' })
  check('admin can log in', user.role === 'admin')
  try {
    login({ username: 'admin', password: 'wrong' })
    check('bad password rejected', false)
  } catch {
    check('bad password rejected', true)
  }

  // Customer
  const customer = createCustomer({ name: 'Test Customer', phone: '01700000000' })
  check('customer created', customer.id > 0)

  // Seeded fabric
  const fabricBefore = getFabric(1)!
  check('seeded fabric exists', !!fabricBefore)
  const beforeQty = fabricBefore.quantity_base

  // Create an order that consumes 3 Gaz of fabric #1
  const usedGaz = 3
  const order = createOrder({
    customer_id: customer.id,
    expected_delivery_date: '2026-07-20',
    payment_method: 'cash',
    amount_paid: 2000,
    due_date: '2026-07-20',
    status: 'received',
    items: [
      {
        garment_type: 'coat',
        measurements: { long: 30, chest: 40, shoulder: 18 },
        style_options: { garment_style: 'single_breasted', sb_button_style: '2_button' },
        fabric_id: 1,
        fabric_quantity_used: usedGaz,
        fabric_unit: 'gaz',
        price: 5000
      }
    ]
  })
  check('order created', order.id > 0)
  check('total computed', order.total_price === 5000, `got ${order.total_price}`)
  check('due computed', order.due_amount === 3000, `got ${order.due_amount}`)

  // Stock deducted correctly
  const fabricAfter = getFabric(1)!
  const expected = round2(beforeQty - toBase(usedGaz, 'gaz'))
  check(
    'stock deducted by 3 Gaz (274.32 cm)',
    Math.abs(fabricAfter.quantity_base - expected) < 0.01,
    `before=${beforeQty} after=${fabricAfter.quantity_base} expected=${expected}`
  )

  // Order round-trips with JSON measurements/style intact
  const fetched = getOrder(order.id)!
  check('order has 1 item', fetched.items?.length === 1)
  check('measurements persisted', fetched.items?.[0].measurements.chest === 40)
  check(
    'style persisted',
    fetched.items?.[0].style_options.garment_style === 'single_breasted'
  )

  // Confirmation SMS logged automatically
  const sms = listSms()
  check('confirmation SMS logged', sms.some((s) => s.order_id === order.id && s.type === 'order_confirmation'))

  // Listing / filtering
  const due = listOrders({ paymentStatus: 'due' })
  check('order appears in due filter', due.some((o) => o.id === order.id))

  // Overselling is blocked
  try {
    createOrder({
      customer_id: customer.id,
      expected_delivery_date: null,
      payment_method: 'cash',
      amount_paid: 0,
      due_date: null,
      status: 'received',
      items: [
        {
          garment_type: 'coat',
          measurements: {},
          style_options: {},
          fabric_id: 1,
          fabric_quantity_used: 100000, // way more than in stock
          fabric_unit: 'gaz',
          price: 100
        }
      ]
    })
    check('oversell blocked', false)
  } catch {
    check('oversell blocked', true)
  }

  console.log(`=== ${failures === 0 ? 'ALL PASSED' : failures + ' FAILED'} ===\n`)
  return failures === 0 ? 0 : 1
}
