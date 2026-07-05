'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { t } from '@/lib/labels'
import type { Supplier } from '@/lib/types'
import { Modal, Field, Spinner } from '@/components/ui'

export default function SupplierModal({
  open,
  supplier,
  onClose,
  onSaved
}: {
  open: boolean
  supplier: Supplier | null
  onClose: () => void
  onSaved: (s: Supplier) => void
}): JSX.Element {
  const toast = useToast()
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        name: supplier?.name ?? '',
        phone: supplier?.phone ?? '',
        address: supplier?.address ?? '',
        notes: supplier?.notes ?? ''
      })
    }
  }, [open, supplier])

  const save = async (): Promise<void> => {
    setBusy(true)
    try {
      const payload = {
        name: form.name,
        phone: form.phone || null,
        address: form.address || null,
        notes: form.notes || null
      }
      const saved = supplier
        ? await api.suppliers.update(supplier.id, payload)
        : await api.suppliers.create(payload)
      toast.success(supplier ? 'Supplier updated' : 'Supplier added')
      onSaved(saved)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={supplier ? 'Edit supplier' : 'New supplier'}>
      <div className="space-y-4">
        <Field label={`${t('name')} *`}>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
          />
        </Field>
        <Field label={t('phone')}>
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
