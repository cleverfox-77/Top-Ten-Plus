'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import JsBarcode from 'jsbarcode'
import { Printer, ArrowLeft } from 'lucide-react'
import Logo from '@/components/Logo'

/** A scannable Code128 barcode rendered as inline SVG (prints crisply). */
export function Barcode({
  value,
  height = 40,
  className = ''
}: {
  value: string
  height?: number
  className?: string
}): JSX.Element {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current) return
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        height,
        width: 1.6,
        displayValue: true,
        fontSize: 12,
        textMargin: 1,
        margin: 0,
        marginBottom: 4
      })
      // Give the generated SVG a viewBox so it can scale down proportionally to
      // fit a narrow container (e.g. a tight job-card cell) instead of
      // overflowing at its intrinsic width.
      const svg = ref.current
      const w = svg.getAttribute('width')
      const h = svg.getAttribute('height')
      if (w && h) svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
    } catch {
      /* ignore invalid values */
    }
  }, [value, height])
  return (
    <svg ref={ref} className={className} style={{ maxWidth: '100%', height: 'auto', display: 'block' }} />
  )
}

/** Branded header for printed reports: logo on the left, title/subtitle right. */
export function ReportHeader({
  title,
  subtitle
}: {
  title: string
  subtitle?: string
}): JSX.Element {
  return (
    <div className="mb-4 flex items-end justify-between border-b-2 border-brand-600 pb-3">
      <Logo className="h-14 w-auto" />
      <div className="text-right">
        <div className="text-lg font-bold text-gray-900">{title}</div>
        {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
      </div>
    </div>
  )
}

/** On-screen toolbar (hidden when printing) with Back + Print buttons. */
export function PrintToolbar({ backHref }: { backHref?: string }): JSX.Element {
  const router = useRouter()
  return (
    <div className="no-print mb-4 flex items-center gap-2">
      <button
        className="btn-secondary"
        onClick={() => (backHref ? router.push(backHref) : router.back())}
      >
        <ArrowLeft size={18} /> Back
      </button>
      <button className="btn-primary" onClick={() => window.print()}>
        <Printer size={18} /> Print
      </button>
    </div>
  )
}

export const DISCLAIMER =
  'Goods once delivered are not returnable. New Top Ten Plus is not liable for garments left unclaimed beyond 30 days of the delivery date.'
