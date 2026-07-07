// Fabric is stored internally in centimeters (the base unit). Staff can enter and
// view quantities in any convenient unit; the UI converts on entry and display.
// See implementation plan §6.

import type { FabricUnit } from './types'

// Centimeters per 1 of each unit.
export const CM_PER_UNIT: Record<FabricUnit, number> = {
  cm: 1,
  inch: 2.54,
  feet: 30.48,
  meter: 100,
  gaz: 91.44 // Gaz/Yard — the South Asian fabric-trade unit (~1 yard)
}

export const UNIT_LABELS: Record<FabricUnit, string> = {
  inch: 'Inch (ইঞ্চি)',
  feet: 'Feet (ফুট)',
  cm: 'Centimeter (সেমি)',
  meter: 'Meter (মিটার)',
  gaz: 'Gaz/Yard (গজ)'
}

export const ALL_UNITS: FabricUnit[] = ['inch', 'feet', 'cm', 'meter', 'gaz']

/** Convert a value in the given unit to the base unit (centimeters). */
export function toBase(value: number, unit: FabricUnit): number {
  return value * CM_PER_UNIT[unit]
}

/** Convert a value in centimeters to the given unit. */
export function fromBase(baseValue: number, unit: FabricUnit): number {
  return baseValue / CM_PER_UNIT[unit]
}

/** Format a base (cm) quantity in the preferred unit, e.g. "3.50 Gaz". */
export function formatFromBase(baseValue: number, unit: FabricUnit): string {
  const v = fromBase(baseValue, unit)
  const label = unit.charAt(0).toUpperCase() + unit.slice(1)
  return `${round2(v)} ${label}`
}

/** Convert a base (cm) quantity to meters, rounded. */
export function toMeter(baseValue: number): number {
  return round2(baseValue / CM_PER_UNIT.meter)
}

/** Convert a value entered in `unit` directly to meters, rounded. */
export function unitToMeter(value: number, unit: FabricUnit): number {
  return round2(toBase(value, unit) / CM_PER_UNIT.meter)
}

/** Show a base (cm) quantity in its display unit AND the meter equivalent,
 *  e.g. "3.5 gaz (3.2 m)". When the unit already is meter, the suffix is dropped. */
export function withMeter(baseValue: number, unit: FabricUnit): string {
  const primary = `${round2(fromBase(baseValue, unit))} ${unit}`
  if (unit === 'meter') return primary
  return `${primary} (${toMeter(baseValue)} m)`
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
