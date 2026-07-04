// SMS is stubbed for v1 (plan §9). Messages are composed and logged so the notify
// workflow + history work end-to-end; swapping in a real Bangladesh gateway
// (BulkSMSBD / MiMSMS / Alpha SMS / sms.bd) means implementing `dispatch()` and
// flipping GATEWAY_ENABLED. Non-async helpers live here (not in a 'use server'
// file, which may only export async functions).

export const GATEWAY_ENABLED = false
const SHOP = 'New Top Ten Plus'

export async function dispatch(_phone: string, _message: string): Promise<'sent' | 'failed'> {
  // TODO Phase 2: POST to the chosen gateway's REST API here.
  return 'sent'
}

export function buildConfirmationMessage(
  orderId: number,
  totalPrice: number,
  deliveryDate: string | null
): string {
  const delivery = deliveryDate ? ` Expected delivery: ${deliveryDate}.` : ''
  return `${SHOP}: Your order #${orderId} has been received. Total: ${totalPrice} BDT.${delivery} Thank you!`
}

export function buildReadyMessage(orderId: number): string {
  return `${SHOP}: Good news! Your order #${orderId} is ready for pickup. Please collect it at your convenience.`
}
