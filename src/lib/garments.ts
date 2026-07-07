// Declarative definition of the garment configurator (implementation plan §3).
// The order form renders measurement inputs and style controls dynamically from
// these definitions, so adding a garment type or field later is a code change
// here — not a database migration (measurements & style choices are stored as
// JSON on the order_item row).

import type { GarmentType } from './types'
import { t } from './labels'

export interface MeasurementField {
  key: string
  label: string
}

export type StyleControl =
  | {
      type: 'single'
      key: string
      label: string
      options: { value: string; label: string }[]
      // Optional visibility predicate based on other selected style values.
      showWhen?: (values: Record<string, unknown>) => boolean
    }
  | {
      type: 'toggle'
      key: string
      label: string
      showWhen?: (values: Record<string, unknown>) => boolean
    }
  | {
      type: 'number'
      key: string
      label: string
      showWhen?: (values: Record<string, unknown>) => boolean
    }
  | {
      type: 'text'
      key: string
      label: string
      showWhen?: (values: Record<string, unknown>) => boolean
    }
  | {
      // Multi-line free note. Excluded from the customer invoice; shown on the
      // tailor job card only.
      type: 'textarea'
      key: string
      label: string
      showWhen?: (values: Record<string, unknown>) => boolean
    }

export interface GarmentDef {
  type: GarmentType
  measurements: MeasurementField[]
  style: StyleControl[]
}

const m = (key: string): MeasurementField => ({ key, label: t(key) })

const note = (): StyleControl => ({ type: 'textarea', key: 'note', label: 'Note (নোট)' })

// ---------------- Suit / Coat (§3.1) ----------------
// Kept fields only (per shop request): Long, Body (+2 extra boxes), Foot, Sleeve,
// Sleeve Mohori, Neck, F, B and XB (two input boxes) — plus a free note.
const coat: GarmentDef = {
  type: 'coat',
  measurements: [
    m('long'),
    m('body'),
    m('body_2'),
    m('body_3'),
    m('foot'),
    m('sleeve_length'),
    m('sleeve_mohuri'),
    m('neck'),
    m('fd'),
    m('cb'),
    m('xb')
  ],
  style: [note()]
}

// ---------------- Pant (§3.2) ----------------
// Kept measurements: Long, Waist, Hip, Thigh, Mohori, High, F, B.
// Style: five choose-one controls shown on one line.
const pant: GarmentDef = {
  type: 'pant',
  measurements: [
    m('long'),
    m('waist'),
    m('hip'),
    m('thigh'),
    m('thigh_mohuri'),
    m('high_rise'),
    m('fd'),
    m('cb')
  ],
  style: [
    {
      type: 'single',
      key: 'pocket',
      label: 'Pocket (পকেট)',
      options: [
        { value: '1', label: '1' },
        { value: '2', label: '2' }
      ]
    },
    {
      type: 'single',
      key: 'beg_pocket',
      label: 'Beg Pocket (ব্যাগ পকেট)',
      options: [
        { value: '=', label: '=' },
        { value: '-', label: '-' }
      ]
    },
    {
      type: 'single',
      key: 'ticken',
      label: 'Ticken (টিকেন)',
      options: [
        { value: 'yes', label: 'Yes (হ্যাঁ)' },
        { value: 'no', label: 'No (না)' }
      ]
    },
    {
      type: 'single',
      key: 'folding',
      label: 'Folding (ভাঁজ)',
      options: [
        { value: 'yes', label: 'Yes (হ্যাঁ)' },
        { value: 'no', label: 'No (না)' }
      ]
    },
    {
      type: 'single',
      key: 'lob',
      label: 'Loob (লুব)',
      options: [
        { value: '5', label: '5' },
        { value: '6', label: '6' },
        { value: '7', label: '7' },
        { value: '8', label: '8' }
      ]
    },
    note()
  ]
}

// ---------------- Shirt (§3.3) ----------------
// Kept fields only: Long, Body (+2 extra boxes), Foot, Sleeve, Cuff (+2 extra
// boxes), Sleeve Mohori, Neck — plus a free note.
const shirt: GarmentDef = {
  type: 'shirt',
  measurements: [
    m('long'),
    m('body'),
    m('body_2'),
    m('body_3'),
    m('foot'),
    m('sleeve_length'),
    m('cuff'),
    m('cuff_2'),
    m('cuff_3'),
    m('sleeve_mohuri'),
    m('neck')
  ],
  style: [note()]
}

// ---------------- Panjabi (§3.4) ----------------
// Working assumption per plan §3.4: reuses the Shirt measurement set.
const panjabi: GarmentDef = {
  type: 'panjabi',
  measurements: shirt.measurements,
  style: [note()]
}

export const GARMENTS: Record<GarmentType, GarmentDef> = {
  coat,
  pant,
  shirt,
  panjabi
}

export const GARMENT_ORDER: GarmentType[] = ['coat', 'pant', 'shirt', 'panjabi']

export function getGarment(type: GarmentType): GarmentDef {
  return GARMENTS[type]
}

/** Human-readable summary of the selected style options, for slips & history. */
export function describeStyle(type: GarmentType, values: Record<string, unknown>): string[] {
  const def = GARMENTS[type]
  const parts: string[] = []
  for (const ctrl of def.style) {
    if (ctrl.showWhen && !ctrl.showWhen(values)) continue
    // The free note is rendered separately (job card only), never as a style chip.
    if (ctrl.type === 'textarea') continue
    const val = values[ctrl.key]
    if (ctrl.type === 'toggle') {
      if (val) parts.push(ctrl.label)
    } else if (ctrl.type === 'number' || ctrl.type === 'text') {
      if (val === undefined || val === null || val === '') continue
      parts.push(`${ctrl.label}: ${String(val)}`)
    } else {
      if (val === undefined || val === null || val === '' || val === 'none') continue
      const opt = ctrl.options.find((o) => o.value === val)
      parts.push(`${ctrl.label}: ${opt ? opt.label : String(val)}`)
    }
  }
  return parts
}
