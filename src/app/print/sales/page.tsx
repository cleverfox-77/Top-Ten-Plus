'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { t, STATUS_LABELS, PAYMENT_LABELS } from '@/lib/labels'
import { bdt, fmtDate, reportRange } from '@/lib/format'
import type { Order, OrderFilters, OrderStatus, GarmentType } from '@/lib/types'
import { Spinner } from '@/components/ui'
import { PrintToolbar, ReportHeader } from '@/components/print'

function SalesReport(): JSX.Element {
  const sp = useSearchParams()
  const toast = useToast()
  const [rows, setRows] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const filters: OrderFilters = useMemo(
    () => ({
      from: sp.get('from') || null,
      to: sp.get('to') || null,
      garmentType: sp.get('garmentType') || null,
      paymentStatus: (sp.get('paymentStatus') as 'paid' | 'due' | null) || null,
      status: (sp.get('status') as OrderStatus | null) || null,
      createdBy: sp.get('createdBy') ? Number(sp.get('createdBy')) : null,
      search: sp.get('search') || null
    }),
    [sp]
  )

  useEffect(() => {
    api.orders
      .list(filters)
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [filters])

  const totalRevenue = rows.reduce((s, o) => s + o.total_price, 0)
  const totalPaid = rows.reduce((s, o) => s + o.amount_paid, 0)
  const totalDue = rows.reduce((s, o) => s + o.due_amount, 0)

  // Human summary of any non-date filters that were applied.
  const extra: string[] = []
  if (filters.garmentType) extra.push(t(filters.garmentType as GarmentType))
  if (filters.paymentStatus) extra.push(filters.paymentStatus === 'paid' ? 'fully paid' : 'has due')
  if (filters.status) extra.push(STATUS_LABELS[filters.status].split(' ')[0])
  if (filters.search) extra.push(`“${filters.search}”`)

  return (
    <div>
      <PrintToolbar backHref="/sales" />
      <div className="print-area card mx-auto max-w-5xl p-8">
        <ReportHeader
          title="Sales / Order History"
          subtitle={reportRange(filters.from, filters.to) + (extra.length ? ` · ${extra.join(', ')}` : '')}
        />

        {loading ? (
          <Spinner label="Loading…" />
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">
            No orders match these filters.
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="border-b-2 border-gray-300">
                <tr>
                  <th className="th">#</th>
                  <th className="th">Date</th>
                  <th className="th">Customer</th>
                  <th className="th">Phone</th>
                  <th className="th">Status</th>
                  <th className="th">Payment</th>
                  <th className="th text-right">Total</th>
                  <th className="th text-right">Paid</th>
                  <th className="th text-right">Due</th>
                  <th className="th">Taken by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td className="td font-semibold">#{o.id}</td>
                    <td className="td">{fmtDate(o.order_date)}</td>
                    <td className="td">{o.customer_name}</td>
                    <td className="td">{o.customer_phone}</td>
                    <td className="td">{STATUS_LABELS[o.status].split(' ')[0]}</td>
                    <td className="td">{PAYMENT_LABELS[o.payment_method]}</td>
                    <td className="td text-right">{bdt(o.total_price)}</td>
                    <td className="td text-right">{bdt(o.amount_paid)}</td>
                    <td className="td text-right">{bdt(o.due_amount)}</td>
                    <td className="td">{o.created_by_name}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-400 font-semibold">
                <tr>
                  <td className="td" colSpan={6}>
                    {rows.length} order{rows.length === 1 ? '' : 's'}
                  </td>
                  <td className="td text-right">{bdt(totalRevenue)}</td>
                  <td className="td text-right">{bdt(totalPaid)}</td>
                  <td className="td text-right">{bdt(totalDue)}</td>
                  <td className="td"></td>
                </tr>
              </tfoot>
            </table>
            <p className="mt-4 text-[10px] text-gray-400">
              For long date ranges, use the CSV/Excel export on the Sales History page — it stays
              readable where a multi-page printout does not.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function SalesPrintPage(): JSX.Element {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <SalesReport />
    </Suspense>
  )
}
