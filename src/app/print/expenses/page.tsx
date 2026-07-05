'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { bdt, fmtDate, reportRange } from '@/lib/format'
import type { Expense, ExpenseFilters } from '@/lib/types'
import { Spinner } from '@/components/ui'
import { PrintToolbar, ReportHeader } from '@/components/print'

function ExpenseReport(): JSX.Element {
  const sp = useSearchParams()
  const toast = useToast()
  const [rows, setRows] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  const filters: ExpenseFilters = useMemo(
    () => ({ from: sp.get('from') || null, to: sp.get('to') || null, category: sp.get('category') || null }),
    [sp]
  )

  useEffect(() => {
    api.expenses
      .list(filters)
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [filters])

  const total = rows.reduce((s, e) => s + e.amount, 0)
  const byCat = new Map<string, number>()
  for (const e of rows) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount)

  return (
    <div>
      <PrintToolbar backHref="/reports" />
      <div className="print-area card mx-auto max-w-4xl p-8">
        <ReportHeader
          title="Expense Report"
          subtitle={reportRange(filters.from, filters.to) + (filters.category ? ` · ${filters.category}` : '')}
        />
        {loading ? (
          <Spinner label="Loading…" />
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">No expenses in this period.</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="border-b-2 border-gray-300">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Category</th>
                  <th className="th">Description</th>
                  <th className="th text-right">Amount</th>
                  <th className="th">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="td whitespace-nowrap">{fmtDate(e.spent_on)}</td>
                    <td className="td">{e.category}</td>
                    <td className="td">{e.description || '—'}</td>
                    <td className="td text-right">{bdt(e.amount)}</td>
                    <td className="td">{e.created_by_name}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-400 font-semibold">
                <tr>
                  <td className="td" colSpan={3}>
                    {rows.length} expenses
                  </td>
                  <td className="td text-right">{bdt(total)}</td>
                  <td className="td"></td>
                </tr>
              </tfoot>
            </table>
            <div className="mt-4 text-sm">
              <div className="mb-1 font-semibold text-gray-700">By category</div>
              {[...byCat.entries()].map(([c, v]) => (
                <div key={c} className="flex justify-between border-b border-dotted border-gray-200 py-0.5">
                  <span className="text-gray-600">{c}</span>
                  <span>{bdt(v)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ExpensesPrintPage(): JSX.Element {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <ExpenseReport />
    </Suspense>
  )
}
