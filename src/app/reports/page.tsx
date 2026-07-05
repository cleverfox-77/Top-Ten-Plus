'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp,
  Boxes,
  PackagePlus,
  RotateCcw,
  Wallet,
  ScrollText,
  ArrowRight
} from 'lucide-react'
import { t } from '@/lib/labels'
import { PageHeader } from '@/components/ui'

interface ReportDef {
  title: string
  desc: string
  icon: JSX.Element
  path: string
  useDates: boolean
}

const REPORTS: ReportDef[] = [
  { title: 'Sales report', desc: 'Orders, revenue, paid & due — by date/customer/status', icon: <TrendingUp />, path: '/print/sales', useDates: true },
  { title: 'Stock report', desc: 'Current stock levels and inventory value', icon: <Boxes />, path: '/print/stock', useDates: false },
  { title: 'Stock receiving report', desc: 'Received stock with supplier, challan, cost, cash/due', icon: <PackagePlus />, path: '/print/receiving', useDates: true },
  { title: 'Return report', desc: 'Products returned and added back to stock', icon: <RotateCcw />, path: '/print/returns', useDates: true },
  { title: 'Expense report', desc: 'Shop expenses with category breakdown', icon: <Wallet />, path: '/print/expenses', useDates: true },
  { title: 'Stock movement log (DML)', desc: 'Every stock change: new stock, sales, corrections, returns', icon: <ScrollText />, path: '/print/stock-history', useDates: true }
]

export default function ReportsPage(): JSX.Element {
  const router = useRouter()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const open = (r: ReportDef): void => {
    const q = new URLSearchParams()
    if (r.useDates) {
      if (from) q.set('from', from)
      if (to) q.set('to', to)
    }
    const qs = q.toString()
    router.push(qs ? `${r.path}?${qs}` : r.path)
  }

  return (
    <div>
      <PageHeader title={t('reports')} subtitle="Printable reports across sales, stock, suppliers and money" />

      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="mb-1 block text-xs text-gray-500">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <span className="text-xs text-gray-400">Date range applies to reports that support it.</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <button
            key={r.path}
            onClick={() => open(r)}
            className="card group p-5 text-left transition-colors hover:border-brand-300"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
              {r.icon}
            </div>
            <div className="mb-1 flex items-center justify-between font-semibold text-gray-800">
              {r.title}
              <ArrowRight size={16} className="text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-brand-500" />
            </div>
            <p className="text-sm text-gray-500">{r.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
