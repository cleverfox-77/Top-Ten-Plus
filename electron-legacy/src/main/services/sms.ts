import { getDb } from '../db/database'
import { requireAuth } from '../session'
import type { SmsLog } from '../../shared/types'

// SMS is stubbed for v1 (plan §9). Every message is composed and written to the
// sms_log so the notify workflow and history are fully functional; swapping in a
// real Bangladesh gateway (BulkSMSBD / MiMSMS / Alpha SMS / sms.bd) is a matter
// of implementing `dispatch()` against their REST API and flipping GATEWAY_ENABLED.

const GATEWAY_ENABLED = false

async function dispatch(_phone: string, _message: string): Promise<'sent' | 'failed'> {
  // TODO Phase 2: POST to the chosen gateway's REST API here.
  return 'sent'
}

function shopName(): string {
  return 'Top Ten Plus'
}

/** Instant confirmation, composed at order creation time (runs inside the order tx). */
export function logOrderConfirmation(orderId: number, customerId: number): void {
  const db = getDb()
  const order = db
    .prepare('SELECT total_price, expected_delivery_date FROM orders WHERE id = ?')
    .get(orderId) as { total_price: number; expected_delivery_date: string | null } | undefined
  const delivery = order?.expected_delivery_date
    ? ` Expected delivery: ${order.expected_delivery_date}.`
    : ''
  const message =
    `${shopName()}: Your order #${orderId} has been received. ` +
    `Total: ${order?.total_price ?? 0} BDT.${delivery} Thank you!`

  db.prepare(
    `INSERT INTO sms_log (customer_id, order_id, message, type, status)
     VALUES (?, ?, ?, 'order_confirmation', ?)`
  ).run(customerId, orderId, message, GATEWAY_ENABLED ? 'sent' : 'stubbed')
}

/** Manual "your order is ready" notice (plan §9.2). */
export async function sendReadyNotice(orderId: number): Promise<SmsLog> {
  requireAuth()
  const db = getDb()
  const order = db
    .prepare(
      `SELECT o.id, o.customer_id, c.phone
       FROM orders o JOIN customers c ON c.id = o.customer_id
       WHERE o.id = ?`
    )
    .get(orderId) as { id: number; customer_id: number; phone: string } | undefined
  if (!order) throw new Error('Order not found')

  const message = `${shopName()}: Good news! Your order #${order.id} is ready for pickup. Please collect it at your convenience.`
  let status: SmsLog['status'] = 'stubbed'
  if (GATEWAY_ENABLED) {
    status = await dispatch(order.phone, message)
  }

  const res = db
    .prepare(
      `INSERT INTO sms_log (customer_id, order_id, message, type, status)
       VALUES (?, ?, ?, 'ready_notice', ?)`
    )
    .run(order.customer_id, order.id, message, status)

  return db
    .prepare(
      `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone
       FROM sms_log s JOIN customers c ON c.id = s.customer_id
       WHERE s.id = ?`
    )
    .get(Number(res.lastInsertRowid)) as SmsLog
}

export function listSms(): SmsLog[] {
  requireAuth()
  return getDb()
    .prepare(
      `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone
       FROM sms_log s JOIN customers c ON c.id = s.customer_id
       ORDER BY s.id DESC LIMIT 200`
    )
    .all() as SmsLog[]
}

export function gatewayEnabled(): boolean {
  return GATEWAY_ENABLED
}
