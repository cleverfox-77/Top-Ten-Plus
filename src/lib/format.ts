const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']

/** Convert every Western digit in the value to a Bengali digit, leaving
 *  everything else (separators, letters, '-', '.') untouched. Used on the
 *  Bengali job card so numbers and dates read in Bangla. */
export function toBnDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return ''
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)])
}

export function bdt(amount: number | null | undefined): string {
  const n = amount ?? 0
  return `৳ ${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  // Values are stored as YYYY-MM-DD (dates) or datetime; show the date part.
  return d.slice(0, 10)
}

/** Date + time for receipts, e.g. "2026-07-04 3:42 PM". Accepts a datetime string. */
export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—'
  // Postgres timestamps come back as "YYYY-MM-DD HH:MM:SS" (localtime).
  const iso = d.includes('T') ? d : d.replace(' ', 'T')
  const date = new Date(iso)
  if (isNaN(date.getTime())) return d
  const day = d.slice(0, 10)
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day} ${time}`
}

export function todayStr(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

/** Human-readable date like "4 Jul 2026" for report headers. */
export function humanDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d.slice(0, 10) + 'T00:00:00') : d
  if (isNaN(date.getTime())) return String(d)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Current local date + time, e.g. "4 Jul 2026, 3:42 PM" — for "printed at" lines. */
export function nowDateTime(): string {
  const d = new Date()
  return `${humanDate(d)}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

/** Builds a report subtitle: "1 Jul to 30 Jul 2026 — generated 4 Jul 2026". */
export function reportRange(from?: string | null, to?: string | null): string {
  const generated = `generated ${humanDate(new Date())}`
  if (from && to) return `${humanDate(from)} to ${humanDate(to)} — ${generated}`
  if (from) return `from ${humanDate(from)} — ${generated}`
  if (to) return `up to ${humanDate(to)} — ${generated}`
  return `all dates — ${generated}`
}
