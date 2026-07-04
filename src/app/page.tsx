'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ShoppingBag,
  CalendarClock,
  Wallet,
  AlertTriangle,
  TrendingUp,
  PlusCircle
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { bdt } from '@/lib/format'
import { STATUS_LABELS } from '@/lib/labels'
import type { DashboardSummary, Fabric } from '@/lib/types'
import { fromBase, round2 } from '@/lib/units'
import { PageHeader, Spinner } from '@/components/ui'

export default function Dashboard(): JSX.Element {
  const { user, isAdmin } = useAuth()
  const toast = useToast()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [low, setLow] = useState<Fabric[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.analytics.summary(), api.fabrics.lowStock()])
      .then(([s, l]) => {
        setSummary(s)
        setLow(l)
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading || !summary) return <Spinner label="Loading dashboard…" />

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.name?.split(' ')[0] ?? ''}`}
        subtitle="Today at New Top Ten Plus"
        actions={
          <Link href="/orders/new" className="btn-primary">
            <PlusCircle size={18} /> New Order
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={<ShoppingBag />} label="Orders today" value={String(summary.ordersToday)} />
        <Stat
          icon={<CalendarClock />}
          label="Orders this month"
          value={String(summary.ordersThisMonth)}
        />
        {isAdmin ? (
          <Stat
            icon={<TrendingUp />}
            label="Revenue this month"
            value={bdt(summary.revenueThisMonth)}
          />
        ) : (
          <Stat
            icon={<TrendingUp />}
            label="My orders this month"
            value={String(summary.myOrdersThisMonth)}
          />
        )}
        <Stat
          icon={<Wallet />}
          label="Outstanding due"
          value={bdt(summary.outstandingDue)}
          tone="amber"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 font-semibold text-gray-800">Orders by status</h3>
          <div className="space-y-2">
            {Object.keys(STATUS_LABELS).map((s) => (
              <div key={s} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{STATUS_LABELS[s]}</span>
                <span className="badge bg-gray-100 text-gray-700">
                  {summary.statusCounts[s] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className={low.length ? 'text-amber-500' : 'text-gray-300'} />
            <h3 className="font-semibold text-gray-800">Low-stock fabrics</h3>
          </div>
          {low.length === 0 ? (
            <p className="text-sm text-gray-500">All fabrics are above their thresholds. 👍</p>
          ) : (
            <div className="space-y-2">
              {low.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-800">{f.name}</div>
                    <div className="text-xs text-gray-500">{f.product_id}</div>
                  </div>
                  <span className="badge bg-amber-100 text-amber-800">
                    {round2(fromBase(f.quantity_base, f.unit))} {f.unit} left
                  </span>
                </div>
              ))}
              {isAdmin && (
                <Link href="/stock" className="mt-2 inline-block text-sm text-brand-600 hover:underline">
                  Manage stock →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  tone = 'brand'
}: {
  icon: JSX.Element
  label: string
  value: string
  tone?: 'brand' | 'amber'
}): JSX.Element {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            tone === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700'
          }`}
        >
          {icon}
        </div>
        <div>
          <div className="text-xs text-gray-500">{label}</div>
          <div className="text-xl font-bold text-gray-900">{value}</div>
        </div>
      </div>
    </div>
  )
}
