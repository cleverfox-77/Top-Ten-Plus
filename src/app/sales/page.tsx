'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Eye, Filter, Printer } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { t, STATUS_LABELS } from '@/lib/labels'
import { GARMENT_ORDER } from '@/lib/garments'
import { STATUS_FLOW } from '@/lib/status'
import { bdt, fmtDate } from '@/lib/format'
import type { Order, OrderStatus, GarmentType, User } from '@/lib/types'
import { PageHeader, EmptyState, Spinner } from '@/components/ui'

export default function SalesHistoryPage(): JSX.Element {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const router = useRouter()

  const [rows, setRows] = useState<Order[]>([])
  const [staff, setStaff] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState({
    from: '',
    to: '',
    garmentType: '' as GarmentType | '',
    paymentStatus: '' as 'paid' | 'due' | '',
    status: '' as OrderStatus | '',
    createdBy: '' as string,
    search: ''
  })

  const load = (): void => {
    setLoading(true)
    api.orders
      .list({
        from: f.from || null,
        to: f.to || null,
        garmentType: f.garmentType || null,
        paymentStatus: f.paymentStatus || null,
        status: f.status || null,
        createdBy: f.createdBy ? Number(f.createdBy) : null,
        search: f.search || null
      })
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (isAdmin) api.users.list().then(setStaff).catch(() => {})
  }, [isAdmin])

  useEffect(() => {
    const id = setTimeout(load, 200)
    return () => clearTimeout(id)
  }, [f])

  const totalRevenue = rows.reduce((s, o) => s + o.total_price, 0)
  const totalDue = rows.reduce((s, o) => s + o.due_amount, 0)

  const exportCsv = (): void => {
    if (rows.length === 0) {
      toast.info('Nothing to export')
      return
    }
    const data = rows.map((o) => ({
      order_id: o.id,
      order_date: fmtDate(o.order_date),
      delivery_date: fmtDate(o.expected_delivery_date),
      customer: o.customer_name,
      phone: o.customer_phone,
      status: STATUS_LABELS[o.status],
      payment_method: o.payment_method,
      total_price: o.total_price,
      amount_paid: o.amount_paid,
      due_amount: o.due_amount,
      taken_by: o.created_by_name
    }))
    if (api.app.exportSalesCsv(data)) toast.success('Exported to CSV')
  }

  const printReport = (): void => {
    const q = new URLSearchParams()
    if (f.from) q.set('from', f.from)
    if (f.to) q.set('to', f.to)
    if (f.garmentType) q.set('garmentType', f.garmentType)
    if (f.paymentStatus) q.set('paymentStatus', f.paymentStatus)
    if (f.status) q.set('status', f.status)
    if (f.createdBy) q.set('createdBy', f.createdBy)
    if (f.search) q.set('search', f.search)
    router.push(`/print/sales?${q.toString()}`)
  }

  return (
    <div>
      <PageHeader
        title={t('sales_history')}
        subtitle="Filter, review and export past orders"
        actions={
          <>
            <button className="btn-secondary" onClick={printReport}>
              <Printer size={18} /> Print
            </button>
            <button className="btn-secondary" onClick={exportCsv}>
              <Download size={18} /> Export CSV
            </button>
          </>
        }
      />

      <div className="card mb-4 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-600">
          <Filter size={16} /> Filters
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs text-gray-500">From</label>
            <input
              type="date"
              className="input"
              value={f.from}
              onChange={(e) => setF({ ...f, from: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">To</label>
            <input
              type="date"
              className="input"
              value={f.to}
              onChange={(e) => setF({ ...f, to: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Garment</label>
            <select
              className="input"
              value={f.garmentType}
              onChange={(e) => setF({ ...f, garmentType: e.target.value as GarmentType | '' })}
            >
              <option value="">All</option>
              {GARMENT_ORDER.map((g) => (
                <option key={g} value={g}>
                  {t(g)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Payment</label>
            <select
              className="input"
              value={f.paymentStatus}
              onChange={(e) => setF({ ...f, paymentStatus: e.target.value as 'paid' | 'due' | '' })}
            >
              <option value="">All</option>
              <option value="paid">Fully paid</option>
              <option value="due">Has due</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Status</label>
            <select
              className="input"
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value as OrderStatus | '' })}
            >
              <option value="">All</option>
              {STATUS_FLOW.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <div>
              <label className="mb-1 block text-xs text-gray-500">Sales manager</label>
              <select
                className="input"
                value={f.createdBy}
                onChange={(e) => setF({ ...f, createdBy: e.target.value })}
              >
                <option value="">All</option>
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-xs text-gray-500">Orders</div>
          <div className="text-xl font-bold">{rows.length}</div>
        </div>
        {isAdmin && (
          <div className="card p-4">
            <div className="text-xs text-gray-500">Total revenue</div>
            <div className="text-xl font-bold">{bdt(totalRevenue)}</div>
          </div>
        )}
        <div className="card p-4">
          <div className="text-xs text-gray-500">Total due</div>
          <div className="text-xl font-bold text-amber-700">{bdt(totalDue)}</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6">
            <Spinner label="Loading…" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState message="No orders match these filters." />
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">#</th>
                <th className="th">Date</th>
                <th className="th">Customer</th>
                <th className="th">Status</th>
                <th className="th text-right">Total</th>
                <th className="th text-right">Paid</th>
                <th className="th text-right">Due</th>
                <th className="th">Taken by</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="td font-semibold">#{o.id}</td>
                  <td className="td">{fmtDate(o.order_date)}</td>
                  <td className="td">{o.customer_name}</td>
                  <td className="td text-gray-600">{STATUS_LABELS[o.status]}</td>
                  <td className="td text-right">{bdt(o.total_price)}</td>
                  <td className="td text-right">{bdt(o.amount_paid)}</td>
                  <td className="td text-right text-amber-700">{bdt(o.due_amount)}</td>
                  <td className="td text-gray-500">{o.created_by_name}</td>
                  <td className="td text-right">
                    <button className="btn-ghost" onClick={() => router.push(`/orders/${o.id}`)}>
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
