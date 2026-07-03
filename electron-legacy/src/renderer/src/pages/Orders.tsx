import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Eye, PlusCircle } from 'lucide-react'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { t, STATUS_LABELS } from '@shared/labels'
import { STATUS_TONE, STATUS_FLOW } from '../lib/status'
import { bdt, fmtDate } from '../lib/format'
import type { Order, OrderStatus } from '@shared/types'
import { PageHeader, EmptyState, Spinner, StatusBadge } from '../components/ui'

export default function Orders(): JSX.Element {
  const toast = useToast()
  const navigate = useNavigate()
  const [rows, setRows] = useState<(Order & { item_summary?: string })[]>([])
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = (): void => {
    setLoading(true)
    api.orders
      .list({ status: status || null, search: search || null })
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const id = setTimeout(load, 200)
    return () => clearTimeout(id)
  }, [status, search])

  const changeStatus = async (id: number, s: OrderStatus): Promise<void> => {
    try {
      await api.orders.updateStatus(id, s)
      toast.success(`Order #${id} → ${STATUS_LABELS[s]}`)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  return (
    <div>
      <PageHeader
        title={t('orders')}
        subtitle="Work queue — track and update each order's status"
        actions={
          <button className="btn-primary" onClick={() => navigate('/orders/new')}>
            <PlusCircle size={18} /> {t('new_order')}
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input
            className="input pl-9"
            placeholder="Search by customer, phone or order #…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-52"
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus | '')}
        >
          <option value="">All statuses</option>
          {STATUS_FLOW.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6">
            <Spinner label="Loading…" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState message="No orders match." />
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">#</th>
                <th className="th">{t('customers')}</th>
                <th className="th">Items</th>
                <th className="th">{t('order_date')}</th>
                <th className="th">{t('delivery_date')}</th>
                <th className="th text-right">{t('total_price')}</th>
                <th className="th text-right">{t('due_amount')}</th>
                <th className="th">{t('status')}</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="td font-semibold">#{o.id}</td>
                  <td className="td">
                    <div className="font-medium">{o.customer_name}</div>
                    <div className="text-xs text-gray-500">{o.customer_phone}</div>
                  </td>
                  <td className="td text-gray-600">{o.item_summary}</td>
                  <td className="td">{fmtDate(o.order_date)}</td>
                  <td className="td">{fmtDate(o.expected_delivery_date)}</td>
                  <td className="td text-right">{bdt(o.total_price)}</td>
                  <td className="td text-right">
                    {o.due_amount > 0 ? (
                      <span className="font-medium text-amber-700">{bdt(o.due_amount)}</span>
                    ) : (
                      <StatusBadge label="Paid" tone="green" />
                    )}
                  </td>
                  <td className="td">
                    <select
                      className="rounded-md border border-gray-200 px-2 py-1 text-xs"
                      value={o.status}
                      onChange={(e) => changeStatus(o.id, e.target.value as OrderStatus)}
                    >
                      {STATUS_FLOW.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="td text-right">
                    <button className="btn-ghost" onClick={() => navigate(`/orders/${o.id}`)}>
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-right text-xs text-gray-400">
        Status colours: {STATUS_FLOW.map((s) => (
          <span key={s} className="ml-2">
            <StatusBadge label={STATUS_LABELS[s].split(' ')[0]} tone={STATUS_TONE[s]} />
          </span>
        ))}
      </p>
    </div>
  )
}
