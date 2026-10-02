import type { Exercise } from '../types'

/** Equipment someone can say they have. Bodyweight moves are always allowed. */
export const GEAR = ['Barbell', 'Dumbbell', 'Kettlebell', 'Cable', 'Machine', 'Bands', 'Other'] as const
export type Gear = (typeof GEAR)[number]

export const GEAR_LABELS: Record<Gear, string> = {
  Barbell: 'Barbell & plates', Dumbbell: 'Dumbbells', Kettlebell: 'Kettlebells', Cable: 'Cable machine',
  Machine: 'Machines (leg press, rower…)', Bands: 'Resistance bands', Other: 'Other (dip bars, bench, balls, sled…)',
}

export const GEAR_PRESETS: { id: string; label: string; gear: Gear[] | null }[] = [
  { id: 'gym', label: 'Full gym', gear: null },
  { id: 'crossfit', label: 'CrossFit box', gear: ['Barbell', 'Dumbbell', 'Kettlebell', 'Machine', 'Other'] },
  { id: 'home', label: 'Home gym', gear: ['Barbell', 'Dumbbell', 'Kettlebell', 'Bands', 'Other'] },
  { id: 'hotel', label: 'Hotel gym', gear: ['Dumbbell', 'Machine'] },
  { id: 'dumbbells', label: 'Dumbbells only', gear: ['Dumbbell'] },
  { id: 'bodyweight', label: 'Bodyweight only', gear: [] },
]

export const sameGear = (a: readonly string[] | null, b: readonly string[] | null) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((x) => b.includes(x)))

/** "Full gym", "Dumbbells only", or how many kinds were picked. */
export const equipmentSummary = (gear: string[] | null) =>
  GEAR_PRESETS.find((p) => sameGear(p.gear, gear))?.label ?? `${gear!.length} kind${gear!.length === 1 ? '' : 's'} of equipment`

/** The equipment family an exercise needs ('Bodyweight' when none). */
export function gearOf(e: Exercise): Gear | 'Bodyweight' | 'Outdoor' {
  const k = e.equipment ?? ''
  if (k === 'Bodyweight' || k === '') return 'Bodyweight'
  if (k === 'Outdoor') return 'Outdoor'
  if (k === 'EZ bar') return 'Barbell'
  return (GEAR as readonly string[]).includes(k) ? (k as Gear) : 'Other'
}

// What the person has, set from their profile (null = a full gym, anything goes). Generators check it through
// hasGear, so every generated workout and plan sticks to what's available.
let owned: Set<string> | null = null

export function setOwnedGear(gear: readonly string[] | null) {
  owned = gear ? new Set(gear) : null
}

export function hasGear(e: Exercise): boolean {
  if (!owned) return true
  const g = gearOf(e)
  return g === 'Bodyweight' || g === 'Outdoor' || owned.has(g)
}

/** Keep the exercises someone can do; if that would leave nothing, keep the original list rather than fail. */
export function withGear<T extends Exercise>(list: T[]): T[] {
  const ok = list.filter(hasGear)
  return ok.length ? ok : list
}

/** Run a generator with a one-off equipment choice (e.g. "bodyweight only" at a hotel), then restore the setting. */
export function withGearFor<T>(gear: readonly string[] | null, fn: () => T): T {
  const prev = owned
  setOwnedGear(gear)
  try {
    return fn()
  } finally {
    owned = prev
  }
}

/** A home or garage setup: some equipment, but no machines or cables, so the rack, bench and bar are all in one spot. */
export const isHomeSetup = () => !!owned && !owned.has('Machine') && !owned.has('Cable')
