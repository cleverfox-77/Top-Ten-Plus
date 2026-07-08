'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Scissors } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { bn } from '@/lib/labels'
import { GARMENTS } from '@/lib/garments'
import { unitToMeter } from '@/lib/units'
import { fmtDate, nowDateTime, toBnDigits } from '@/lib/format'
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
  // Body / cuff carry two extra boxes that stack vertically under the main box
  // (matching the shop's paper form) rather than sitting in their own columns.
  const STACK_CHILDREN: Record<string, string[]> = {
    body: ['body_2', 'body_3'],
    cuff: ['cuff_2', 'cuff_3']
  }
  const childKeys = new Set(Object.values(STACK_CHILDREN).flat())
  const measureColumns = def.measurements.filter((m) => !childKeys.has(m.key))
  // Main measurements share one row; F / B / XB drop to a small row below.
  const SECONDARY_KEYS = new Set(['fd', 'cb', 'xb'])
  const primaryColumns = measureColumns.filter((m) => !SECONDARY_KEYS.has(m.key))
  const secondaryColumns = measureColumns.filter((m) => SECONDARY_KEYS.has(m.key))
  const mVal = (key: string): string => {
    const v = item.measurements[key]
    return v === undefined || v === null || v === '' ? '' : toBnDigits(String(v))
  }
  const noteVal = item.style_options?.note
  const note = typeof noteVal === 'string' ? noteVal.trim() : ''

  const isCutting = copy === 'cutting'
  // Labels swapped: the upper copy is the Stitching Master, the lower (which
  // carries the measurements) is the Cutting Master.
  const copyLabel = isCutting ? 'সেলাই মাস্টার কপি' : 'কাটিং মাস্টার কপি'
  const copyEn = isCutting ? 'Stitching Master' : 'Cutting Master'
  const bandClass = isCutting
    ? 'bg-gray-900 text-white'
    : 'border-2 border-gray-900 text-gray-900'

  const cell = (m: { key: string; label: string }, grow: boolean): JSX.Element => {
    const children = STACK_CHILDREN[m.key] ?? []
    return (
      <div key={m.key} className={`text-center ${grow ? 'flex-1' : ''}`} style={grow ? undefined : { width: 56 }}>
        <div className="border border-gray-500 bg-gray-100 px-1 py-0.5 text-[9px] leading-tight text-gray-700">
          {bn(m.key)}
        </div>
        <div className="border border-t-0 border-gray-500 px-1 py-1 text-sm font-bold" style={{ minHeight: 22 }}>
          {mVal(m.key)}
        </div>
        {children.map((c) => (
          <div
            key={c}
            className="border border-t-0 border-gray-500 px-1 py-1 text-sm font-bold"
            style={{ minHeight: 22 }}
          >
            {mVal(c)}
          </div>
        ))}
      </div>
    )
  }

  const Measurements = (
    <div className="mb-2">
      <div className="mb-1 text-[10px] font-bold text-gray-700">মাপ (ইঞ্চি) · Measurements</div>
      <div className="flex items-start gap-1">{primaryColumns.map((m) => cell(m, true))}</div>
      {secondaryColumns.length > 0 && (
        <div className="mt-1 flex items-start gap-1">{secondaryColumns.map((m) => cell(m, false))}</div>
      )}
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
              {bn(item.garment_type)} {toBnDigits(itemNo)}
            </div>
            <div className="text-[9px] text-gray-500">ছাপা: {toBnDigits(nowDateTime())}</div>
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
          <div className="font-bold">#{toBnDigits(order.id)}</div>
        </div>
        {order.delivery_code && (
          <div>
            <div className="text-[9px] text-gray-500">ডেলিভারি কোড</div>
            <div className="font-bold tracking-widest">{toBnDigits(order.delivery_code)}</div>
          </div>
        )}
        <div>
          <div className="text-[9px] text-gray-500">গ্রাহক</div>
          <div className="font-semibold">{order.customer_name}</div>
        </div>
        <div>
          <div className="text-[9px] text-gray-500">ফোন</div>
          <div className="font-semibold">{toBnDigits(order.customer_phone)}</div>
        </div>
        <div>
          <div className="text-[9px] text-gray-500">অর্ডারের তারিখ</div>
          <div>{toBnDigits(fmtDate(order.order_date))}</div>
        </div>
        <div>
          <div className="text-[9px] text-gray-500">ডেলিভারি তারিখ</div>
          <div className="font-semibold">{toBnDigits(fmtDate(order.expected_delivery_date))}</div>
        </div>
        <div>
          <div className="text-[9px] text-gray-500">বিক্রেতা</div>
          <div>{order.created_by_name}</div>
        </div>
        <div className="min-w-0">
          <div className="text-[9px] text-gray-500">জব কোড</div>
          <Barcode value={`TTP-${order.id}-${item.id}`} height={22} className="w-full" />
        </div>
      </div>

      {/* Measurements print on the lower copy (Cutting Master) only. */}
      {!isCutting && Measurements}

      {/* Fabric — on both copies */}
      {item.fabric_name && (
        <div className="mb-1.5 text-xs">
          <span className="text-[10px] font-bold text-gray-700">কাপড় · Fabric: </span>
          {item.fabric_name}
          {item.fabric_quantity_used && item.fabric_unit
            ? ` — ${toBnDigits(item.fabric_quantity_used)} ${item.fabric_unit} (${toBnDigits(
                unitToMeter(Number(item.fabric_quantity_used), item.fabric_unit)
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
          {isCutting ? 'সেলাই নির্দেশনা' : 'কাটিং নির্দেশনা'}
        </div>
        <div className="h-7 border border-gray-300" />
      </div>
    </div>
  )
}
