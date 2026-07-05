'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScanLine, Search, Printer } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { t } from '@/lib/labels'
import { bdt, fmtDateTime } from '@/lib/format'
import { fromBase, round2 } from '@/lib/units'
import type { Fabric, StockMovement } from '@/lib/types'
import { PageHeader, EmptyState, Spinner } from '@/components/ui'

export default function ProductsPage(): JSX.Element {
  const toast = useToast()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Fabric[]>([])
  const [selected, setSelected] = useState<Fabric | null>(null)
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [busy, setBusy] = useState(false)

  const open = async (f: Fabric): Promise<void> => {
    setSelected(f)
    setResults([])
    setQuery('')
    try {
      setMovements(await api.fabrics.movements(f.id))
    } catch {
      setMovements([])
    }
  }

  // Barcode scanners send the code + Enter → exact lookup and open immediately.
  const scan = async (): Promise<void> => {
    const q = query.trim()
    if (!q) return
    setBusy(true)
    try {
      const exact = await api.fabrics.findByBarcode(q)
      if (exact) {
        await open(exact)
        return
      }
      const list = await api.fabrics.list(q)
      if (list.length === 1) await open(list[0])
      else if (list.length === 0) toast.error(`No product found for "${q}"`)
      else setResults(list)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setBusy(false)
    }
  }

  const suppliersSeen = Array.from(
    new Set(movements.filter((m) => m.supplier_name).map((m) => m.supplier_name as string))
  )

  return (
    <div>
      <PageHeader title={t('products')} subtitle="Scan or search a barcode to see full product details" />

      <div className="mb-6 flex max-w-lg gap-2">
        <div className="relative flex-1">
          <ScanLine className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input
            className="input pl-9"
            placeholder="Scan barcode or type ID / name, then Enter"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && scan()}
            autoFocus
          />
        </div>
        <button className="btn-primary" onClick={scan} disabled={busy}>
          {busy ? <Spinner /> : <><Search size={18} /> Find</>}
        </button>
      </div>

      {results.length > 0 && (
        <div className="card mb-6 overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
            {results.length} matches — pick one
          </div>
          <table className="w-full">
            <tbody className="divide-y divide-gray-100">
              {results.map((f) => (
                <tr key={f.id} className="cursor-pointer hover:bg-gray-50" onClick={() => open(f)}>
                  <td className="td font-mono text-xs">{f.product_id}</td>
                  <td className="td font-medium">{f.name}</td>
                  <td className="td text-gray-500">{f.color || '—'}</td>
                  <td className="td text-right">
                    {round2(fromBase(f.quantity_base, f.unit))} {f.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!selected && results.length === 0 && (
        <EmptyState message="Scan a fabric's barcode (or type its ID) to view stock, supplier and pricing." />
      )}

      {selected && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-bold text-gray-900">{selected.name}</div>
                <div className="font-mono text-xs text-gray-500">{selected.product_id}</div>
                {selected.color && <div className="text-sm text-gray-500">Color: {selected.color}</div>}
              </div>
              <button
                className="btn-secondary"
                onClick={() => router.push(`/print/barcode/${selected.id}`)}
              >
                <Printer size={18} /> Barcode stickers
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t('in_stock')} value={`${round2(fromBase(selected.quantity_base, selected.unit))} ${selected.unit}`} />
              <Stat label={t('cost_price')} value={selected.cost_price_per_unit != null ? bdt(selected.cost_price_per_unit) : '—'} />
              <Stat label={t('selling_price')} value={selected.selling_price_per_unit != null ? bdt(selected.selling_price_per_unit) : '—'} />
              <Stat label={t('supplier')} value={suppliersSeen.length ? suppliersSeen.join(', ') : '—'} />
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 font-semibold text-gray-700">
              Recent movements
            </div>
            {movements.length === 0 ? (
              <div className="p-4 text-sm text-gray-400">No movements recorded.</div>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {movements.slice(0, 12).map((m) => (
                    <tr key={m.id}>
                      <td className="td whitespace-nowrap text-gray-500">{fmtDateTime(m.created_at)}</td>
                      <td className="td">{m.reason}</td>
                      <td className="td">{m.supplier_name || (m.challan_number ? `Challan ${m.challan_number}` : '')}</td>
                      <td className={`td text-right ${m.change_amount < 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {m.change_amount < 0 ? '' : '+'}
                        {round2(fromBase(m.change_amount, selected.unit))} {selected.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="font-semibold text-gray-900">{value}</div>
    </div>
  )
}
