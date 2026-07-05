'use client'

import { useEffect, useState } from 'react'
import { ScanLine, RotateCcw } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { t } from '@/lib/labels'
import { ALL_UNITS, UNIT_LABELS, fromBase, round2 } from '@/lib/units'
import { fmtDateTime } from '@/lib/format'
import type { Fabric, FabricUnit, StockMovement } from '@/lib/types'
import { PageHeader, Field, EmptyState, Spinner } from '@/components/ui'

export default function ReturnsPage(): JSX.Element {
  const toast = useToast()
  const [fabrics, setFabrics] = useState<Fabric[]>([])
  const [recent, setRecent] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [scan, setScan] = useState('')
  const [fabricId, setFabricId] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState<FabricUnit>('gaz')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = (): void => {
    Promise.all([api.fabrics.list(), api.fabrics.stockMovements({ reason: 'return' })])
      .then(([f, r]) => {
        setFabrics(f)
        setRecent(r)
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const selected = fabrics.find((f) => f.id === Number(fabricId)) || null

  const selectFabric = (f: Fabric): void => {
    setFabricId(String(f.id))
    setUnit(f.unit)
  }

  const handleScan = (): void => {
    const q = scan.trim().toLowerCase()
    if (!q) return
    const f = fabrics.find((x) => x.product_id.toLowerCase() === q)
    if (!f) {
      toast.error(`No product found for "${scan.trim()}"`)
      return
    }
    selectFabric(f)
    setScan('')
    toast.success(`Selected ${f.name}`)
  }

  const submit = async (): Promise<void> => {
    if (!fabricId) {
      toast.error('Select or scan a product')
      return
    }
    if (!(Number(qty) > 0)) {
      toast.error('Enter a return quantity')
      return
    }
    setBusy(true)
    try {
      await api.fabrics.recordReturn({
        fabric_id: Number(fabricId),
        quantity: Number(qty),
        unit,
        note: note.trim() || null
      })
      toast.success('Return recorded — stock adjusted')
      setQty('')
      setNote('')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title={t('returns')} subtitle="Record returned products and add them back to stock" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 font-semibold text-gray-800">Record a return</h3>

          <Field label="Scan product barcode">
            <div className="relative">
              <ScanLine className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                className="input pl-9"
                placeholder="Scan or type barcode, then Enter"
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleScan())}
              />
            </div>
          </Field>

          <div className="mt-4">
            <Field label="Product">
              <select
                className="input"
                value={fabricId}
                onChange={(e) => {
                  const f = fabrics.find((x) => x.id === Number(e.target.value))
                  if (f) selectFabric(f)
                  else setFabricId('')
                }}
              >
                <option value="">— select —</option>
                {fabrics.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.product_id})
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field label={t('quantity')}>
              <input
                type="number"
                step="0.1"
                className="input"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </Field>
            <Field label={t('unit')}>
              <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as FabricUnit)}>
                {ALL_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u].split(' ')[0]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Reason / note">
              <input
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. wrong color, customer changed mind"
              />
            </Field>
          </div>

          {selected && (
            <p className="mt-2 text-xs text-gray-500">
              Current stock: {round2(fromBase(selected.quantity_base, selected.unit))} {selected.unit}
            </p>
          )}

          <button className="btn-primary mt-4 w-full" onClick={submit} disabled={busy}>
            {busy ? <Spinner /> : <><RotateCcw size={16} /> Record return</>}
          </button>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-semibold text-gray-700">
            Recent returns
          </div>
          {loading ? (
            <div className="p-4">
              <Spinner label="Loading…" />
            </div>
          ) : recent.length === 0 ? (
            <div className="p-4">
              <EmptyState message="No returns recorded yet." />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="th">When</th>
                  <th className="th">Product</th>
                  <th className="th text-right">Qty</th>
                  <th className="th">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent.map((m) => {
                  const u = m.fabric_unit ?? 'gaz'
                  return (
                    <tr key={m.id}>
                      <td className="td whitespace-nowrap text-gray-500">{fmtDateTime(m.created_at)}</td>
                      <td className="td">{m.fabric_name}</td>
                      <td className="td text-right text-green-700">
                        +{round2(fromBase(m.change_amount, u))} {u}
                      </td>
                      <td className="td text-gray-500">{m.note || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
