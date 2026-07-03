'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { t } from '@/lib/labels'
import type { Customer } from '@/lib/types'
import { Modal, Field, Spinner } from '@/components/ui'

export default function CustomerModal({
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
