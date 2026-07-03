'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Pencil, Power } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { t, ROLE_LABELS } from '@/lib/labels'
import type { Role, User } from '@/lib/types'
import { PageHeader, Modal, Field, Spinner, StatusBadge } from '@/components/ui'

export default function StaffPage(): JSX.Element {
  const { user: me, isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const [rows, setRows] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/')
  }, [authLoading, isAdmin, router])

  const load = (): void => {
    setLoading(true)
    api.users
      .list()
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin])

  const toggleActive = async (u: User): Promise<void> => {
    try {
      await api.users.setActive(u.id, !u.active)
      toast.success(u.active ? 'Account deactivated' : 'Account activated')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  if (!isAdmin) return <Spinner label="Checking access…" />

  return (
    <div>
      <PageHeader
        title={t('staff')}
        subtitle="Manage staff accounts and roles"
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

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6">
            <Spinner label="Loading…" />
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">{t('name')}</th>
                <th className="th">Username</th>
                <th className="th">Role</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="td font-medium">
                    {u.name}
                    {me?.id === u.id && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                  </td>
                  <td className="td font-mono text-xs">{u.username}</td>
                  <td className="td">{ROLE_LABELS[u.role]}</td>
                  <td className="td">
                    {u.active ? (
                      <StatusBadge label="Active" tone="green" />
                    ) : (
                      <StatusBadge label="Inactive" tone="red" />
                    )}
                  </td>
                  <td className="td text-right">
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        setEditing(u)
                        setOpen(true)
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => toggleActive(u)}
                      disabled={me?.id === u.id}
                      title={me?.id === u.id ? 'You cannot deactivate yourself' : 'Toggle active'}
                    >
                      <Power size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <StaffModal
        open={open}
        user={editing}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false)
          load()
        }}
      />
    </div>
  )
}

function StaffModal({
  open,
  user,
  onClose,
  onSaved
}: {
  open: boolean
  user: User | null
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const toast = useToast()
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'sales_manager' as Role
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        name: user?.name ?? '',
        username: user?.username ?? '',
        password: '',
        role: user?.role ?? 'sales_manager'
      })
    }
  }, [open, user])

  const save = async (): Promise<void> => {
    setBusy(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        username: form.username,
        role: form.role
      }
      if (form.password) payload.password = form.password
      if (user) await api.users.update(user.id, payload)
      else await api.users.create(payload)
      toast.success(user ? 'Account updated' : 'Account created')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={user ? 'Edit staff' : 'New staff'}>
      <div className="space-y-4">
        <Field label={`${t('name')} *`}>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Username *">
          <input
            className="input"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </Field>
        <Field label={user ? 'New password (leave blank to keep)' : 'Password *'}>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Field label="Role">
          <select
            className="input"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            <option value="sales_manager">{ROLE_LABELS.sales_manager}</option>
            <option value="admin">{ROLE_LABELS.admin}</option>
          </select>
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
