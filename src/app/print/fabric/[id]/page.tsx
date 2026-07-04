'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { fromBase, round2 } from '@/lib/units'
import { bdt, humanDate } from '@/lib/format'
import type { Fabric, StockMovement } from '@/lib/types'
import { Spinner } from '@/components/ui'
import { PrintToolbar, ReportHeader, Barcode, DISCLAIMER } from '@/components/print'

export default function FabricIntakePrint(): JSX.Element {
  const params = useParams<{ id: string }>()
  const fabricId = Number(params.id)
  const toast = useToast()
  const [fabric, setFabric] = useState<Fabric | null>(null)
  const [intake, setIntake] = useState<StockMovement | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.fabrics.get(fabricId), api.fabrics.movements(fabricId)])
      .then(([f, movs]) => {
        setFabric(f ?? null)
        const news = movs.filter((m) => m.reason === 'new_stock').sort((a, b) => a.id - b.id)
        setIntake(news[0] ?? null)
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [fabricId])

  if (loading) return <Spinner label="Loading receipt…" />
  if (!fabric) return <div className="p-6 text-gray-500">Fabric not found.</div>

  const qty = intake
    ? round2(fromBase(intake.change_amount, fabric.unit))
    : round2(fromBase(fabric.quantity_base, fabric.unit))
  const dateAdded = intake?.created_at ?? fabric.created_at
  const addedBy = intake?.created_by_name ?? '—'

  const rows: [string, string][] = [
    ['Product ID / Barcode', fabric.product_id],
    ['Name', fabric.name],
    ['Color', fabric.color || '—'],
    ['Quantity', `${qty} ${fabric.unit}`],
    ['Cost price / unit', fabric.cost_price_per_unit != null ? bdt(fabric.cost_price_per_unit) : '—'],
    ['Date added', humanDate(dateAdded)],
    ['Added by', addedBy]
  ]

  return (
    <div>
      <PrintToolbar backHref="/stock" />
      <div className="print-area card mx-auto max-w-md p-6">
        <ReportHeader title="Stock Intake Receipt" subtitle={`generated ${humanDate(new Date())}`} />

        <div className="my-4 flex justify-center">
          <Barcode value={fabric.product_id} />
        </div>

        <table className="w-full text-sm">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b border-dotted border-gray-200">
                <td className="py-2 pr-4 text-gray-500">{label}</td>
                <td className="py-2 text-right font-medium text-gray-900">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 flex justify-between text-xs text-gray-500">
          <div className="border-t border-gray-400 pt-1">Received by</div>
          <div className="border-t border-gray-400 pt-1">Authorised signature</div>
        </div>

        <div className="mt-6 border-t border-dashed border-gray-300 pt-2 text-center text-[10px] text-gray-400">
          {DISCLAIMER}
        </div>
      </div>
    </div>
  )
}
