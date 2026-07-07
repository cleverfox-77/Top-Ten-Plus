// Real SMS delivery via sms.net.bd. The gateway turns on automatically once the
// SMS_API_KEY env var is present; without it, messages are still composed and
// logged (status "stubbed") so the notify workflow + history keep working.
// Non-async helpers live here (not in a 'use server' file, which may only export
// async functions).

const SMS_ENDPOINT = 'https://api.sms.net.bd/sendsms'

// Shop identity shown inside every customer SMS (Bangla).
const SHOP_LINE = 'NEW TOP TEN PLUS, কাজির মোড়, পুরান বাজার, মাদারীপুর'
const SHOP_PHONE = '📞 ০১৭২০-৯১১৩৫২'

export const GATEWAY_ENABLED = Boolean(process.env.SMS_API_KEY)

/** Normalise a Bangladeshi mobile number to the 8801XXXXXXXXX form the gateway
 *  expects (accepts 01…, +8801…, 8801…, 1…). */
function normalizeBdPhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.startsWith('880')) return d
  if (d.startsWith('0')) return '880' + d.slice(1)
  if (d.length === 10 && d.startsWith('1')) return '880' + d
  return d
}

/** Send one SMS through sms.net.bd. Returns 'sent' on a successful submit,
 *  'failed' otherwise (never throws — SMS is best-effort). */
export async function dispatch(phone: string, message: string): Promise<'sent' | 'failed'> {
  const apiKey = process.env.SMS_API_KEY
  if (!apiKey) return 'failed'
  try {
    const body = new URLSearchParams({
      api_key: apiKey,
      msg: message,
      to: normalizeBdPhone(phone)
    })
    const res = await fetch(SMS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store'
    })
    const json = (await res.json().catch(() => null)) as { error?: number } | null
    return json && json.error === 0 ? 'sent' : 'failed'
  } catch {
    return 'failed'
  }
}

// ---- Message templates (Bangla) ----

export function buildConfirmationMessage(
  _orderId: number,
  _totalPrice?: number,
  _deliveryDate?: string | null
): string {
  return `প্রিয় গ্রাহক, আপনার অর্ডারটি গ্রহণ করা হয়েছে। ${SHOP_LINE}-এ অর্ডার করার জন্য ধন্যবাদ। ${SHOP_PHONE}।`
}

export function buildReadyMessage(_orderId: number): string {
  return `প্রিয় গ্রাহক, আপনার অর্ডারকৃত পোশাক প্রস্তুত। অনুগ্রহ করে ${SHOP_LINE} থেকে সংগ্রহ করুন। ${SHOP_PHONE}। ধন্যবাদ।`
}

export function buildDeliveredMessage(_orderId: number): string {
  return `প্রিয় গ্রাহক, আপনার অর্ডারকৃত পোশাক সফলভাবে ডেলিভারি হয়েছে। ${SHOP_LINE}-এ কেনাকাটার জন্য ধন্যবাদ। ${SHOP_PHONE}।`
}
