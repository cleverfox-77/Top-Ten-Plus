'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { fmtDateTime, reportRange } from '@/lib/format'
import { fromBase, round2 } from '@/lib/units'
import type { StockMovement, StockMovementFilters } from '@/lib/types'
import { Spinner } from '@/components/ui'
import { PrintToolbar, ReportHeader } from '@/components/print'

function ReturnsReport(): JSX.Element {
  const sp = useSearchParams()
  const toast = useToast()
  const [rows, setRows] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)

  const filters: StockMovementFilters = useMemo(
    () => ({ from: sp.get('from') || null, to: sp.get('to') || null, reason: 'return' }),
    [sp]
  )

  useEffect(() => {
    api.fabrics
      .stockMovements(filters)
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [filters])

  return (
    <div>
      <PrintToolbar backHref="/reports" />
      <div className="print-area card mx-auto max-w-4xl p-8">
        <ReportHeader title="Product Return Report" subtitle={reportRange(filters.from, filters.to)} />
        {loading ? (
          <Spinner label="Loading…" />
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">No returns in this period.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b-2 border-gray-300">
              <tr>
                <th className="th">When</th>
                <th className="th">Product</th>
                <th className="th text-right">Qty returned</th>
                <th className="th">Note</th>
                <th className="th">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((m) => {
                const u = m.fabric_unit ?? 'gaz'
                return (
                  <tr key={m.id}>
                    <td className="td whitespace-nowrap">{fmtDateTime(m.created_at)}</td>
                    <td className="td">{m.fabric_name}</td>
                    <td className="td text-right">
                      {round2(fromBase(m.change_amount, u))} {u}
                    </td>
                    <td className="td">{m.note || '—'}</td>
                    <td className="td">{m.created_by_name}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-gray-400 font-semibold">
              <tr>
                <td className="td" colSpan={5}>
                  {rows.length} returns
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}

export default function ReturnsPrintPage(): JSX.Element {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <ReturnsReport />
    </Suspense>
  )
}
