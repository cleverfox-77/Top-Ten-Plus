'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Printer, ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { bdt } from '@/lib/format'
import type { Fabric } from '@/lib/types'
import { Spinner } from '@/components/ui'
import { Barcode } from '@/components/print'

export default function BarcodeStickersPrint(): JSX.Element {
  const params = useParams<{ id: string }>()
  const fabricId = Number(params.id)
  const toast = useToast()
  const router = useRouter()
  const [fabric, setFabric] = useState<Fabric | null>(null)
  const [loading, setLoading] = useState(true)
  const [copies, setCopies] = useState(12)

  useEffect(() => {
    api.fabrics
      .get(fabricId)
      .then((f) => setFabric(f ?? null))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [fabricId])

  if (loading) return <Spinner label="Loading…" />
  if (!fabric) return <div className="p-6 text-gray-500">Fabric not found.</div>

  const count = Math.max(1, Math.min(200, copies))

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <button className="btn-secondary" onClick={() => router.push('/stock')}>
          <ArrowLeft size={18} /> Back
        </button>
        <label className="ml-2 text-sm text-gray-600">Copies</label>
        <input
          type="number"
          min={1}
          max={200}
          className="input w-24"
          value={copies}
          onChange={(e) => setCopies(Number(e.target.value))}
        />
        <button className="btn-primary" onClick={() => window.print()}>
          <Printer size={18} /> Print stickers
        </button>
        <span className="text-xs text-gray-400">
          Printing {count} sticker{count === 1 ? '' : 's'} for {fabric.name}
        </span>
      </div>

      <div className="print-area">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className="print-avoid-break flex flex-col items-center rounded border border-gray-300 p-2 text-center"
            >
              <div className="w-full truncate text-[11px] font-semibold text-gray-800">
                {fabric.name}
                {fabric.color ? ` · ${fabric.color}` : ''}
              </div>
              <Barcode value={fabric.product_id} height={34} className="my-1 max-w-full" />
              {fabric.selling_price_per_unit != null && (
                <div className="text-[11px] font-bold text-gray-900">
                  {bdt(fabric.selling_price_per_unit)} / {fabric.unit}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
