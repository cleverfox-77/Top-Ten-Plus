'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Scissors } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { bn } from '@/lib/labels'
import { GARMENTS, describeStyle } from '@/lib/garments'
import { unitToMeter } from '@/lib/units'
import { fmtDate, nowDateTime } from '@/lib/format'
import type { Order, OrderItem } from '@/lib/types'
import { Spinner } from '@/components/ui'
import { PrintToolbar, Barcode } from '@/components/print'
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

  if (loading) return <Spinner label="জব কার্ড লোড হচ্ছে…" />
  if (!order || !order.items) return <div className="p-6 text-gray-500">অর্ডার পাওয়া যায়নি।</div>

  // Per-garment-type numbering: first coat → "কোট ১", second coat → "কোট ২".
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
              {/* One garment = one page holding two copies, cut apart along the line. */}
              <div className="mx-auto max-w-2xl">
                <JobHalf order={order} item={item} itemNo={counters[item.garment_type]} copy="cutting" />
                <CutLine />
                <JobHalf order={order} item={item} itemNo={counters[item.garment_type]} copy="stitching" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CutLine(): JSX.Element {
  return (
    <div className="my-2 flex items-center gap-2 text-gray-400">
      <Scissors size={14} className="shrink-0" />
      <div className="w-full border-t border-dashed border-gray-400" />
      <span className="shrink-0 whitespace-nowrap text-[10px]">এখানে কেটে আলাদা করুন</span>
      <div className="w-full border-t border-dashed border-gray-400" />
    </div>
  )
}

function JobHalf({
  order,
  item,
  itemNo,
  copy
}: {
  order: Order
  item: OrderItem
  itemNo: number
  copy: 'cutting' | 'stitching'
}): JSX.Element {
  const def = GARMENTS[item.garment_type]
  const measures = def.measurements.filter(
    (m) =>
      item.measurements[m.key] !== undefined &&
      item.measurements[m.key] !== null &&
      item.measurements[m.key] !== ''
  )
  const styles = describeStyle(item.garment_type, item.style_options)
  const noteVal = item.style_options?.note
  const note = typeof noteVal === 'string' ? noteVal.trim() : ''

  const isCutting = copy === 'cutting'
  const copyLabel = isCutting ? 'কাটিং মাস্টার কপি' : 'সেলাই মাস্টার কপি'
  const copyEn = isCutting ? 'Cutting Master' : 'Stitching Master'
  const bandClass = isCutting
    ? 'bg-gray-900 text-white'
    : 'border-2 border-gray-900 text-gray-900'

  const Measurements = (
    <div className="mb-2">
      <div className="mb-1 text-[10px] font-bold text-gray-700">মাপ (ইঞ্চি) · Measurements</div>
      {measures.length === 0 ? (
        <div className="text-xs text-gray-400">কোনো মাপ নেই।</div>
      ) : (
        <div className="grid grid-cols-5 gap-x-2 gap-y-1.5">
          {measures.map((m) => (
            <div key={m.key} className="border border-gray-400 px-1.5 py-1 text-center">
              <div className="text-[9px] leading-tight text-gray-600">{bn(m.key)}</div>
              <div className="text-sm font-bold">{String(item.measurements[m.key])}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const Style = styles.length > 0 && (
    <div className="mb-2">
      <div className="mb-1 text-[10px] font-bold text-gray-700">স্টাইল · Style</div>
      <div className="flex flex-wrap gap-1">
        {styles.map((st, i) => (
          <span key={i} className="border border-gray-400 px-1.5 py-0.5 text-[11px]">
            {st}
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <div className="print-avoid-break border-2 border-gray-800 p-3 text-gray-900">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between border-b border-gray-400 pb-1.5">
        <div className="flex items-center gap-2">
          <Logo className="h-9 w-auto" />
          <div>
            <div className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold ${bandClass}`}>
              {copyLabel}
            </div>
            <div className="text-[9px] uppercase tracking-wide text-gray-400">{copyEn} Copy</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="text-right">
            <div className="text-base font-bold">
              {bn(item.garment_type)} {itemNo}
            </div>
            <div className="text-[9px] text-gray-500">ছাপা: {nowDateTime()}</div>
          </div>
          {/* Rack token — filled by hand when the garment is hung. */}
          <div className="flex h-12 w-12 flex-col items-center justify-center rounded-full border-2 border-gray-800 text-center">
            <span className="text-[8px] text-gray-500">র‍্যাক</span>
          </div>
        </div>
      </div>

      {/* Identification — kept on BOTH copies (order no, dates, customer). */}
      <div className="mb-2 grid grid-cols-4 gap-x-2 gap-y-1 text-xs">
        <div>
          <div className="text-[9px] text-gray-500">অর্ডার নং</div>
          <div className="font-bold">#{order.id}</div>
        </div>
        {order.delivery_code && (
          <div>
            <div className="text-[9px] text-gray-500">ডেলিভারি কোড</div>
            <div className="font-bold tracking-widest">{order.delivery_code}</div>
          </div>
        )}
        <div>
          <div className="text-[9px] text-gray-500">গ্রাহক</div>
          <div className="font-semibold">{order.customer_name}</div>
        </div>
        <div>
          <div className="text-[9px] text-gray-500">ফোন</div>
          <div className="font-semibold">{order.customer_phone}</div>
        </div>
        <div>
          <div className="text-[9px] text-gray-500">অর্ডারের তারিখ</div>
          <div>{fmtDate(order.order_date)}</div>
        </div>
        <div>
          <div className="text-[9px] text-gray-500">ডেলিভারি তারিখ</div>
          <div className="font-semibold">{fmtDate(order.expected_delivery_date)}</div>
        </div>
        <div>
          <div className="text-[9px] text-gray-500">বিক্রেতা</div>
          <div>{order.created_by_name}</div>
        </div>
        <div>
          <div className="text-[9px] text-gray-500">জব কোড</div>
          <Barcode value={`TTP-${order.id}-${item.id}`} height={22} className="max-h-8" />
        </div>
      </div>

      {/* Cutting leads with measurements; stitching leads with style — both carry both. */}
      {isCutting ? (
        <>
          {Measurements}
          {Style}
        </>
      ) : (
        <>
          {Style}
          {Measurements}
        </>
      )}

      {/* Fabric — on both copies */}
      {item.fabric_name && (
        <div className="mb-1.5 text-xs">
          <span className="text-[10px] font-bold text-gray-700">কাপড় · Fabric: </span>
          {item.fabric_name}
          {item.fabric_quantity_used && item.fabric_unit
            ? ` — ${item.fabric_quantity_used} ${item.fabric_unit} (${unitToMeter(
                Number(item.fabric_quantity_used),
                item.fabric_unit
              )} m)`
            : ''}
        </div>
      )}

      {/* Customer note — on both copies */}
      {note && (
        <div className="mb-1.5 text-xs">
          <span className="text-[10px] font-bold text-gray-700">নোট · Note: </span>
          {note}
        </div>
      )}

      {/* Role-specific blank instruction box */}
      <div>
        <div className="mb-0.5 text-[9px] font-semibold text-gray-500">
          {isCutting ? 'কাটিং নির্দেশনা' : 'সেলাই নির্দেশনা'}
        </div>
        <div className="h-7 border border-gray-300" />
      </div>
    </div>
  )
}
