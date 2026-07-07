'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { withMeter } from '@/lib/units'
import { fmtDateTime, reportRange } from '@/lib/format'
import type { StockMovement, StockMovementFilters } from '@/lib/types'
import { Spinner } from '@/components/ui'
import { PrintToolbar, ReportHeader } from '@/components/print'

const REASONS: Record<string, string> = {
  new_stock: 'New stock',
  order_deduction: 'Order deduction',
  correction: 'Correction',
  return: 'Return'
}

function StockHistoryReport(): JSX.Element {
  const sp = useSearchParams()
  const toast = useToast()
  const [rows, setRows] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)

  const filters: StockMovementFilters = useMemo(
    () => ({
      from: sp.get('from') || null,
      to: sp.get('to') || null,
      fabricId: sp.get('fabricId') ? Number(sp.get('fabricId')) : null,
      reason: (sp.get('reason') as StockMovement['reason'] | null) || null
    }),
    [sp]
  )

  useEffect(() => {
    api.fabrics
      .stockMovements(filters)
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [filters])

  const extra: string[] = []
  if (filters.reason) extra.push(REASONS[filters.reason])
  if (rows.length && filters.fabricId) extra.push(rows[0].fabric_name ?? '')

  return (
    <div>
      <PrintToolbar backHref="/stock-history" />
      <div className="print-area card mx-auto max-w-4xl p-8">
        <ReportHeader
          title="Stock Movement History"
          subtitle={reportRange(filters.from, filters.to) + (extra.length ? ` · ${extra.join(', ')}` : '')}
        />

        {loading ? (
          <Spinner label="Loading…" />
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">No stock movements match.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b-2 border-gray-300">
              <tr>
                <th className="th">Date</th>
                <th className="th">Fabric</th>
                <th className="th">Reason</th>
                <th className="th text-right">Change</th>
                <th className="th">Order</th>
                <th className="th">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((m) => {
                const unit = m.fabric_unit ?? 'gaz'
                return (
                  <tr key={m.id}>
                    <td className="td whitespace-nowrap">{fmtDateTime(m.created_at)}</td>
                    <td className="td font-medium">{m.fabric_name}</td>
                    <td className="td">{REASONS[m.reason]}</td>
                    <td className={`td text-right ${m.change_amount < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {m.change_amount < 0 ? '' : '+'}
                      {withMeter(m.change_amount, unit)}
                    </td>
                    <td className="td">{m.reference_order_id ? `#${m.reference_order_id}` : '—'}</td>
                    <td className="td">{m.created_by_name}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default function StockHistoryPrintPage(): JSX.Element {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <StockHistoryReport />
    </Suspense>
  )
}
