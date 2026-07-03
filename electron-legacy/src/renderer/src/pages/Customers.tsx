import { useEffect, useState } from 'react'
import { Search, UserPlus, Pencil } from 'lucide-react'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { t } from '@shared/labels'
import { fmtDate } from '../lib/format'
import type { Customer } from '@shared/types'
import { PageHeader, Modal, Field, EmptyState, Spinner } from '../components/ui'

export default function Customers(): JSX.Element {
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
    load()
  }, [])

  useEffect(() => {
    const id = setTimeout(() => load(search), 250)
    return () => clearTimeout(id)
  }, [search])

  const openNew = (): void => {
    setEditing(null)
    setOpen(true)
  }
  const openEdit = (c: Customer): void => {
    setEditing(c)
    setOpen(true)
  }

  return (
    <div>
      <PageHeader
        title={t('customers')}
        subtitle="Repeat customers are looked up by phone number"
        actions={
          <button className="btn-primary" onClick={openNew}>
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
                    <button className="btn-ghost" onClick={() => openEdit(c)}>
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

export function CustomerModal({
  open,
  customer,
  onClose,
  onSaved
}: {
  open: boolean
  customer: Customer | null
  onClose: () => void
  onSaved: (c: Customer) => void
}): JSX.Element {
  const toast = useToast()
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        name: customer?.name ?? '',
        phone: customer?.phone ?? '',
        address: customer?.address ?? '',
        notes: customer?.notes ?? ''
      })
    }
  }, [open, customer])

  const save = async (): Promise<void> => {
    setBusy(true)
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        address: form.address || null,
        notes: form.notes || null
      }
      const saved = customer
        ? await api.customers.update(customer.id, payload)
        : await api.customers.create(payload)
      toast.success(customer ? 'Customer updated' : 'Customer added')
      onSaved(saved)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={customer ? 'Edit customer' : 'New customer'}>
      <div className="space-y-4">
        <Field label={`${t('name')} *`}>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
          />
        </Field>
        <Field label={`${t('phone')} *`} hint="Used for SMS and to find repeat customers">
          <input
            className="input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label={t('address')}>
          <input
            className="input"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </Field>
        <Field label={t('notes')}>
          <textarea
            className="input"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? <Spinner /> : t('save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
