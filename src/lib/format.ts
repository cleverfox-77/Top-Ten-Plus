export function bdt(amount: number | null | undefined): string {
  const n = amount ?? 0
  return `৳ ${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  // Values are stored as YYYY-MM-DD (dates) or datetime; show the date part.
  return d.slice(0, 10)
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

/** Builds a report subtitle: "1 Jul to 30 Jul 2026 — generated 4 Jul 2026". */
export function reportRange(from?: string | null, to?: string | null): string {
  const generated = `generated ${humanDate(new Date())}`
  if (from && to) return `${humanDate(from)} to ${humanDate(to)} — ${generated}`
  if (from) return `from ${humanDate(from)} — ${generated}`
  if (to) return `up to ${humanDate(to)} — ${generated}`
  return `all dates — ${generated}`
}
