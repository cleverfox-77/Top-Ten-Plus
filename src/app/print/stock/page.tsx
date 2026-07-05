'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { bdt, humanDate } from '@/lib/format'
import { fromBase, round2 } from '@/lib/units'
import type { Fabric } from '@/lib/types'
import { Spinner } from '@/components/ui'
import { PrintToolbar, ReportHeader } from '@/components/print'

export default function StockPrintPage(): JSX.Element {
  const toast = useToast()
  const [rows, setRows] = useState<Fabric[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.fabrics
      .list()
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  const stockValue = (f: Fabric): number =>
    (f.cost_price_per_unit ?? 0) * fromBase(f.quantity_base, f.unit)
  const totalValue = round2(rows.reduce((s, f) => s + stockValue(f), 0))

  return (
    <div>
      <PrintToolbar backHref="/reports" />
      <div className="print-area card mx-auto max-w-5xl p-8">
        <ReportHeader title="Stock Report" subtitle={`current stock — generated ${humanDate(new Date())}`} />
        {loading ? (
          <Spinner label="Loading…" />
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">No fabrics.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b-2 border-gray-300">
              <tr>
                <th className="th">Barcode</th>
                <th className="th">Name</th>
                <th className="th">Color</th>
                <th className="th text-right">In stock</th>
                <th className="th text-right">Cost/unit</th>
                <th className="th text-right">Sell/unit</th>
                <th className="th text-right">Stock value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((f) => {
                const qty = round2(fromBase(f.quantity_base, f.unit))
                const low = f.low_stock_threshold > 0 && f.quantity_base <= f.low_stock_threshold
                return (
                  <tr key={f.id}>
                    <td className="td font-mono text-xs">{f.product_id}</td>
                    <td className="td">{f.name}</td>
                    <td className="td">{f.color || '—'}</td>
                    <td className={`td text-right ${low ? 'font-semibold text-amber-700' : ''}`}>
                      {qty} {f.unit}
                    </td>
                    <td className="td text-right">{f.cost_price_per_unit != null ? bdt(f.cost_price_per_unit) : '—'}</td>
                    <td className="td text-right">{f.selling_price_per_unit != null ? bdt(f.selling_price_per_unit) : '—'}</td>
                    <td className="td text-right">{bdt(stockValue(f))}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-gray-400 font-semibold">
              <tr>
                <td className="td" colSpan={6}>
                  {rows.length} products
                </td>
                <td className="td text-right">{bdt(totalValue)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
