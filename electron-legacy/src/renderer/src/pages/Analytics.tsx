import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useToast } from '../lib/toast'
import { t } from '@shared/labels'
import { bdt } from '../lib/format'
import type {
  FabricSoldRow,
  StockRow,
  RevenuePoint
} from '../../../main/services/analytics'
import { PageHeader, Spinner, EmptyState } from '../components/ui'

export default function Analytics(): JSX.Element {
  const toast = useToast()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [granularity, setGranularity] = useState<'day' | 'month'>('day')

  const [fabricSold, setFabricSold] = useState<FabricSoldRow[]>([])
  const [stock, setStock] = useState<StockRow[]>([])
  const [revenue, setRevenue] = useState<RevenuePoint[]>([])
  const [best, setBest] = useState<{ garment_type: string; count: number; revenue: number }[]>([])
  const [top, setTop] = useState<
    { id: number; name: string; phone: string; orders: number; spend: number }[]
  >([])
  const [perf, setPerf] = useState<{ id: number; name: string; orders: number; revenue: number }[]>(
    []
  )
  const [aov, setAov] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = (): void => {
    setLoading(true)
    Promise.all([
      api.analytics.fabricSold(from || null, to || null),
      api.analytics.stockRemaining(),
      api.analytics.revenueOverTime(granularity, from || null, to || null),
      api.analytics.bestSelling(),
      api.analytics.topCustomers(),
      api.analytics.salesPerf(),
      api.analytics.avgOrderValue()
    ])
      .then(([fs, st, rev, bs, tc, sp, a]) => {
        setFabricSold(fs)
        setStock(st)
        setRevenue(rev)
        setBest(bs)
        setTop(tc)
        setPerf(sp)
        setAov(a)
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [from, to, granularity])

  const maxRev = Math.max(1, ...revenue.map((r) => r.revenue))
  const maxFabric = Math.max(1, ...fabricSold.map((f) => f.value_bdt))
  const maxGarment = Math.max(1, ...best.map((b) => b.count))

  return (
    <div>
      <PageHeader title={t('analytics')} subtitle="Business insights and inventory value" />

      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="mb-1 block text-xs text-gray-500">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Trend by</label>
          <select
            className="input"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as 'day' | 'month')}
          >
            <option value="day">Day</option>
            <option value="month">Month</option>
          </select>
        </div>
        <button className="btn-secondary" onClick={() => { setFrom(''); setTo('') }}>
          Clear dates
        </button>
        <div className="ml-auto rounded-lg bg-brand-50 px-4 py-2 text-sm">
          Average order value: <b className="text-brand-700">{bdt(aov)}</b>
        </div>
      </div>

      {loading ? (
        <Spinner label="Crunching numbers…" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Revenue over time */}
          <Panel title="Revenue over time">
            {revenue.length === 0 ? (
              <EmptyState message="No revenue in this period." />
            ) : (
              <div className="space-y-2">
                {revenue.slice(-14).map((r) => (
                  <div key={r.period} className="flex items-center gap-2 text-xs">
                    <span className="w-20 shrink-0 text-gray-500">{r.period}</span>
                    <div className="h-4 flex-1 rounded bg-gray-100">
                      <div
                        className="h-4 rounded bg-brand-500"
                        style={{ width: `${(r.revenue / maxRev) * 100}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right font-medium">{bdt(r.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Fabric sold in BDT */}
          <Panel title="Fabric sold (BDT value)">
            {fabricSold.length === 0 ? (
              <EmptyState message="No fabric used in this period." />
            ) : (
              <div className="space-y-2">
                {fabricSold.map((f) => (
                  <div key={f.fabric_id} className="flex items-center gap-2 text-xs">
                    <span className="w-32 shrink-0 truncate text-gray-600" title={f.name}>
                      {f.name}
                    </span>
                    <div className="h-4 flex-1 rounded bg-gray-100">
                      <div
                        className="h-4 rounded bg-brand-500"
                        style={{ width: `${(f.value_bdt / maxFabric) * 100}%` }}
                      />
                    </div>
                    <span className="w-28 shrink-0 text-right">
                      {f.quantity_used_display} {f.unit} · <b>{bdt(f.value_bdt)}</b>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Best selling garments */}
          <Panel title="Best-selling garments">
            {best.length === 0 ? (
              <EmptyState message="No orders yet." />
            ) : (
              <div className="space-y-2">
                {best.map((b) => (
                  <div key={b.garment_type} className="flex items-center gap-2 text-xs">
                    <span className="w-24 shrink-0 capitalize text-gray-600">{t(b.garment_type)}</span>
                    <div className="h-4 flex-1 rounded bg-gray-100">
                      <div
                        className="h-4 rounded bg-brand-500"
                        style={{ width: `${(b.count / maxGarment) * 100}%` }}
                      />
                    </div>
                    <span className="w-28 shrink-0 text-right">
                      {b.count} pcs · {bdt(b.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Stock remaining */}
          <Panel title="Stock remaining">
            {stock.length === 0 ? (
              <EmptyState message="No fabrics." />
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {stock.map((s) => (
                    <tr key={s.id}>
                      <td className="py-1.5">{s.name}</td>
                      <td className="py-1.5 text-right">
                        <span className={s.low ? 'font-semibold text-amber-700' : ''}>
                          {s.quantity_display} {s.unit}
                        </span>
                        {s.low && <span className="ml-2 badge bg-amber-100 text-amber-800">Low</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          {/* Top customers */}
          <Panel title="Top customers by spend">
            {top.length === 0 ? (
              <EmptyState message="No customers yet." />
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {top.map((c) => (
                    <tr key={c.id}>
                      <td className="py-1.5">
                        {c.name}
                        <span className="ml-2 text-xs text-gray-400">{c.orders} orders</span>
                      </td>
                      <td className="py-1.5 text-right font-medium">{bdt(c.spend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          {/* Sales manager performance */}
          <Panel title="Sales manager performance">
            {perf.length === 0 ? (
              <EmptyState message="No orders yet." />
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {perf.map((p) => (
                    <tr key={p.id}>
                      <td className="py-1.5">
                        {p.name}
                        <span className="ml-2 text-xs text-gray-400">{p.orders} orders</span>
                      </td>
                      <td className="py-1.5 text-right font-medium">{bdt(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="card p-5">
      <h3 className="mb-4 font-semibold text-gray-800">{title}</h3>
      {children}
    </div>
  )
}
