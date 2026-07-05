'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Pencil, PackagePlus, Wrench, History, Printer, Barcode } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { t } from '@/lib/labels'
import { ALL_UNITS, UNIT_LABELS, fromBase, round2 } from '@/lib/units'
import type { Fabric, FabricUnit, StockMovement } from '@/lib/types'
import { PageHeader, Modal, Field, EmptyState, Spinner } from '@/components/ui'
import { bdt, fmtDate } from '@/lib/format'

export default function StockPage(): JSX.Element {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const [rows, setRows] = useState<Fabric[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Fabric | null>(null)
  const [adjust, setAdjust] = useState<{ fabric: Fabric; mode: 'add' | 'correct' } | null>(null)
  const [history, setHistory] = useState<Fabric | null>(null)

  const load = (q = ''): void => {
    setLoading(true)
    api.fabrics
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
        title={t('stock')}
        subtitle={isAdmin ? 'Add and manage fabric inventory' : 'Read-only view of current stock'}
        actions={
          isAdmin && (
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(null)
                setEditOpen(true)
              }}
            >
              <Plus size={18} /> New fabric
            </button>
          )
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
        <input
          className="input pl-9"
          placeholder="Search by name, barcode, color…"
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
            <EmptyState message="No fabrics yet." />
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th">{t('product_id')}</th>
                <th className="th">{t('name')}</th>
                <th className="th">{t('color')}</th>
                <th className="th text-right">{t('in_stock')}</th>
                <th className="th text-right">{t('cost_price')}</th>
                <th className="th text-right">{t('selling_price')}</th>
                {isAdmin && <th className="th"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((f) => {
                const qty = round2(fromBase(f.quantity_base, f.unit))
                const low = f.low_stock_threshold > 0 && f.quantity_base <= f.low_stock_threshold
                return (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="td font-mono text-xs">{f.product_id}</td>
                    <td className="td font-medium">{f.name}</td>
                    <td className="td text-gray-500">{f.color || '—'}</td>
                    <td className="td text-right">
                      <span className={low ? 'font-semibold text-amber-700' : ''}>
                        {qty} {f.unit}
                      </span>
                      {low && <span className="ml-2 badge bg-amber-100 text-amber-800">Low</span>}
                    </td>
                    <td className="td text-right text-gray-600">
                      {f.cost_price_per_unit != null ? bdt(f.cost_price_per_unit) : '—'}
                    </td>
                    <td className="td text-right font-medium text-gray-800">
                      {f.selling_price_per_unit != null ? bdt(f.selling_price_per_unit) : '—'}
                    </td>
                    {isAdmin && (
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          <button
                            title="Add stock"
                            className="btn-ghost px-2"
                            onClick={() => setAdjust({ fabric: f, mode: 'add' })}
                          >
                            <PackagePlus size={16} />
                          </button>
                          <button
                            title="Correct quantity"
                            className="btn-ghost px-2"
                            onClick={() => setAdjust({ fabric: f, mode: 'correct' })}
                          >
                            <Wrench size={16} />
                          </button>
                          <button
                            title="History"
                            className="btn-ghost px-2"
                            onClick={() => setHistory(f)}
                          >
                            <History size={16} />
                          </button>
                          <button
                            title="Print intake receipt"
                            className="btn-ghost px-2"
                            onClick={() => router.push(`/print/fabric/${f.id}`)}
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            title="Print barcode stickers"
                            className="btn-ghost px-2"
                            onClick={() => router.push(`/print/barcode/${f.id}`)}
                          >
                            <Barcode size={16} />
                          </button>
                          <button
                            title="Edit"
                            className="btn-ghost px-2"
                            onClick={() => {
                              setEditing(f)
                              setEditOpen(true)
                            }}
                          >
                            <Pencil size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <FabricModal
        open={editOpen}
        fabric={editing}
        onClose={() => setEditOpen(false)}
        onSaved={(saved, isCreate) => {
          setEditOpen(false)
          // New fabric → open its printable stock intake receipt straight away.
          if (isCreate) router.push(`/print/fabric/${saved.id}`)
          else load(search)
        }}
      />

      {adjust && (
        <AdjustModal
          fabric={adjust.fabric}
          mode={adjust.mode}
          onClose={() => setAdjust(null)}
          onSaved={() => {
            setAdjust(null)
            load(search)
          }}
        />
      )}

      {history && <MovementsModal fabric={history} onClose={() => setHistory(null)} />}
    </div>
  )
}

function FabricModal({
  open,
  fabric,
  onClose,
  onSaved
}: {
  open: boolean
  fabric: Fabric | null
  onClose: () => void
  onSaved: (saved: Fabric, isCreate: boolean) => void
}): JSX.Element {
  const toast = useToast()
  const [form, setForm] = useState({
    product_id: '',
    name: '',
    color: '',
    unit: 'gaz' as FabricUnit,
    quantity: 0,
    cost_price_per_unit: '' as string,
    total_cost: '' as string,
    selling_price_per_unit: '' as string,
    low_stock_threshold: 0
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      const qty = fabric ? round2(fromBase(fabric.quantity_base, fabric.unit)) : 0
      const cost = fabric?.cost_price_per_unit
      setForm({
        product_id: fabric?.product_id ?? '',
        name: fabric?.name ?? '',
        color: fabric?.color ?? '',
        unit: fabric?.unit ?? 'gaz',
        quantity: qty,
        cost_price_per_unit: cost != null ? String(cost) : '',
        total_cost: cost != null && qty > 0 ? String(round2(cost * qty)) : '',
        selling_price_per_unit:
          fabric?.selling_price_per_unit != null ? String(fabric.selling_price_per_unit) : '',
        low_stock_threshold: fabric ? round2(fromBase(fabric.low_stock_threshold, fabric.unit)) : 0
      })
    }
  }, [open, fabric])

  // Keep cost/unit and total cost in sync via the quantity.
  const setQuantity = (q: number): void => {
    const cost = Number(form.cost_price_per_unit) || 0
    setForm({ ...form, quantity: q, total_cost: cost && q > 0 ? String(round2(cost * q)) : form.total_cost })
  }
  const setCostPerUnit = (v: string): void => {
    const cost = Number(v) || 0
    const q = Number(form.quantity) || 0
    setForm({ ...form, cost_price_per_unit: v, total_cost: cost && q > 0 ? String(round2(cost * q)) : '' })
  }
  const setTotalCost = (v: string): void => {
    const total = Number(v) || 0
    const q = Number(form.quantity) || 0
    setForm({ ...form, total_cost: v, cost_price_per_unit: total && q > 0 ? String(round2(total / q)) : '' })
  }

  const save = async (): Promise<void> => {
    setBusy(true)
    try {
      const payload = {
        product_id: form.product_id.trim(),
        name: form.name.trim(),
        color: form.color.trim() || null,
        unit: form.unit,
        quantity: Number(form.quantity) || 0,
        cost_price_per_unit:
          form.cost_price_per_unit === '' ? null : Number(form.cost_price_per_unit),
        selling_price_per_unit:
          form.selling_price_per_unit === '' ? null : Number(form.selling_price_per_unit),
        low_stock_threshold: Number(form.low_stock_threshold) || 0
      }
      const saved = fabric
        ? await api.fabrics.update(fabric.id, payload)
        : await api.fabrics.create(payload)
      toast.success(fabric ? 'Fabric updated' : 'Fabric added')
      onSaved(saved, !fabric)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={fabric ? 'Edit fabric' : 'New fabric'}>
      <div className="grid grid-cols-2 gap-4">
        <Field label={`${t('product_id')} *`}>
          <input
            className="input"
            value={form.product_id}
            onChange={(e) => setForm({ ...form, product_id: e.target.value })}
            placeholder="Scan or type barcode"
          />
        </Field>
        <Field label={`${t('name')} *`}>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label={t('color')}>
          <input
            className="input"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
          />
        </Field>
        <Field label={t('unit')}>
          <select
            className="input"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value as FabricUnit })}
          >
            {ALL_UNITS.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </Field>
        {!fabric && (
          <Field label={`Initial ${t('quantity')}`}>
            <input
              type="number"
              className="input"
              value={form.quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </Field>
        )}
        <Field label={t('total_cost')} hint="Total paid for the batch (BDT)">
          <input
            type="number"
            className="input"
            value={form.total_cost}
            onChange={(e) => setTotalCost(e.target.value)}
          />
        </Field>
        <Field label={t('cost_price')} hint="Auto-fills from total ÷ quantity">
          <input
            type="number"
            className="input"
            value={form.cost_price_per_unit}
            onChange={(e) => setCostPerUnit(e.target.value)}
          />
        </Field>
        <Field label={t('selling_price')} hint="BDT per unit — shown when selling">
          <input
            type="number"
            className="input"
            value={form.selling_price_per_unit}
            onChange={(e) => setForm({ ...form, selling_price_per_unit: e.target.value })}
          />
        </Field>
        <Field label={t('low_stock_threshold')}>
          <input
            type="number"
            className="input"
            value={form.low_stock_threshold}
            onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })}
          />
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          {t('cancel')}
        </button>
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? <Spinner /> : t('save')}
        </button>
      </div>
    </Modal>
  )
}

function AdjustModal({
  fabric,
  mode,
  onClose,
  onSaved
}: {
  fabric: Fabric
  mode: 'add' | 'correct'
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const toast = useToast()
  const current = round2(fromBase(fabric.quantity_base, fabric.unit))
  const [qty, setQty] = useState(mode === 'correct' ? current : 0)
  const [sellPrice, setSellPrice] = useState(
    fabric.selling_price_per_unit != null ? String(fabric.selling_price_per_unit) : ''
  )
  const [busy, setBusy] = useState(false)

  const save = async (): Promise<void> => {
    setBusy(true)
    try {
      if (mode === 'add') {
        await api.fabrics.addStock(
          fabric.id,
          Number(qty),
          fabric.unit,
          sellPrice === '' ? null : Number(sellPrice)
        )
      } else await api.fabrics.correctStock(fabric.id, Number(qty), fabric.unit)
      toast.success(mode === 'add' ? 'Stock added' : 'Stock corrected')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${mode === 'add' ? 'Add stock' : 'Correct quantity'} — ${fabric.name}`}
    >
      <p className="mb-3 text-sm text-gray-500">
        Current: <b>{current} {fabric.unit}</b>
      </p>
      <Field
        label={mode === 'add' ? `Quantity to add (${fabric.unit})` : `Set quantity to (${fabric.unit})`}
      >
        <input
          type="number"
          className="input"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          autoFocus
        />
      </Field>
      {mode === 'add' && (
        <div className="mt-4">
          <Field label={t('selling_price')} hint="Optional — update the selling price on restock">
            <input
              type="number"
              className="input"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
            />
          </Field>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          {t('cancel')}
        </button>
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? <Spinner /> : t('save')}
        </button>
      </div>
    </Modal>
  )
}

function MovementsModal({ fabric, onClose }: { fabric: Fabric; onClose: () => void }): JSX.Element {
  const toast = useToast()
  const [rows, setRows] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.fabrics
      .movements(fabric.id)
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [fabric.id])

  const reasonLabel: Record<string, string> = {
    new_stock: 'New stock',
    order_deduction: 'Order deduction',
    correction: 'Correction'
  }

  return (
    <Modal open onClose={onClose} title={`Stock history — ${fabric.name}`} width="max-w-2xl">
      {loading ? (
        <Spinner label="Loading…" />
      ) : rows.length === 0 ? (
        <EmptyState message="No movements recorded." />
      ) : (
        <table className="w-full">
          <thead className="border-b border-gray-200">
            <tr>
              <th className="th">Date</th>
              <th className="th">Reason</th>
              <th className="th text-right">Change</th>
              <th className="th">Order</th>
              <th className="th">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((m) => (
              <tr key={m.id}>
                <td className="td">{fmtDate(m.created_at)}</td>
                <td className="td">{reasonLabel[m.reason]}</td>
                <td
                  className={`td text-right font-medium ${
                    m.change_amount < 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {m.change_amount < 0 ? '' : '+'}
                  {round2(fromBase(m.change_amount, fabric.unit))} {fabric.unit}
                </td>
                <td className="td">{m.reference_order_id ? `#${m.reference_order_id}` : '—'}</td>
                <td className="td text-gray-500">{m.created_by_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  )
}
