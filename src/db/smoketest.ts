import { config } from 'dotenv'
config({ path: '.env.local' })

import { eq, inArray } from 'drizzle-orm'
import { db } from './index'
import { users, customers, fabrics, orders, stockMovements, smsLog } from './schema'
import { createOrderCore } from '@/lib/order-core'
import { toBase, round2 } from '@/lib/units'

let failures = 0
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + detail}`)
  if (!cond) failures++
}

async function main(): Promise<void> {
  console.log('\n=== Top Ten Plus — Neon smoke test ===')

  const [admin] = await db.select().from(users).where(eq(users.role, 'admin')).limit(1)
  check('admin user seeded', !!admin)

  const [fabricBefore] = await db.select().from(fabrics).where(eq(fabrics.id, 1)).limit(1)
  check('seeded fabric #1 exists', !!fabricBefore)
  const beforeQty = fabricBefore.quantity_base

  // Fresh test customer (unique phone).
  const phone = `0179${Date.now().toString().slice(-7)}`
  const [customer] = await db
    .insert(customers)
    .values({ name: 'SMOKE TEST Customer', phone })
    .returning()
  check('customer created', customer.id > 0)

  // Create an order consuming 3 Gaz of fabric #1 via the real core logic.
  const usedGaz = 3
  const order = await createOrderCore(admin.id, {
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
  check('order item persisted', order.items?.length === 1)
  check('measurements persisted (jsonb)', order.items?.[0].measurements.chest === 40)
  check(
    'style persisted (jsonb)',
    order.items?.[0].style_options.garment_style === 'single_breasted'
  )

  const [fabricAfter] = await db.select().from(fabrics).where(eq(fabrics.id, 1)).limit(1)
  const expected = round2(beforeQty - toBase(usedGaz, 'gaz'))
  check(
    'stock deducted by 3 Gaz (274.32 cm)',
    Math.abs(fabricAfter.quantity_base - expected) < 0.01,
    `before=${beforeQty} after=${fabricAfter.quantity_base} expected=${expected}`
  )

  const movements = await db
    .select()
    .from(stockMovements)
    .where(eq(stockMovements.reference_order_id, order.id))
  check('order_deduction movement logged', movements.length === 1 && movements[0].reason === 'order_deduction')

  const sms = await db.select().from(smsLog).where(eq(smsLog.order_id, order.id))
  check('confirmation SMS logged', sms.some((s) => s.type === 'order_confirmation'))

  // Overselling must roll the whole transaction back.
  let blocked = false
  const [fabricBeforeOversell] = await db.select().from(fabrics).where(eq(fabrics.id, 1)).limit(1)
  try {
    await createOrderCore(admin.id, {
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
          fabric_quantity_used: 100000,
          fabric_unit: 'gaz',
          price: 100
        }
      ]
    })
  } catch {
    blocked = true
  }
  const [fabricAfterOversell] = await db.select().from(fabrics).where(eq(fabrics.id, 1)).limit(1)
  check('oversell blocked', blocked)
  check(
    'oversell rolled back (stock unchanged)',
    fabricBeforeOversell.quantity_base === fabricAfterOversell.quantity_base
  )

  // ---- cleanup: remove test data, restore stock ----
  const testOrderIds = (
    await db.select({ id: orders.id }).from(orders).where(eq(orders.customer_id, customer.id))
  ).map((o) => o.id)
  if (testOrderIds.length) {
    await db.delete(smsLog).where(inArray(smsLog.order_id, testOrderIds))
    await db.delete(stockMovements).where(inArray(stockMovements.reference_order_id, testOrderIds))
    await db.delete(orders).where(inArray(orders.id, testOrderIds)) // cascades order_items
  }
  await db.delete(customers).where(eq(customers.id, customer.id))
  await db.update(fabrics).set({ quantity_base: beforeQty }).where(eq(fabrics.id, 1))

  const [restored] = await db.select().from(fabrics).where(eq(fabrics.id, 1)).limit(1)
  check('cleanup: stock restored', Math.abs(restored.quantity_base - beforeQty) < 0.01)

  console.log(`=== ${failures === 0 ? 'ALL PASSED' : failures + ' FAILED'} ===\n`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('Smoke test error:', err)
  process.exit(1)
})
