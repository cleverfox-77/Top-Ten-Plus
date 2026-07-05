'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { t } from '@/lib/labels'
import { bdt, fmtDateTime, reportRange } from '@/lib/format'
import { fromBase, round2 } from '@/lib/units'
import type { StockMovement, StockMovementFilters } from '@/lib/types'
import { Spinner } from '@/components/ui'
import { PrintToolbar, ReportHeader } from '@/components/print'

function ReceivingReport(): JSX.Element {
  const sp = useSearchParams()
  const toast = useToast()
  const [rows, setRows] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)

  const filters: StockMovementFilters = useMemo(
    () => ({
      from: sp.get('from') || null,
      to: sp.get('to') || null,
      supplierId: sp.get('supplierId') ? Number(sp.get('supplierId')) : null,
      reason: 'new_stock'
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

  const value = (m: StockMovement): number =>
    (m.unit_cost ?? 0) * fromBase(m.change_amount, m.fabric_unit ?? 'gaz')
  const total = round2(rows.reduce((s, m) => s + value(m), 0))
  const cash = round2(rows.filter((m) => m.payment_type !== 'due').reduce((s, m) => s + value(m), 0))
  const due = round2(rows.filter((m) => m.payment_type === 'due').reduce((s, m) => s + value(m), 0))

  return (
    <div>
      <PrintToolbar backHref="/reports" />
      <div className="print-area card mx-auto max-w-5xl p-8">
        <ReportHeader title="Stock Receiving Report" subtitle={reportRange(filters.from, filters.to)} />
        {loading ? (
          <Spinner label="Loading…" />
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">No receivings in this period.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b-2 border-gray-300">
              <tr>
                <th className="th">When</th>
                <th className="th">{t('challan')}</th>
                <th className="th">Fabric</th>
                <th className="th">{t('supplier')}</th>
                <th className="th text-right">Qty</th>
                <th className="th text-right">Cost/unit</th>
                <th className="th text-right">Value</th>
                <th className="th">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((m) => {
                const u = m.fabric_unit ?? 'gaz'
                return (
                  <tr key={m.id}>
                    <td className="td whitespace-nowrap">{fmtDateTime(m.created_at)}</td>
                    <td className="td font-mono text-xs">{m.challan_number || '—'}</td>
                    <td className="td">{m.fabric_name}</td>
                    <td className="td">{m.supplier_name || '—'}</td>
                    <td className="td text-right">
                      {round2(fromBase(m.change_amount, u))} {u}
                    </td>
                    <td className="td text-right">{m.unit_cost != null ? bdt(m.unit_cost) : '—'}</td>
                    <td className="td text-right">{bdt(value(m))}</td>
                    <td className="td">{m.payment_type === 'due' ? 'Due' : 'Cash'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-gray-400 font-semibold">
              <tr>
                <td className="td" colSpan={6}>
                  {rows.length} receivings · Cash {bdt(cash)} · Due {bdt(due)}
                </td>
                <td className="td text-right">{bdt(total)}</td>
                <td className="td"></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}

export default function ReceivingPrintPage(): JSX.Element {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <ReceivingReport />
    </Suspense>
  )
}
