import { config } from 'dotenv'
config({ path: '.env.local' })

import bcrypt from 'bcryptjs'
import { db } from './index'
import { users, fabrics, stockMovements } from './schema'
import { toBase } from '@/lib/units'
import { sql } from 'drizzle-orm'

async function main(): Promise<void> {
  const [{ count: userCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)

  if (Number(userCount) === 0) {
    await db.insert(users).values([
      { name: 'Shop Admin', username: 'admin', password_hash: bcrypt.hashSync('admin123', 10), role: 'admin' },
      { name: 'Sales Manager', username: 'sales', password_hash: bcrypt.hashSync('sales123', 10), role: 'sales_manager' }
    ])
    console.log('Seeded default users: admin / admin123, sales / sales123')
  } else {
    console.log('Users already present — skipping user seed')
  }

  const [{ count: fabricCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(fabrics)

  if (Number(fabricCount) === 0) {
    const [admin] = await db.select().from(users).where(sql`role = 'admin'`).limit(1)
    const samples = [
      { productId: 'FB-1001', name: 'Wool Blend Suiting', color: 'Charcoal', qty: 40, cost: 850, low: 5 },
      { productId: 'FB-1002', name: 'Cotton Shirting', color: 'Sky Blue', qty: 60, cost: 320, low: 8 },
      { productId: 'FB-1003', name: 'Panjabi Cotton', color: 'Off White', qty: 30, cost: 400, low: 5 }
    ]
    for (const s of samples) {
      const baseQty = toBase(s.qty, 'gaz')
      const [row] = await db
        .insert(fabrics)
        .values({
          product_id: s.productId,
          name: s.name,
          color: s.color,
          unit: 'gaz',
          quantity_base: baseQty,
          cost_price_per_unit: s.cost,
          low_stock_threshold: toBase(s.low, 'gaz')
        })
        .returning({ id: fabrics.id })
      if (admin) {
        await db.insert(stockMovements).values({
          fabric_id: row.id,
          change_amount: baseQty,
          reason: 'new_stock',
          created_by: admin.id
        })
      }
    }
    console.log('Seeded 3 sample fabrics')
  } else {
    console.log('Fabrics already present — skipping fabric seed')
  }

  console.log('Seed complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
