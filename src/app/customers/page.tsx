'use client'

import { useEffect, useState } from 'react'
import { Search, UserPlus, Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { t } from '@/lib/labels'
import { fmtDate } from '@/lib/format'
import type { Customer } from '@/lib/types'
import { PageHeader, EmptyState, Spinner } from '@/components/ui'
import CustomerModal from '@/components/CustomerModal'

export default function CustomersPage(): JSX.Element {
  const toast = useToast()
  const [rows, setRows] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [open, setOpen] = useState(false)

  const load = (q = ''): void => {
    setLoading(true)
    api.customers
      .list(q)
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const id = setTimeout(() => load(search), 250)
    return () => clearTimeout(id)
  }, [search])

  return (
    <div>
      <PageHeader
        title={t('customers')}
        subtitle="Repeat customers are looked up by phone number"
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

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input
            className="input pl-9"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6">
            <Spinner label="Loading…" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState message="No customers yet. Add your first customer to get started." />
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">{t('name')}</th>
                <th className="th">{t('phone')}</th>
                <th className="th">{t('address')}</th>
                <th className="th">Since</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="td font-medium">{c.name}</td>
                  <td className="td">{c.phone}</td>
                  <td className="td text-gray-500">{c.address || '—'}</td>
                  <td className="td text-gray-500">{fmtDate(c.created_at)}</td>
                  <td className="td text-right">
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        setEditing(c)
                        setOpen(true)
                      }}
                    >
                      <Pencil size={16} /> {t('edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CustomerModal
        open={open}
        customer={editing}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false)
          load(search)
        }}
      />
    </div>
  )
}
