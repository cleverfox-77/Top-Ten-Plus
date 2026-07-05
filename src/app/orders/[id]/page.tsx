'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Printer, ArrowLeft, BellRing, Scissors } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { t, STATUS_LABELS, PAYMENT_LABELS } from '@/lib/labels'
import { GARMENTS, describeStyle } from '@/lib/garments'
import { STATUS_TONE, STATUS_FLOW } from '@/lib/status'
import { bdt, fmtDate, fmtDateTime } from '@/lib/format'
import type { Order, OrderItem, OrderStatus } from '@/lib/types'
import { PageHeader, Spinner, StatusBadge } from '@/components/ui'
import Logo from '@/components/Logo'
import {
  PaymentLinesEditor,
  newPayLine,
  payTotal,
  toPaymentLines,
  type PayLine
} from '@/components/PaymentLinesEditor'

export default function OrderDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>()
  const orderId = Number(params.id)
  const toast = useToast()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [payLines, setPayLines] = useState<PayLine[]>([newPayLine('cash')])
  const [savingPay, setSavingPay] = useState(false)

  const load = (): void => {
    api.orders
      .get(orderId)
      .then((o) => {
        if (!o) {
          toast.error('Order not found')
          router.push('/orders')
          return
        }
        setOrder(o)
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [orderId])

  const changeStatus = async (s: OrderStatus): Promise<void> => {
    try {
      const updated = await api.orders.updateStatus(orderId, s)
      setOrder(updated)
      toast.success(`Status → ${STATUS_LABELS[s]}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  const recordPayment = async (): Promise<void> => {
    const lines = toPaymentLines(payLines)
    if (lines.length === 0) {
      toast.error('Enter a payment amount')
      return
    }
    setSavingPay(true)
    try {
      const updated = await api.orders.recordPayment(orderId, lines)
      setOrder(updated)
      setPayLines([newPayLine('cash')])
      toast.success('Payment recorded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSavingPay(false)
    }
  }

  const notify = async (): Promise<void> => {
    try {
      await api.sms.sendReady(orderId)
      toast.success('“Ready for pickup” SMS logged')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  if (loading || !order) return <Spinner label="Loading order…" />

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title={`Order #${order.id}`}
          subtitle={`${order.customer_name} · ${order.customer_phone}`}
          actions={
            <>
              <button className="btn-secondary" onClick={() => router.push('/orders')}>
                <ArrowLeft size={18} /> Back
              </button>
              <button className="btn-secondary" onClick={notify}>
                <BellRing size={18} /> Notify ready
              </button>
              <button
                className="btn-secondary"
                onClick={() => router.push(`/print/job-card/${order.id}`)}
              >
                <Scissors size={18} /> Job card
              </button>
              <button className="btn-primary" onClick={() => api.app.print()}>
                <Printer size={18} /> Invoice
              </button>
            </>
          }
        />

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="card p-4">
            <div className="label">{t('status')}</div>
            <div className="mb-2">
              <StatusBadge label={STATUS_LABELS[order.status]} tone={STATUS_TONE[order.status]} />
            </div>
            <select
              className="input"
              value={order.status}
              onChange={(e) => changeStatus(e.target.value as OrderStatus)}
            >
              {STATUS_FLOW.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="card p-4 text-sm">
            <div className="label">Payment</div>
            <div className="space-y-0.5">
              <div className="flex justify-between text-gray-600">
                <span>{t('total_price')}</span>
                <b className="text-gray-800">{bdt(order.total_price)}</b>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Discount</span>
                  <span>− {bdt(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>{t('amount_paid')}</span>
                <b className="text-green-700">{bdt(order.amount_paid)}</b>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-1 text-gray-600">
                <span>{t('due_amount')}</span>
                <b className={order.due_amount > 0 ? 'text-amber-700' : 'text-green-700'}>
                  {bdt(order.due_amount)}
                </b>
              </div>
            </div>
          </div>

          <div className="card p-4 text-sm">
            <div className="label">Details</div>
            <div className="text-gray-600">
              {t('order_date')}: {fmtDate(order.order_date)}
            </div>
            <div className="text-gray-600">
              {t('delivery_date')}: {fmtDate(order.expected_delivery_date)}
            </div>
            <div className="text-gray-600">
              {t('payment_method')}: {PAYMENT_LABELS[order.payment_method]}
            </div>
            <div className="text-gray-600">Taken by: {order.created_by_name}</div>
          </div>
        </div>

        {/* Payments ledger + record a due payment (§5) */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <div className="label">Payments received</div>
            {order.payments && order.payments.length > 0 ? (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {order.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-1.5 text-gray-500">{fmtDate(p.created_at)}</td>
                      <td className="py-1.5">{PAYMENT_LABELS[p.method]}</td>
                      <td className="py-1.5 text-right font-medium">{bdt(p.amount)}</td>
                      <td className="py-1.5 text-right text-xs text-gray-400">{p.created_by_name}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 font-semibold">
                  <tr>
                    <td className="py-1.5" colSpan={2}>
                      Total paid
                    </td>
                    <td className="py-1.5 text-right">{bdt(order.amount_paid)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p className="text-sm text-gray-400">No payments recorded yet.</p>
            )}
          </div>

          <div className="card p-4">
            <div className="label">
              Record due payment{' '}
              {order.due_amount > 0 && (
                <span className="text-amber-700">({bdt(order.due_amount)} due)</span>
              )}
            </div>
            {order.due_amount > 0 ? (
              <>
                <PaymentLinesEditor lines={payLines} onChange={setPayLines} />
                <button
                  className="btn-primary mt-3 w-full"
                  onClick={recordPayment}
                  disabled={savingPay}
                >
                  {savingPay ? <Spinner /> : `Receive ${bdt(payTotal(payLines))}`}
                </button>
              </>
            ) : (
              <p className="text-sm text-green-700">This order is fully paid. 🎉</p>
            )}
          </div>
        </div>
      </div>

      <OrderSlip order={order} />
    </div>
  )
}

function OrderSlip({ order }: { order: Order }): JSX.Element {
  return (
    <div className="print-area card mx-auto max-w-3xl p-8">
      <div className="mb-4 flex items-start justify-between border-b-2 border-brand-600 pb-3">
        <div>
          <Logo className="mb-1 h-16 w-auto" />
          <div className="text-sm text-gray-500">Customer Invoice</div>
        </div>
        <div className="text-right text-sm">
          <div className="text-lg font-bold">Order #{order.id}</div>
          <div className="text-gray-600">
            {t('order_date')}: {fmtDate(order.order_date)}
          </div>
          <div className="text-gray-600">Time: {fmtDateTime(order.created_at)}</div>
          <div className="text-gray-600">
            {t('delivery_date')}: {fmtDate(order.expected_delivery_date)}
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="font-semibold text-gray-700">Customer</div>
          <div>{order.customer_name}</div>
          <div className="text-gray-600">{order.customer_phone}</div>
        </div>
        <div className="text-right">
          <div className="font-semibold text-gray-700">Status</div>
          <div>{STATUS_LABELS[order.status]}</div>
          <div className="text-gray-600">Staff: {order.created_by_name}</div>
        </div>
      </div>

      <div className="space-y-4">
        {order.items?.map((it, i) => (
          <SlipItem key={it.id} item={it} index={i} />
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <table className="text-sm">
          <tbody>
            <tr>
              <td className="py-1 pr-6 text-gray-500">Subtotal</td>
              <td className="py-1 text-right">{bdt(order.total_price + order.discount)}</td>
            </tr>
            {order.discount > 0 && (
              <tr>
                <td className="py-1 pr-6 text-gray-500">Discount</td>
                <td className="py-1 text-right">− {bdt(order.discount)}</td>
              </tr>
            )}
            <tr className="border-t border-gray-200">
              <td className="py-1 pr-6 font-semibold text-gray-700">{t('total_price')}</td>
              <td className="py-1 text-right font-semibold">{bdt(order.total_price)}</td>
            </tr>
            {(order.payments ?? []).map((p) => (
              <tr key={p.id}>
                <td className="py-0.5 pr-6 text-xs text-gray-400">
                  Paid · {PAYMENT_LABELS[p.method]} · {fmtDate(p.created_at)}
                </td>
                <td className="py-0.5 text-right text-xs text-gray-500">{bdt(p.amount)}</td>
              </tr>
            ))}
            <tr>
              <td className="py-1 pr-6 text-gray-500">{t('amount_paid')}</td>
              <td className="py-1 text-right">{bdt(order.amount_paid)}</td>
            </tr>
            <tr className="border-t border-gray-200">
              <td className="py-1 pr-6 font-semibold text-gray-700">{t('due_amount')}</td>
              <td className="py-1 text-right font-bold text-brand-700">{bdt(order.due_amount)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 border-t border-dashed border-gray-300 pt-3 text-center text-xs text-gray-400">
        Thank you for choosing New Top Ten Plus
      </div>
    </div>
  )
}

function SlipItem({ item, index }: { item: OrderItem; index: number }): JSX.Element {
  const def = GARMENTS[item.garment_type]
  const measures = def.measurements.filter(
    (m) =>
      item.measurements[m.key] !== undefined &&
      item.measurements[m.key] !== null &&
      item.measurements[m.key] !== ''
  )
  const styles = describeStyle(item.garment_type, item.style_options)

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-semibold text-gray-800">
          {index + 1}. {t(item.garment_type)}
        </div>
        <div className="text-sm font-semibold">{bdt(item.price)}</div>
      </div>

      {measures.length > 0 && (
        <div className="mb-2 grid grid-cols-4 gap-x-4 gap-y-1 text-xs">
          {measures.map((m) => (
            <div key={m.key} className="flex justify-between border-b border-dotted border-gray-200">
              <span className="text-gray-500">{m.label}</span>
              <span className="font-medium">{String(item.measurements[m.key])}″</span>
            </div>
          ))}
        </div>
      )}

      {styles.length > 0 && (
        <div className="mb-1 text-xs text-gray-600">
          <span className="font-medium text-gray-700">Style: </span>
          {styles.join(' · ')}
        </div>
      )}

      {item.fabric_name && (
        <div className="text-xs text-gray-600">
          <span className="font-medium text-gray-700">{t('fabric_used')}: </span>
          {item.fabric_name}
          {item.fabric_quantity_used
            ? ` — ${item.fabric_quantity_used} ${item.fabric_unit ?? ''}`
            : ''}
        </div>
      )}
    </div>
  )
}
