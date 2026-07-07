'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { fromBase, round2, withMeter } from '@/lib/units'
import { bdt, nowDateTime } from '@/lib/format'
import type { Fabric } from '@/lib/types'
import { Spinner } from '@/components/ui'
import { PrintToolbar, ReportHeader, DISCLAIMER } from '@/components/print'

function StockChalan(): JSX.Element {
  const sp = useSearchParams()
  const toast = useToast()
  const [rows, setRows] = useState<Fabric[]>([])
  const [loading, setLoading] = useState(true)

  const ids = useMemo(
    () =>
      (sp.get('ids') || '')
        .split(',')
        .map((s) => Number(s))
        .filter((n) => Number.isInteger(n) && n > 0),
    [sp]
  )
  const challan = sp.get('challan') || ''

  useEffect(() => {
    if (ids.length === 0) {
      setLoading(false)
      return
    }
    Promise.all(ids.map((id) => api.fabrics.get(id)))
      .then((res) => setRows(res.filter((f): f is Fabric => Boolean(f))))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [ids])

  const lineTotal = (f: Fabric): number =>
    (f.cost_price_per_unit ?? 0) * round2(fromBase(f.quantity_base, f.unit))
  const grandTotal = round2(rows.reduce((s, f) => s + lineTotal(f), 0))

  return (
    <div>
      <PrintToolbar backHref="/stock" />
      <div className="print-area card mx-auto max-w-4xl p-8">
        <ReportHeader title="Stock Chalan Copy" subtitle={`generated ${nowDateTime()}`} />

        <div className="mb-4 flex justify-between text-sm">
          <div>
            <span className="text-gray-500">Chalan / Stock No.: </span>
            <span className="font-semibold">{challan || '—'}</span>
          </div>
          <div>
            <span className="text-gray-500">Items: </span>
            <span className="font-semibold">{rows.length}</span>
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading…" />
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">No items to show.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b-2 border-gray-300">
              <tr>
                <th className="th">#</th>
                <th className="th">Product ID / Barcode</th>
                <th className="th">Name</th>
                <th className="th">Color</th>
                <th className="th text-right">Quantity</th>
                <th className="th text-right">Cost/unit</th>
                <th className="th text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((f, i) => (
                <tr key={f.id}>
                  <td className="td">{i + 1}</td>
                  <td className="td font-mono text-xs">{f.product_id}</td>
                  <td className="td font-medium">{f.name}</td>
                  <td className="td text-gray-500">{f.color || '—'}</td>
                  <td className="td text-right">{withMeter(f.quantity_base, f.unit)}</td>
                  <td className="td text-right">
                    {f.cost_price_per_unit != null ? bdt(f.cost_price_per_unit) : '—'}
                  </td>
                  <td className="td text-right">{bdt(lineTotal(f))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-400 font-semibold">
              <tr>
                <td className="td" colSpan={6}>
                  Grand total
                </td>
                <td className="td text-right">{bdt(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        <div className="mt-10 flex justify-between text-xs text-gray-500">
          <div className="border-t border-gray-400 pt-1">Received by</div>
          <div className="border-t border-gray-400 pt-1">Authorised signature</div>
        </div>

        <div className="mt-6 border-t border-dashed border-gray-300 pt-2 text-center text-[10px] text-gray-400">
          {DISCLAIMER}
        </div>
      </div>
    </div>
  )
}

export default function StockChalanPage(): JSX.Element {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <StockChalan />
    </Suspense>
  )
}
