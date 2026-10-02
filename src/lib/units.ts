import type { Units } from '../types'

const LB_PER_KG = 2.20462262
const MI_PER_KM = 0.62137119

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp

export const weightFactor = (u: Units) => (u.weight === 'kg' ? 1 / LB_PER_KG : 1)
export const distanceFactor = (u: Units) => (u.distance === 'km' ? 1 / MI_PER_KM : 1)

export const showWeight = (lb: number | null, u: Units) => (lb == null ? null : round(lb * weightFactor(u)))
export const storeWeight = (v: number | null, u: Units) => (v == null ? null : v / weightFactor(u))
export const showDistance = (mi: number | null, u: Units) => (mi == null ? null : round(mi * distanceFactor(u)))
export const storeDistance = (v: number | null, u: Units) => (v == null ? null : v / distanceFactor(u))

export function formatPace(mi: number | null, minutes: number | null, u: Units): string | null {
  if (!mi || !minutes) return null
  const perUnit = minutes / (mi * distanceFactor(u))
  let m = Math.floor(perUnit)
  let s = Math.round((perUnit - m) * 60)
  if (s === 60) { m += 1; s = 0 }
  return `${m}:${String(s).padStart(2, '0')} /${u.distance}`
}

/** 45 -> "45s", 90 -> "1:30". */
export const formatSeconds = (s: number) =>
  s < 90 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

/** 45 -> "45 min", 150 -> "2h 30m". */
export const formatMinutes = (m: number) => (m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`)

/** Bike speed: stored as mph, shown as mph or km/h. */
export const showSpeed = (mph: number, u: Units) => Math.round(mph * distanceFactor(u) * 10) / 10
export const speedUnit = (u: Units) => (u.distance === 'km' ? 'km/h' : 'mph')

// ---- Distance by machine. Rowers, SkiErgs and BikeErgs (Concept2-style monitors) count meters and pace per 500 m,
// whatever the miles/km setting; everything else uses that setting. Distances are always stored in miles.
const METERS_PER_MI = 1609.344
const METER_MACHINES = new Set(['x-row-erg', 'Rowing_Stationary', 'x-skierg', 'x-bike-erg'])
export type DistanceUnit = 'mi' | 'km' | 'm'

export const distanceUnitFor = (exerciseId: string | undefined, u: Units): DistanceUnit =>
  exerciseId && METER_MACHINES.has(exerciseId) ? 'm' : u.distance

export const showDistanceIn = (mi: number | null, unit: DistanceUnit): number | null =>
  mi == null ? null : unit === 'm' ? Math.round(mi * METERS_PER_MI) : round(unit === 'km' ? mi / MI_PER_KM : mi)
export const storeDistanceIn = (v: number | null, unit: DistanceUnit): number | null =>
  v == null ? null : unit === 'm' ? v / METERS_PER_MI : unit === 'km' ? v * MI_PER_KM : v

/** "2,000 m", "3.1 mi". */
export const formatDistanceFor = (mi: number | null, exerciseId: string | undefined, u: Units): string | null => {
  const unit = distanceUnitFor(exerciseId, u)
  const v = showDistanceIn(mi, unit)
  return v == null || !mi ? null : `${v.toLocaleString()} ${unit}`
}

/** Pace per mile or km, or per 500 m on a rower. */
export function formatPaceFor(mi: number | null, minutes: number | null, exerciseId: string | undefined, u: Units): string | null {
  if (!mi || !minutes) return null
  const unit = distanceUnitFor(exerciseId, u)
  if (unit !== 'm') return formatPace(mi, minutes, u)
  const per500 = minutes / ((mi * METERS_PER_MI) / 500)
  let m = Math.floor(per500)
  let s = Math.round((per500 - m) * 60)
  if (s === 60) { m += 1; s = 0 }
  return `${m}:${String(s).padStart(2, '0')} /500m`
}

/** Cardio time: "30 min", or "7:32" when it has seconds (a 2,000 m row), "1:05:20" past an hour. */
export function formatCardioTime(minutes: number | null): string | null {
  if (!minutes) return null
  const total = Math.round(minutes * 60)
  if (total % 60 === 0) return formatMinutes(total / 60)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** One line for a cardio log: "2,000 m · 7:32 · 1:53 /500m". */
export const cardioLine = (c: { distance: number | null; minutes: number | null }, exerciseId: string | undefined, u: Units): string =>
  [formatDistanceFor(c.distance, exerciseId, u), formatCardioTime(c.minutes), formatPaceFor(c.distance, c.minutes, exerciseId, u)].filter(Boolean).join(' · ') || '–'
