'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { t, en } from '@/lib/labels'
import { GARMENTS, describeStyle } from '@/lib/garments'
import { fmtDate, nowDateTime } from '@/lib/format'
import type { Order, OrderItem } from '@/lib/types'
import { Spinner } from '@/components/ui'
import { PrintToolbar, Barcode, DISCLAIMER } from '@/components/print'
import Logo from '@/components/Logo'

export default function JobCardPrint(): JSX.Element {
  const params = useParams<{ id: string }>()
  const orderId = Number(params.id)
  const toast = useToast()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.orders
      .get(orderId)
      .then((o) => setOrder(o ?? null))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [orderId])

  if (loading) return <Spinner label="Loading job card…" />
  if (!order || !order.items) return <div className="p-6 text-gray-500">Order not found.</div>

  // Per-garment-type numbering: first coat → "Coat 1", second coat → "Coat 2".
  const counters: Record<string, number> = {}

  return (
    <div>
      <PrintToolbar backHref={`/orders/${orderId}`} />
      <div className="print-area">
        {order.items.map((item, idx) => {
          counters[item.garment_type] = (counters[item.garment_type] ?? 0) + 1
          const last = idx === order.items!.length - 1
          return (
            <div key={item.id} className={last ? '' : 'print-break'}>
              <JobCard
                order={order}
                item={item}
                itemNo={counters[item.garment_type]}
                jobCode={`TTP-${order.id}-${idx + 1}`}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function JobCard({
  order,
  item,
  itemNo,
  jobCode
}: {
  order: Order
  item: OrderItem
  itemNo: number
  jobCode: string
}): JSX.Element {
  const def = GARMENTS[item.garment_type]
  const measures = def.measurements.filter(
    (m) =>
      item.measurements[m.key] !== undefined &&
      item.measurements[m.key] !== null &&
      item.measurements[m.key] !== ''
  )
  const styles = describeStyle(item.garment_type, item.style_options)

  return (
    <div className="print-avoid-break mx-auto mb-6 max-w-2xl border-2 border-gray-800 p-5">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between border-b border-gray-400 pb-2">
        <div>
          <Logo className="mb-1 h-12 w-auto" />
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Tailor Job Card (Karigar Copy)
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="text-right text-xs text-gray-600">
            <div>Printed: {nowDateTime()}</div>
            <div className="mt-1 text-lg font-bold text-gray-900">
              {en(item.garment_type)} {itemNo}
            </div>
          </div>
          {/* Circular rack / token — filled in by hand when the garment is hung. */}
          <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 border-gray-800 text-center">
            <span className="text-[9px] uppercase text-gray-500">Rack&nbsp;#</span>
          </div>
        </div>
      </div>

      {/* Identification */}
      <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-[10px] uppercase text-gray-500">Order</div>
          <div className="font-semibold">#{order.id}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-gray-500">Customer</div>
          <div className="font-semibold">{order.customer_name}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-gray-500">Phone</div>
          <div className="font-semibold">{order.customer_phone}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-gray-500">Salesperson</div>
          <div>{order.created_by_name}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-gray-500">Delivery</div>
          <div>{fmtDate(order.expected_delivery_date)}</div>
        </div>
        <div className="row-span-1">
          <div className="text-[10px] uppercase text-gray-500">Job code</div>
          <Barcode value={jobCode} height={28} className="max-h-10" />
        </div>
      </div>

      {/* Measurements — labeled grid, works for every garment type */}
      <div className="mb-3">
        <div className="mb-1 text-[10px] font-semibold uppercase text-gray-500">
          Measurements (inches)
        </div>
        {measures.length === 0 ? (
          <div className="text-xs text-gray-400">No measurements recorded.</div>
        ) : (
          <div className="grid grid-cols-5 gap-x-3 gap-y-2">
            {measures.map((m) => (
              <div key={m.key} className="border border-gray-300 px-2 py-1 text-center">
                <div className="text-[9px] uppercase leading-tight text-gray-500">{en(m.key)}</div>
                <div className="text-sm font-bold">{String(item.measurements[m.key])}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Style options — only the selected ones */}
      {styles.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] font-semibold uppercase text-gray-500">Style</div>
          <div className="flex flex-wrap gap-1.5">
            {styles.map((st, i) => (
              <span key={i} className="border border-gray-400 px-2 py-0.5 text-xs">
                {st}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fabric */}
      {item.fabric_name && (
        <div className="mb-3 text-xs">
          <span className="text-[10px] font-semibold uppercase text-gray-500">Fabric: </span>
          {item.fabric_name}
          {item.fabric_quantity_used
            ? ` — ${item.fabric_quantity_used} ${item.fabric_unit ?? ''}`
            : ''}
        </div>
      )}

      {/* Remarks — free space for anything that doesn't fit a fixed field */}
      <div className="mb-2">
        <div className="mb-1 text-[10px] font-semibold uppercase text-gray-500">Remarks</div>
        <div className="h-10 border border-gray-300" />
      </div>

      {/* Footer */}
      <div className="border-t border-dashed border-gray-300 pt-2 text-center text-[9px] text-gray-400">
        New Top Ten Plus · {DISCLAIMER}
      </div>
    </div>
  )
}
