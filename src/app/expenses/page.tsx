'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Printer, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { t } from '@/lib/labels'
import { bdt, fmtDate, todayStr } from '@/lib/format'
import type { Expense } from '@/lib/types'
import { PageHeader, Field, EmptyState, Spinner } from '@/components/ui'

const CATEGORIES = ['Rent', 'Utilities', 'Salary', 'Purchase', 'Transport', 'Maintenance', 'Marketing', 'Other']

export default function ExpensesPage(): JSX.Element {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const router = useRouter()
  const [rows, setRows] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState({ from: '', to: '', category: '' })
  const [form, setForm] = useState({ category: 'Rent', description: '', amount: '', spent_on: todayStr() })
  const [busy, setBusy] = useState(false)

  const load = (): void => {
    setLoading(true)
    api.expenses
      .list({ from: f.from || null, to: f.to || null, category: f.category || null })
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const id = setTimeout(load, 200)
    return () => clearTimeout(id)
  }, [f])

  const add = async (): Promise<void> => {
    if (!(Number(form.amount) > 0)) {
      toast.error('Enter an amount')
      return
    }
    setBusy(true)
    try {
      await api.expenses.create({
        category: form.category,
        description: form.description.trim() || null,
        amount: Number(form.amount),
        spent_on: form.spent_on
      })
      toast.success('Expense recorded')
      setForm({ ...form, description: '', amount: '' })
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const del = async (id: number): Promise<void> => {
    try {
      await api.expenses.delete(id)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  const total = rows.reduce((s, e) => s + e.amount, 0)

  const printReport = (): void => {
    const q = new URLSearchParams()
    if (f.from) q.set('from', f.from)
    if (f.to) q.set('to', f.to)
    if (f.category) q.set('category', f.category)
    router.push(`/print/expenses?${q.toString()}`)
  }

  return (
    <div>
      <PageHeader
        title={t('expenses')}
        subtitle="Record shop expenses and review totals"
        actions={
          <button className="btn-secondary" onClick={printReport}>
            <Printer size={18} /> Print
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card h-fit p-5">
          <h3 className="mb-4 font-semibold text-gray-800">Add expense</h3>
          <Field label="Category">
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <div className="mt-3">
            <Field label="Amount (৳)">
              <input
                type="number"
                className="input"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Date">
              <input
                type="date"
                className="input"
                value={form.spent_on}
                onChange={(e) => setForm({ ...form, spent_on: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Description">
              <input
                className="input"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>
          <button className="btn-primary mt-4 w-full" onClick={add} disabled={busy}>
            {busy ? <Spinner /> : <><Plus size={16} /> Add</>}
          </button>
        </div>

        <div className="lg:col-span-2">
          <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
            <div>
              <label className="mb-1 block text-xs text-gray-500">From</label>
              <input type="date" className="input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">To</label>
              <input type="date" className="input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Category</label>
              <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                <option value="">All</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="ml-auto rounded-lg bg-brand-50 px-4 py-2 text-sm">
              Total: <b className="text-brand-700">{bdt(total)}</b>
            </div>
          </div>

          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-6">
                <Spinner label="Loading…" />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-6">
                <EmptyState message="No expenses in this range." />
              </div>
            ) : (
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="th">Date</th>
                    <th className="th">Category</th>
                    <th className="th">Description</th>
                    <th className="th text-right">Amount</th>
                    <th className="th">By</th>
                    {isAdmin && <th className="th"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="td whitespace-nowrap">{fmtDate(e.spent_on)}</td>
                      <td className="td">{e.category}</td>
                      <td className="td text-gray-500">{e.description || '—'}</td>
                      <td className="td text-right font-medium">{bdt(e.amount)}</td>
                      <td className="td text-gray-500">{e.created_by_name}</td>
                      {isAdmin && (
                        <td className="td text-right">
                          <button className="btn-ghost text-red-600" onClick={() => del(e.id)}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
