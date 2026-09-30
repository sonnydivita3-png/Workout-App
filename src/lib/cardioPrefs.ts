import { BUILTIN_BY_ID } from '../data/exercises'
import type { Exercise } from '../types'
import { hasGear, withGearFor } from './equipment'

/**
 * Kinds of cardio someone can say they like. `wod` is a sensible amount for one station in a timed workout
 * (about a minute of work); without one, the machine is only used for steady cardio.
 */
export interface CardioType {
  id: string
  label: string
  exerciseId: string
  wod?: { amount: number; unit: 'cal' | 'm' | 's' | 'reps' }
}

export const CARDIO_TYPES: CardioType[] = [
  { id: 'run', label: 'Running', exerciseId: 'running', wod: { amount: 200, unit: 'm' } },
  { id: 'treadmill', label: 'Treadmill', exerciseId: 'Running_Treadmill', wod: { amount: 200, unit: 'm' } },
  { id: 'row', label: 'Rower', exerciseId: 'x-row-erg', wod: { amount: 12, unit: 'cal' } },
  { id: 'ski', label: 'SkiErg', exerciseId: 'x-skierg', wod: { amount: 12, unit: 'cal' } },
  { id: 'airbike', label: 'Air bike (Assault / Echo)', exerciseId: 'x-air-bike', wod: { amount: 10, unit: 'cal' } },
  { id: 'bikeerg', label: 'BikeErg', exerciseId: 'x-bike-erg', wod: { amount: 15, unit: 'cal' } },
  { id: 'bike', label: 'Stationary bike', exerciseId: 'Bicycling_Stationary', wod: { amount: 60, unit: 's' } },
  { id: 'elliptical', label: 'Elliptical', exerciseId: 'Elliptical_Trainer', wod: { amount: 60, unit: 's' } },
  { id: 'stairs', label: 'Stair climber', exerciseId: 'Stairmaster', wod: { amount: 60, unit: 's' } },
  { id: 'versa', label: 'VersaClimber', exerciseId: 'x-versaclimber', wod: { amount: 45, unit: 's' } },
  { id: 'rope', label: 'Jump rope', exerciseId: 'Rope_Jumping', wod: { amount: 60, unit: 'reps' } },
  { id: 'walk', label: 'Walking', exerciseId: 'walking' },
  { id: 'cycle', label: 'Cycling outside', exerciseId: 'cycling' },
  { id: 'swim', label: 'Swimming', exerciseId: 'swimming' },
]
const BY_EXERCISE = new Map(CARDIO_TYPES.map((c) => [c.exerciseId, c]))
export const cardioTypeOf = (exerciseId: string) => BY_EXERCISE.get(exerciseId)

/** When nobody has said what they like, timed workouts use the classic CrossFit/Hyrox machines and running. */
const DEFAULT_WOD = ['run', 'row', 'ski', 'airbike', 'bikeerg', 'rope']

// The person's cardio preference, set from their profile like equipment (null = no preference).
let liked: string[] | null = null
let split = false

export function setCardioPrefs(ids: readonly string[] | null, splitTime = false) {
  liked = ids && ids.length ? [...ids] : null
  split = splitTime
}
export const cardioSplit = () => split && !!liked && liked.length > 1

/** Run a generator with a one-off cardio choice, then restore the profile setting. */
export function withCardioFor<T>(ids: readonly string[] | null, splitTime: boolean, fn: () => T): T {
  const prev = [liked, split] as const
  setCardioPrefs(ids, splitTime)
  try {
    return fn()
  } finally {
    ;[liked, split] = prev
  }
}

const exerciseOf = (c: CardioType) => BUILTIN_BY_ID.get(c.exerciseId)
const usable = (list: CardioType[]) => list.map(exerciseOf).filter((e): e is Exercise => !!e && hasGear(e))

/** Steady cardio the person likes and can do, or null for "anything". */
export function likedCardio(): Exercise[] | null {
  if (!liked) return null
  const ok = usable(CARDIO_TYPES.filter((c) => liked!.includes(c.id)))
  return ok.length ? ok : null
}

/** Machines (and running) for a station in a timed workout: the ones they like, else the classic ones. */
export function wodCardio(): Exercise[] {
  const fits = CARDIO_TYPES.filter((c) => c.wod)
  const mine = liked ? usable(fits.filter((c) => liked!.includes(c.id))) : []
  return mine.length ? mine : usable(fits.filter((c) => DEFAULT_WOD.includes(c.id)))
}

/** "12 cal", "200 m", "60 reps" or "45s" for one station; `scale` stretches it (e.g. longer rounds). */
export function wodAmount(exerciseId: string, scale = 1): string {
  const w = cardioTypeOf(exerciseId)?.wod ?? { amount: 60, unit: 's' as const }
  const step = w.unit === 'm' ? 50 : w.unit === 'reps' ? 10 : w.unit === 's' ? 15 : 1
  const n = Math.max(step, Math.round((w.amount * scale) / step) * step)
  return w.unit === 's' ? `${n}s` : `${n} ${w.unit}`
}

/** Cardio kinds someone can do with `gear` (machines need a gym; running and walking don't). */
export const cardioFor = (gear: readonly string[] | null) =>
  withGearFor(gear, () => CARDIO_TYPES.filter((c) => { const e = exerciseOf(c); return !!e && hasGear(e) }))
