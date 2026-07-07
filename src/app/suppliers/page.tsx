'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, UserPlus, Pencil, Eye, Printer } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { t } from '@/lib/labels'
import { bdt, fmtDateTime } from '@/lib/format'
import { withMeter } from '@/lib/units'
import type { Supplier, SupplierDetail } from '@/lib/types'
import { PageHeader, Modal, EmptyState, Spinner } from '@/components/ui'
import { Barcode } from '@/components/print'
import SupplierModal from '@/components/SupplierModal'

export default function SuppliersPage(): JSX.Element {
  const toast = useToast()
  const [rows, setRows] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<SupplierDetail | null>(null)

  const load = (q = ''): void => {
    setLoading(true)
    api.suppliers
      .list(q)
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const id = setTimeout(() => load(search), 250)
    return () => clearTimeout(id)
  }, [search])

  const openDetail = (id: number): void => {
    api.suppliers.detail(id).then((d) => d && setDetail(d)).catch((e) => toast.error(e.message))
  }

  return (
    <div>
      <PageHeader
        title={t('suppliers')}
        subtitle="Who supplies your fabrics, and their cash vs due totals"
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <UserPlus size={18} /> {t('add')}
          </button>
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
        <input
          className="input pl-9"
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6">
            <Spinner label="Loading…" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState message="No suppliers yet. Add one, or add a supplier while receiving stock." />
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">{t('name')}</th>
                <th className="th">{t('phone')}</th>
                <th className="th">{t('address')}</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="td font-medium">{s.name}</td>
                  <td className="td">{s.phone || '—'}</td>
                  <td className="td text-gray-500">{s.address || '—'}</td>
                  <td className="td text-right">
                    <button className="btn-ghost" onClick={() => openDetail(s.id)}>
                      <Eye size={16} /> Details
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        setEditing(s)
                        setOpen(true)
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SupplierModal
        open={open}
        supplier={editing}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false)
          load(search)
        }}
      />

      {detail && <SupplierDetailModal detail={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function SupplierDetailModal({
  detail,
  onClose
}: {
  detail: SupplierDetail
  onClose: () => void
}): JSX.Element {
  const router = useRouter()
  return (
    <Modal open onClose={onClose} title={detail.name} width="max-w-3xl">
      <div className="mb-3 flex justify-end">
        <button
          className="btn-secondary"
          onClick={() => router.push(`/print/supplier/${detail.id}`)}
        >
          <Printer size={16} /> Print details
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <div className="card p-3">
          <div className="text-xs text-gray-500">Total received (value)</div>
          <div className="text-lg font-bold">{bdt(detail.total_received_value)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-gray-500">Paid (cash)</div>
          <div className="text-lg font-bold text-green-700">{bdt(detail.cash_total)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-gray-500">On due</div>
          <div className="text-lg font-bold text-amber-700">{bdt(detail.due_total)}</div>
        </div>
      </div>

      {detail.phone && <p className="mb-1 text-sm text-gray-600">Phone: {detail.phone}</p>}
      {detail.address && <p className="mb-3 text-sm text-gray-600">Address: {detail.address}</p>}

      <div className="mb-4">
        <div className="mb-1 text-sm font-semibold text-gray-700">Products supplied</div>
        {detail.fabrics_supplied.length === 0 ? (
          <p className="text-sm text-gray-400">No receivings recorded.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {detail.fabrics_supplied.map((f) => (
              <span key={f.fabric_id} className="badge bg-gray-100 text-gray-700">
                {f.name} · {f.receivings}×
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mb-1 text-sm font-semibold text-gray-700">Receiving history</div>
      {detail.receivings.length === 0 ? (
        <p className="text-sm text-gray-400">Nothing received yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200">
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
                  <td className="td whitespace-nowrap text-gray-500">{fmtDateTime(r.created_at)}</td>
                  <td className="td">{r.fabric_name}</td>
                  <td className="td">
                    {r.fabric_product_id ? (
                      <Barcode value={r.fabric_product_id} height={26} className="max-h-9" />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="td font-mono text-xs">{r.challan_number || '—'}</td>
                  <td className="td text-right">{withMeter(r.change_amount, unit)}</td>
                  <td className="td text-right">{r.unit_cost != null ? bdt(r.unit_cost) : '—'}</td>
                  <td className="td">
                    <span
                      className={`badge ${
                        r.payment_type === 'due'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {r.payment_type === 'due' ? 'Due' : 'Cash'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Modal>
  )
}
