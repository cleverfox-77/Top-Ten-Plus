'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Filter, Printer } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { t } from '@/lib/labels'
import { fromBase, round2 } from '@/lib/units'
import { fmtDateTime } from '@/lib/format'
import type { Fabric, StockMovement } from '@/lib/types'
import { PageHeader, EmptyState, Spinner } from '@/components/ui'

const REASONS: Record<string, string> = {
  new_stock: 'New stock',
  order_deduction: 'Order deduction',
  correction: 'Correction',
  return: 'Return'
}

export default function StockHistoryPage(): JSX.Element {
  const toast = useToast()
  const router = useRouter()
  const [rows, setRows] = useState<StockMovement[]>([])
  const [fabrics, setFabrics] = useState<Fabric[]>([])
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState({ from: '', to: '', fabricId: '', reason: '' })

  useEffect(() => {
    api.fabrics.list().then(setFabrics).catch(() => {})
  }, [])

  const load = (): void => {
    setLoading(true)
    api.fabrics
      .stockMovements({
        from: f.from || null,
        to: f.to || null,
        fabricId: f.fabricId ? Number(f.fabricId) : null,
        reason: (f.reason as StockMovement['reason']) || null
      })
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const id = setTimeout(load, 200)
    return () => clearTimeout(id)
  }, [f])

  const goPrint = (): void => {
    const q = new URLSearchParams()
    if (f.from) q.set('from', f.from)
    if (f.to) q.set('to', f.to)
    if (f.fabricId) q.set('fabricId', f.fabricId)
    if (f.reason) q.set('reason', f.reason)
    router.push(`/print/stock-history?${q.toString()}`)
  }

  return (
    <div>
      <PageHeader
        title="Stock History"
        subtitle="Audit trail of every stock change (intake, order use, corrections)"
        actions={
          <button className="btn-secondary" onClick={goPrint}>
            <Printer size={18} /> Print
          </button>
        }
      />

      <div className="card mb-4 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-600">
          <Filter size={16} /> Filters
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
            <label className="mb-1 block text-xs text-gray-500">{t('fabrics')}</label>
            <select
              className="input"
              value={f.fabricId}
              onChange={(e) => setF({ ...f, fabricId: e.target.value })}
            >
              <option value="">All</option>
              {fabrics.map((fb) => (
                <option key={fb.id} value={fb.id}>
                  {fb.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Reason</label>
            <select
              className="input"
              value={f.reason}
              onChange={(e) => setF({ ...f, reason: e.target.value })}
            >
              <option value="">All</option>
              {Object.keys(REASONS).map((r) => (
                <option key={r} value={r}>
                  {REASONS[r]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6">
            <Spinner label="Loading…" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState message="No stock movements match these filters." />
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
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
                const change = round2(fromBase(m.change_amount, unit))
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="td whitespace-nowrap text-gray-500">{fmtDateTime(m.created_at)}</td>
                    <td className="td font-medium">{m.fabric_name}</td>
                    <td className="td text-gray-600">{REASONS[m.reason]}</td>
                    <td
                      className={`td text-right font-medium ${
                        m.change_amount < 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {m.change_amount < 0 ? '' : '+'}
                      {change} {unit}
                    </td>
                    <td className="td">{m.reference_order_id ? `#${m.reference_order_id}` : '—'}</td>
                    <td className="td text-gray-500">{m.created_by_name}</td>
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
