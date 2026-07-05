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
    }

export interface GarmentDef {
  type: GarmentType
  measurements: MeasurementField[]
  style: StyleControl[]
}

const m = (key: string): MeasurementField => ({ key, label: t(key) })

// ---------------- Suit / Coat (§3.1) ----------------
const coat: GarmentDef = {
  type: 'coat',
  measurements: [
    m('long'),
    m('chest'),
    m('belly'),
    m('hip'),
    m('neck'),
    m('shoulder'),
    m('sleeve_length'),
    m('sleeve_mohuri'),
    m('fd_cb'),
    m('shoulder_ds')
  ],
  style: [
    {
      type: 'single',
      key: 'garment_style',
      label: 'Garment Style',
      options: [
        { value: 'double_breasted', label: 'Double breasted' },
        { value: 'single_breasted', label: 'Single breasted' },
        { value: 'prince_coat', label: 'Prince coat' },
        { value: 'mujib_coat', label: 'Mujib coat' },
        { value: 'sherwani', label: 'Sherwani' },
        { value: 'band_collar_coat', label: 'Band collar coat' }
      ]
    },
    {
      type: 'single',
      key: 'button_count',
      label: 'Button Count',
      options: [
        { value: '1', label: '1' },
        { value: '2', label: '2' },
        { value: '3', label: '3' },
        { value: '4', label: '4' }
      ]
    },
    // Bottom shape & side vent apply to all suits; button style is single-breasted only.
    {
      type: 'single',
      key: 'sb_bottom_shape',
      label: 'Bottom Shape',
      options: [
        { value: 'lob_round', label: 'Round at bottom (নিচে গোল)' },
        { value: 'straight_bottom', label: 'Straight at bottom (নিচে সোজা)' }
      ]
    },
    {
      type: 'single',
      key: 'sb_button_style',
      label: 'Button Style',
      showWhen: (v) => v.garment_style === 'single_breasted',
      options: [
        { value: '2_button', label: '2 Button' },
        { value: '3_button', label: '3 Button' }
      ]
    },
    {
      type: 'single',
      key: 'sb_side_vent',
      label: 'Side Vent',
      options: [
        { value: 'side_open', label: 'Side open (সাইড খোলা)' },
        { value: 'side_closed', label: 'Side closed (সাইড বন্ধ)' }
      ]
    }
  ]
}

// ---------------- Pant (§3.2) ----------------
const pant: GarmentDef = {
  type: 'pant',
  measurements: [
    m('long'),
    m('waist'),
    m('hip'),
    m('thigh'),
    m('thigh_mohuri'),
    m('high_rise')
  ],
  style: [
    { type: 'toggle', key: 'two_kuchi', label: '2 Kuchi' },
    { type: 'toggle', key: 'short_2_kuchi_cross_pocket', label: 'Short 2 Kuchi cross pocket' },
    {
      type: 'single',
      key: 'back_pocket',
      label: 'Back Pocket',
      options: [
        { value: 'none', label: 'None' },
        { value: '1', label: '1' },
        { value: '2', label: '2' }
      ]
    },
    { type: 'toggle', key: 'no_tickin_no_kuchi_cross_pocket', label: 'No tickin / No kuchi cross pocket' },
    { type: 'toggle', key: 'hip_pocket_at_back', label: 'Hip pocket at back' },
    { type: 'toggle', key: 'folding_at_bottom', label: 'Folding at bottom' }
  ]
}

// ---------------- Shirt (§3.3) ----------------
const shirt: GarmentDef = {
  type: 'shirt',
  measurements: [
    m('long'),
    m('body'),
    m('belly'),
    m('hip'),
    m('neck'),
    m('shoulder'),
    m('sleeve_length'),
    m('sleeve_calf'),
    m('sleeve_mid_width'),
    m('sleeve_mid_bottom')
  ],
  style: [
    {
      type: 'single',
      key: 'plate_style',
      label: 'Plate Style',
      options: [
        { value: 'one_shirt', label: 'One shirt (no plate)' },
        { value: 'box_plate', label: 'Box plate' }
      ]
    },
    {
      type: 'single',
      key: 'pocket',
      label: 'Pocket',
      options: [
        { value: 'one_pocket', label: 'One pocket' },
        { value: 'no_pocket', label: 'No pocket' }
      ]
    },
    {
      type: 'single',
      key: 'collar',
      label: 'Collar',
      options: [
        { value: 'semi_aero', label: '2.5 inch semi aero collar' },
        { value: 'full_chinese', label: 'Full Chinese shirt' }
      ]
    },
    {
      type: 'single',
      key: 'fit',
      label: 'Fit',
      options: [
        { value: 'medium_loose', label: 'Medium loose' },
        { value: 'over_loose', label: 'Over loose' },
        { value: 'fitting', label: 'Fitting' }
      ]
    },
    {
      type: 'single',
      key: 'side_cut',
      label: 'Side Cut',
      options: [
        { value: 'half_wide', label: 'Half wide shirt' },
        { value: 'two_inch_side_cut', label: '2 inch side cut' }
      ]
    }
  ]
}

// ---------------- Panjabi (§3.4) ----------------
// Working assumption per plan §3.4: reuses the Shirt measurement set.
const panjabi: GarmentDef = {
  type: 'panjabi',
  measurements: shirt.measurements,
  style: [
    { type: 'toggle', key: 'one_sata_panjabi', label: '1 Sata Panjabi' },
    {
      type: 'toggle',
      key: 'round_sherwani_band',
      label: 'Round sherwani band, half inch, 4 button'
    }
  ]
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
    if (ctrl.type === 'toggle') {
      if (values[ctrl.key]) parts.push(ctrl.label)
    } else {
      if (ctrl.showWhen && !ctrl.showWhen(values)) continue
      const val = values[ctrl.key]
      if (val === undefined || val === null || val === '' || val === 'none') continue
      const opt = ctrl.options.find((o) => o.value === val)
      parts.push(`${ctrl.label}: ${opt ? opt.label : String(val)}`)
    }
  }
  return parts
}
