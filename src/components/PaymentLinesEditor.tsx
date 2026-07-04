'use client'

import { Plus, Trash2 } from 'lucide-react'
import { PAYMENT_LABELS } from '@/lib/labels'
import type { PaymentMethod, PaymentLine } from '@/lib/types'

// Editor for one or more payment lines, so a payment can be split across
// cash + card/MFS (bKash / Nagad / Rocket). Amounts are held as strings while
// editing and converted on submit.
export interface PayLine {
  method: PaymentMethod
  amount: string
}

export function newPayLine(method: PaymentMethod = 'cash', amount = ''): PayLine {
  return { method, amount }
}

export function payTotal(lines: PayLine[]): number {
  return lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
}

export function toPaymentLines(lines: PayLine[]): PaymentLine[] {
  return lines
    .filter((l) => Number(l.amount) > 0)
    .map((l) => ({ method: l.method, amount: Number(l.amount) }))
}

export function PaymentLinesEditor({
  lines,
  onChange
}: {
  lines: PayLine[]
  onChange: (lines: PayLine[]) => void
}): JSX.Element {
  const update = (i: number, patch: Partial<PayLine>): void =>
    onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const remove = (i: number): void => onChange(lines.filter((_, idx) => idx !== i))
  const add = (): void => onChange([...lines, newPayLine('bkash')])

  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            className="input w-32 shrink-0"
            value={l.method}
            onChange={(e) => update(i, { method: e.target.value as PaymentMethod })}
          >
            {Object.keys(PAYMENT_LABELS).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABELS[m]}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="input flex-1 text-right"
            placeholder="0"
            value={l.amount}
            onChange={(e) => update(i, { amount: e.target.value })}
          />
          {lines.length > 1 && (
            <button
              type="button"
              className="btn-ghost shrink-0 px-2 text-red-600"
              onClick={() => remove(i)}
              title="Remove"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
        onClick={add}
      >
        <Plus size={12} /> Split / add another method
      </button>
    </div>
  )
}
