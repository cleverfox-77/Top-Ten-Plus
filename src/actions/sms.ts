'use server'

import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { smsLog, orders, customers } from '@/db/schema'
import { requireAuth } from '@/lib/session'
import { run } from '@/lib/result'
import { GATEWAY_ENABLED, dispatch, buildReadyMessage } from '@/lib/sms-util'
import type { SmsLog } from '@/lib/types'

export async function sendReadyNotice(orderId: number) {
  return run<SmsLog>(async () => {
    await requireAuth()
    const [order] = await db
      .select({ id: orders.id, customer_id: orders.customer_id, phone: customers.phone })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customer_id))
      .where(eq(orders.id, orderId))
      .limit(1)
    if (!order) throw new Error('Order not found')

    const message = buildReadyMessage(order.id)
    let status: SmsLog['status'] = 'stubbed'
    if (GATEWAY_ENABLED) status = await dispatch(order.phone, message)

    const [row] = await db
      .insert(smsLog)
      .values({ customer_id: order.customer_id, order_id: order.id, message, type: 'ready_notice', status })
      .returning()

    const [customer] = await db
      .select({ name: customers.name, phone: customers.phone })
      .from(customers)
      .where(eq(customers.id, order.customer_id))
      .limit(1)
    return { ...row, customer_name: customer?.name, customer_phone: customer?.phone }
  })
}

export async function listSms() {
  return run<SmsLog[]>(async () => {
    await requireAuth()
    return db
      .select({
        id: smsLog.id,
        customer_id: smsLog.customer_id,
        order_id: smsLog.order_id,
        message: smsLog.message,
        type: smsLog.type,
        status: smsLog.status,
        sent_at: smsLog.sent_at,
        customer_name: customers.name,
        customer_phone: customers.phone
      })
      .from(smsLog)
      .innerJoin(customers, eq(customers.id, smsLog.customer_id))
      .orderBy(desc(smsLog.id))
      .limit(200)
  })
}

export async function gatewayEnabled() {
  return run<boolean>(async () => GATEWAY_ENABLED)
}
