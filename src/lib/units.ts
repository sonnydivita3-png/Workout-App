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

// ---- Distance per exercise. Rowers, SkiErgs and BikeErgs (Concept2-style monitors) default to meters and pace per
// 500 m, swimming to meters and pace per 100; everything else follows the miles/km setting. Any cardio card can switch
// its own unit (kept per exercise in units.byExercise). Distances are always stored in miles.
const METERS_PER_MI = 1609.344
const YARDS_PER_MI = 1760
const ERGS = new Set(['x-row-erg', 'Rowing_Stationary', 'x-skierg', 'x-bike-erg'])
const SWIMS = new Set(['swimming'])
export type DistanceUnit = 'mi' | 'km' | 'm' | 'yd'
const UNITS: DistanceUnit[] = ['mi', 'km', 'm', 'yd']

/** The units a cardio card offers: yards only for swimming. */
export const distanceUnitsFor = (exerciseId: string | undefined): DistanceUnit[] =>
  exerciseId && SWIMS.has(exerciseId) ? ['m', 'yd', 'km', 'mi'] : ['mi', 'km', 'm']

export const defaultDistanceUnit = (exerciseId: string | undefined, u: Pick<Units, 'distance'>): DistanceUnit =>
  exerciseId && (ERGS.has(exerciseId) || SWIMS.has(exerciseId)) ? 'm' : u.distance

export const distanceUnitFor = (exerciseId: string | undefined, u: Units): DistanceUnit => {
  const own = exerciseId ? u.byExercise?.[exerciseId] : undefined
  return own && UNITS.includes(own) && distanceUnitsFor(exerciseId).includes(own) ? own : defaultDistanceUnit(exerciseId, u)
}

export const showDistanceIn = (mi: number | null, unit: DistanceUnit): number | null =>
  mi == null ? null
    : unit === 'm' ? Math.round(mi * METERS_PER_MI)
    : unit === 'yd' ? Math.round(mi * YARDS_PER_MI)
    : round(unit === 'km' ? mi / MI_PER_KM : mi)
export const storeDistanceIn = (v: number | null, unit: DistanceUnit): number | null =>
  v == null ? null : unit === 'm' ? v / METERS_PER_MI : unit === 'yd' ? v / YARDS_PER_MI : unit === 'km' ? v * MI_PER_KM : v

/** "2,000 m", "3.1 mi". */
export const formatDistanceFor = (mi: number | null, exerciseId: string | undefined, u: Units): string | null => {
  const unit = distanceUnitFor(exerciseId, u)
  const v = showDistanceIn(mi, unit)
  return v == null || !mi ? null : `${v.toLocaleString()} ${unit}`
}

/** What pace is per: 500 m on an erg, 100 m or 100 yd swimming, else a km or mile (a run logged in meters: per km). */
export function paceBasis(exerciseId: string | undefined, unit: DistanceUnit): { label: string; miles: number } {
  const swim = !!exerciseId && SWIMS.has(exerciseId)
  if (unit === 'yd') return swim ? { label: '100yd', miles: 100 / YARDS_PER_MI } : { label: 'mi', miles: 1 }
  if (unit === 'm') {
    if (swim) return { label: '100m', miles: 100 / METERS_PER_MI }
    if (exerciseId && ERGS.has(exerciseId)) return { label: '500m', miles: 500 / METERS_PER_MI }
    return { label: 'km', miles: MI_PER_KM }
  }
  return unit === 'km' ? { label: 'km', miles: MI_PER_KM } : { label: 'mi', miles: 1 }
}

/** Pace in the exercise's unit: "8:30 /mi", "1:53 /500m", "1:45 /100m". */
export function formatPaceFor(mi: number | null, minutes: number | null, exerciseId: string | undefined, u: Units): string | null {
  if (!mi || !minutes) return null
  const { label, miles } = paceBasis(exerciseId, distanceUnitFor(exerciseId, u))
  const per = minutes / (mi / miles)
  let m = Math.floor(per)
  let s = Math.round((per - m) * 60)
  if (s === 60) { m += 1; s = 0 }
  return `${m}:${String(s).padStart(2, '0')} /${label}`
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
