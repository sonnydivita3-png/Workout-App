import type { AboutMe, PlannedExercise } from '../types'
import { metFor, restingPerHour } from './calories'
import type { CardioSessionKind } from './cardioSession'
import type { WorkoutStyle } from './randomizer'
import { BY_ID } from './randomUtil'
import { liftMinutes } from './timing'

// ---------------------------------------------------------------------------------------------
// A workout built to burn about so many calories. Each part burns (MET − resting) × bodyweight × time, the same net
// estimate the app gives for cardio (see calories.ts). METs from the Compendium of Physical Activities: weight
// training with the usual rests is light work (about 3.5), circuits with little rest are vigorous (about 8).
// ---------------------------------------------------------------------------------------------

/** MET for each workout style, rests included. */
export const STYLE_MET: Record<WorkoutStyle, number> = {
  standard: 3.5, // resistance training, multiple exercises, 8-15 reps
  strength: 3.5, // heavy sets, long rests
  bodyweight: 3.8, // calisthenics, moderate effort
  supersets: 5.0, // less rest between sets
  pha: 6.0,
  emom: 7.0,
  circuit: 8.0, // circuit training, vigorous, minimal rest
  amrap: 8.0,
  fortime: 8.0,
  tabata: 8.0,
  crossfit: 8.0,
  hyrox: 8.0,
}
/** Warm-up: easy cardio, then mobility (stretching, about 2.3). */
export const WARMUP_MET = 3.2

/** Harder cardio sessions burn more a minute than steady ones (recoveries included). */
export const SESSION_FACTOR: Record<CardioSessionKind, number> = { steady: 1, intervals: 1.1, tempo: 1.15, hills: 1.15, trial: 1.25 }

/**
 * MET for the cardio part: its activity at a usual pace (the average when several are possible), adjusted for the
 * session. With nothing to go on, a typical mix of runs, rides and machines (about 7).
 */
export function cardioMet(ids: string[], kind: CardioSessionKind): number {
  const base = ids.length ? ids.reduce((a, id) => a + metFor(id, { distance: null, minutes: null }), 0) / ids.length : 7
  return base * SESSION_FACTOR[kind]
}

/** Net calories a minute at a MET for this person. */
export const perMinute = (met: number, lb: number, date: string, me?: AboutMe | null) =>
  Math.max(0, (met * lb * 0.45359237 - restingPerHour(lb, date, me)) / 60)

export interface CaloriePart {
  key: string
  met: number
  /** Minutes they set for it (used as-is, or as its share of the time when the time is worked out). */
  minutes: number
}

export interface CaloriePlan {
  minutes: Record<string, number>
  kcal: Record<string, number>
  totalMinutes: number
  totalKcal: number
}

const round5 = (m: number) => Math.max(5, Math.round(m / 5) * 5)

/**
 * Minutes for each part to burn about `target` calories. With a `flexible` part (the cardio), the others keep their
 * minutes and it makes up the rest (at least 5 minutes). Without one, the warm-up keeps its minutes and the other parts
 * keep their shares of the time and grow (or shrink) together. Minutes round to 5.
 */
export function planForCalories(target: number, parts: CaloriePart[], rate: (met: number) => number, flexible?: string): CaloriePlan {
  const minutes: Record<string, number> = {}
  const fixed = parts.filter((p) => p.key === 'warmup' || (flexible && p.key !== flexible))
  for (const p of fixed) minutes[p.key] = p.minutes
  const fixedKcal = fixed.reduce((a, p) => a + p.minutes * rate(p.met), 0)
  const rest = Math.max(0, target - fixedKcal)
  const grow = parts.filter((p) => !fixed.includes(p))
  if (flexible) {
    const f = grow.find((p) => p.key === flexible)
    if (f) minutes[f.key] = round5(rest / Math.max(0.1, rate(f.met)))
  } else if (grow.length) {
    const share = grow.reduce((a, p) => a + p.minutes, 0) || grow.length
    const perShare = grow.reduce((a, p) => a + ((p.minutes || 1) / share) * rate(p.met), 0)
    const time = rest / Math.max(0.1, perShare)
    for (const p of grow) minutes[p.key] = round5(((p.minutes || 1) / share) * time)
  }
  const kcal = Object.fromEntries(parts.map((p) => [p.key, Math.round(minutes[p.key] * rate(p.met))]))
  return {
    minutes, kcal,
    totalMinutes: parts.reduce((a, p) => a + minutes[p.key], 0),
    totalKcal: Object.values(kcal).reduce((a, k) => a + k, 0),
  }
}

// ---------------------------------------------------------------------------------------------
// The workout as made: what it really burns (its own cardio activities, which may not be the ones planned for when
// "any" was picked), and its cardio stretched or shortened to land on the target.
// ---------------------------------------------------------------------------------------------

const minutesOf = (p: PlannedExercise) => p.est ?? (BY_ID.get(p.exerciseId) ? liftMinutes(p, BY_ID.get(p.exerciseId)) : 0)
/** A main cardio piece: a cardio exercise with planned minutes, not the warm-up or a station in a timed block. */
const isCardioPiece = (p: PlannedExercise) => !p.warmup && !p.block && !!p.minutes && BY_ID.get(p.exerciseId)?.kind === 'cardio'
const pieceMet = (p: PlannedExercise, factor: number) => metFor(p.exerciseId, { distance: p.distance ?? null, minutes: p.minutes ?? null }) * factor

export interface WorkoutMets { lift: number; cond: number; cardioFactor: number }

/** Estimated net calories for a workout: warm-up, lifting (their style's MET), timed blocks, and each cardio piece. */
export function workoutCalories(items: PlannedExercise[], rate: (met: number) => number, mets: WorkoutMets): number {
  return Math.round(items.reduce((a, p) => {
    const met = isCardioPiece(p) ? pieceMet(p, mets.cardioFactor) : p.warmup ? WARMUP_MET : p.block && !p.block.includes('ss') ? mets.cond : mets.lift
    return a + minutesOf(p) * rate(met)
  }, 0))
}

/**
 * The cardio pieces lengthened or shortened together (each at least 5 minutes, rounded to 5) so the whole workout
 * comes to about `target`. A planned distance scales with its time. Without cardio pieces, the workout is unchanged.
 */
export function fitCardio(items: PlannedExercise[], target: number, rate: (met: number) => number, mets: WorkoutMets): PlannedExercise[] {
  const pieces = items.filter(isCardioPiece)
  if (pieces.length === 0) return items
  const rest = workoutCalories(items.filter((p) => !pieces.includes(p)), rate, mets)
  const now = pieces.reduce((a, p) => a + p.minutes! * rate(pieceMet(p, mets.cardioFactor)), 0)
  const scale = Math.max(0, target - rest) / Math.max(1, now)
  return items.map((p) => {
    if (!pieces.includes(p)) return p
    const minutes = round5(p.minutes! * scale)
    return { ...p, minutes, est: minutes, ...(p.distance ? { distance: Math.round(p.distance * (minutes / p.minutes!) * 10) / 10 } : {}) }
  })
}
