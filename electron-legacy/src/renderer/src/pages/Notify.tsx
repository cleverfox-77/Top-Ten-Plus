import { useEffect, useState } from 'react'
import { BellRing, Send } from 'lucide-react'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { t, STATUS_LABELS } from '@shared/labels'
import { bdt, fmtDate } from '../lib/format'
import type { Order, SmsLog } from '@shared/types'
import { PageHeader, EmptyState, Spinner } from '../components/ui'

export default function Notify(): JSX.Element {
  const toast = useToast()
  const [ready, setReady] = useState<Order[]>([])
  const [log, setLog] = useState<SmsLog[]>([])
  const [loading, setLoading] = useState(true)
  const [gatewayLive, setGatewayLive] = useState(false)
  const [sending, setSending] = useState<number | null>(null)

  const load = (): void => {
    setLoading(true)
    Promise.all([
      api.orders.list({ status: 'ready_for_pickup' }),
      api.sms.list(),
      api.sms.gatewayEnabled()
    ])
      .then(([r, l, g]) => {
        setReady(r)
        setLog(l)
        setGatewayLive(g)
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const send = async (orderId: number): Promise<void> => {
    setSending(orderId)
    try {
      await api.sms.sendReady(orderId)
      toast.success(`Ready notice ${gatewayLive ? 'sent' : 'logged'} for order #${orderId}`)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSending(null)
    }
  }

  if (loading) return <Spinner label="Loading…" />

  return (
    <div>
      <PageHeader
        title={t('notify')}
        subtitle="Send “your order is ready” messages to customers"
      />

      {!gatewayLive && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          SMS gateway is in <b>stub mode</b> — messages are composed and recorded below but not
          actually delivered. Connect a Bangladesh SMS gateway (BulkSMSBD / MiMSMS / Alpha SMS /
          sms.bd) to go live.
        </div>
      )}

      <div className="card mb-6 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-semibold text-gray-700">
          Ready for pickup ({ready.length})
        </div>
        {ready.length === 0 ? (
          <div className="p-6">
            <EmptyState message="No orders are marked “Ready for pickup”. Update an order's status to see it here." />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">#</th>
                <th className="th">Customer</th>
                <th className="th">Phone</th>
                <th className="th">Delivery</th>
                <th className="th text-right">Due</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ready.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="td font-semibold">#{o.id}</td>
                  <td className="td">{o.customer_name}</td>
                  <td className="td">{o.customer_phone}</td>
                  <td className="td">{fmtDate(o.expected_delivery_date)}</td>
                  <td className="td text-right text-amber-700">{bdt(o.due_amount)}</td>
                  <td className="td text-right">
                    <button
                      className="btn-primary"
                      onClick={() => send(o.id)}
                      disabled={sending === o.id}
                    >
                      {sending === o.id ? <Spinner /> : <><Send size={16} /> Notify</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 font-semibold text-gray-700">
          <BellRing size={16} /> SMS log
        </div>
        {log.length === 0 ? (
          <div className="p-6">
            <EmptyState message="No SMS messages yet." />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">When</th>
                <th className="th">Customer</th>
                <th className="th">Type</th>
                <th className="th">Message</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {log.map((s) => (
                <tr key={s.id}>
                  <td className="td whitespace-nowrap text-gray-500">{fmtDate(s.sent_at)}</td>
                  <td className="td">
                    {s.customer_name}
                    <div className="text-xs text-gray-400">{s.customer_phone}</div>
                  </td>
                  <td className="td text-gray-600">
                    {s.type === 'order_confirmation' ? 'Confirmation' : 'Ready notice'}
                  </td>
                  <td className="td max-w-md text-xs text-gray-600">{s.message}</td>
                  <td className="td">
                    <span
                      className={`badge ${
                        s.status === 'sent'
                          ? 'bg-green-100 text-green-700'
                          : s.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
