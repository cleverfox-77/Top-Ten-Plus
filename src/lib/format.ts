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
