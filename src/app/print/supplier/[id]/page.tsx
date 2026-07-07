'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { t } from '@/lib/labels'
import { withMeter } from '@/lib/units'
import { bdt, fmtDateTime, nowDateTime } from '@/lib/format'
import type { SupplierDetail } from '@/lib/types'
import { Spinner } from '@/components/ui'
import { PrintToolbar, ReportHeader, Barcode, DISCLAIMER } from '@/components/print'

export default function SupplierPrint(): JSX.Element {
  const params = useParams<{ id: string }>()
  const supplierId = Number(params.id)
  const toast = useToast()
  const [detail, setDetail] = useState<SupplierDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.suppliers
      .detail(supplierId)
      .then((d) => setDetail(d ?? null))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [supplierId])

  if (loading) return <Spinner label="Loading supplier…" />
  if (!detail) return <div className="p-6 text-gray-500">Supplier not found.</div>

  return (
    <div>
      <PrintToolbar backHref="/suppliers" />
      <div className="print-area card mx-auto max-w-4xl p-8">
        <ReportHeader title="Supplier Details" subtitle={`generated ${nowDateTime()}`} />

        <div className="mb-4">
          <div className="text-lg font-bold text-gray-900">{detail.name}</div>
          {detail.phone && <div className="text-sm text-gray-600">Phone: {detail.phone}</div>}
          {detail.address && <div className="text-sm text-gray-600">Address: {detail.address}</div>}
          {detail.notes && <div className="text-sm text-gray-600">Notes: {detail.notes}</div>}
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Total received (value)</div>
            <div className="text-lg font-bold">{bdt(detail.total_received_value)}</div>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Paid (cash)</div>
            <div className="text-lg font-bold text-green-700">{bdt(detail.cash_total)}</div>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">On due</div>
            <div className="text-lg font-bold text-amber-700">{bdt(detail.due_total)}</div>
          </div>
        </div>

        <div className="mb-1 text-sm font-semibold text-gray-700">Receiving history</div>
        {detail.receivings.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing received yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b-2 border-gray-300">
              <tr>
                <th className="th">When</th>
                <th className="th">Fabric</th>
                <th className="th">Barcode</th>
                <th className="th">{t('challan')}</th>
                <th className="th text-right">Qty</th>
                <th className="th text-right">Cost/unit</th>
                <th className="th">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {detail.receivings.map((r) => {
                const unit = r.fabric_unit ?? 'gaz'
                return (
                  <tr key={r.id}>
                    <td className="td whitespace-nowrap text-gray-500">
                      {fmtDateTime(r.created_at)}
                    </td>
                    <td className="td font-medium">{r.fabric_name}</td>
                    <td className="td">
                      {r.fabric_product_id ? (
                        <Barcode value={r.fabric_product_id} height={26} className="max-h-9" />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="td font-mono text-xs">{r.challan_number || '—'}</td>
                    <td className="td text-right">{withMeter(r.change_amount, unit)}</td>
                    <td className="td text-right">
                      {r.unit_cost != null ? bdt(r.unit_cost) : '—'}
                    </td>
                    <td className="td">{r.payment_type === 'due' ? 'Due' : 'Cash'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        <div className="mt-6 border-t border-dashed border-gray-300 pt-2 text-center text-[10px] text-gray-400">
          New Top Ten Plus · {DISCLAIMER}
        </div>
      </div>
    </div>
  )
}
