import type { AboutMe, Exercise, ExerciseLog, PlannedExercise } from '../types'
import { inclinable, metFor, restingPerHour, speedForMet } from './calories'
import type { CardioSessionKind } from './cardioSession'
import type { WorkoutStyle } from './randomizer'
import { BY_ID, isIsolation } from './randomUtil'
import { liftMinutes } from './timing'

// ---------------------------------------------------------------------------------------------
// A workout built to burn about so many calories. Each part burns (MET − resting) × bodyweight × time, the same net
// estimate the app gives for cardio (see calories.ts). METs from the Compendium of Physical Activities: weight
// training with the usual rests is light work (about 3.5), circuits with little rest are vigorous (about 8).
// ---------------------------------------------------------------------------------------------

/**
 * MET for each workout style, rests included, for planning before the workout is made (the workout as made is
 * estimated exercise by exercise, see liftMet). Lifting styles: the average of liftMet over the workouts the app
 * makes (full body to one-muscle days).
 */
export const STYLE_MET: Record<WorkoutStyle, number> = {
  standard: 4.5,
  strength: 5.0, // heavy compound lifts
  bodyweight: 3.7,
  supersets: 5.5, // less rest between sets
  pha: 6.0,
  emom: 7.0,
  circuit: 8.0, // circuit training, vigorous, minimal rest
  amrap: 8.0,
  fortime: 8.0,
  tabata: 8.0,
  crossfit: 8.0,
  hyrox: 8.0,
  // Kettlebell and dumbbell work in pairs, carries (Compendium: circuit training, moderate, about 5).
  functional: 5.0,
  // Light resistance, holds and stretching (stretching 2.3, light resistance work 3.5).
  posture: 2.8,
}
/** Warm-up: easy cardio, then mobility (stretching, about 2.3). */
export const WARMUP_MET = 3.2

/** Harder cardio sessions burn more a minute than steady ones (recoveries included). */
export const SESSION_FACTOR: Record<CardioSessionKind, number> = { steady: 1, intervals: 1.1, tempo: 1.15, hills: 1.15, tabata: 1.15, trial: 1.25 }

/**
 * MET for the cardio part: its activity at a usual pace (the average when several are possible), adjusted for the
 * session. With nothing to go on, a typical mix of runs, rides and machines (about 7).
 */
export function cardioMet(ids: string[], kind: CardioSessionKind, incline = 0): number {
  const base = ids.length ? ids.reduce((a, id) => a + metFor(id, { distance: null, minutes: null, incline }), 0) / ids.length : 7
  return base * SESSION_FACTOR[kind]
}

const KG_PER_LB = 0.45359237

/** Net calories a minute at a MET for this person. */
export const perMinute = (met: number, lb: number, date: string, me?: AboutMe | null) =>
  Math.max(0, (met * lb * KG_PER_LB - restingPerHour(lb, date, me)) / 60)

/** The MET that burns `rate` net calories a minute for this person (perMinute the other way round). */
export const metForRate = (rate: number, lb: number, date: string, me?: AboutMe | null) =>
  (rate * 60 + restingPerHour(lb, date, me)) / (lb * KG_PER_LB)

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
 * keep their shares of the time and grow (or shrink) together. `steady` parts keep their minutes too (a Tabata is a set
 * amount of work). Minutes round to 5.
 */
export function planForCalories(target: number, parts: CaloriePart[], rate: (met: number) => number, flexible?: string, steady: string[] = []): CaloriePlan {
  const minutes: Record<string, number> = {}
  const fixed = parts.filter((p) => p.key === 'warmup' || steady.includes(p.key) || (flexible && p.key !== flexible))
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

export interface TimedPlan extends CaloriePlan {
  /**
   * How hard the part that makes up the rest has to go, as a MET: the cardio, or (without cardio) the lifting and
   * conditioning on average. Null when there's no time left for it.
   */
  needMet: number | null
}

/**
 * Minutes for each part within a time limit, and how hard it has to be to burn about `target`. With a `flexible` part
 * (the cardio), the others keep their minutes and it gets the time that's left; without one, the warm-up keeps its
 * minutes and the other parts share the rest as they share it now.
 */
export function planWithin(target: number, limit: number, parts: CaloriePart[], rate: (met: number) => number, metOf: (rate: number) => number, flexible?: string, steady: string[] = []): TimedPlan {
  const minutes: Record<string, number> = {}
  const fixed = parts.filter((p) => p.key === 'warmup' || steady.includes(p.key) || (flexible && p.key !== flexible))
  for (const p of fixed) minutes[p.key] = p.minutes
  const left = limit - fixed.reduce((a, p) => a + p.minutes, 0)
  const grow = parts.filter((p) => !fixed.includes(p))
  const share = grow.reduce((a, p) => a + p.minutes, 0) || grow.length
  let given = 0
  grow.forEach((p, i) => {
    const m = i === grow.length - 1 ? left - given : Math.max(5, Math.round((((p.minutes || 1) / share) * left) / 5) * 5)
    minutes[p.key] = Math.max(0, m)
    given += minutes[p.key]
  })
  const fixedKcal = fixed.reduce((a, p) => a + p.minutes * rate(p.met), 0)
  const needKcal = Math.max(0, target - fixedKcal)
  const needMet = left >= 5 && grow.length ? metOf(needKcal / left) : null
  const kcal = Object.fromEntries(parts.map((p) => [p.key, Math.round(fixed.includes(p) ? p.minutes * rate(p.met) : needMet ? (minutes[p.key] / left) * needKcal : 0)]))
  return { minutes, kcal, totalMinutes: Object.values(minutes).reduce((a, m) => a + m, 0), totalKcal: Object.values(kcal).reduce((a, k) => a + k, 0), needMet }
}

/** Lifting styles from lightest to hardest: the one to pick when the lifting has to burn more a minute. */
export const LIFT_LADDER: WorkoutStyle[] = ['standard', 'supersets', 'pha', 'circuit']
/** The lightest lifting style that burns at least `met` a minute (rests included), or null if none does. */
export const styleFor = (met: number): WorkoutStyle | null => LIFT_LADDER.find((st) => STYLE_MET[st] >= met - 0.1) ?? null

/** How an effort compares with a usual pace for the activity. */
export function effortLabel(ratio: number): 'easy' | 'moderate' | 'hard' | 'very hard' | 'too hard' {
  return ratio <= 0.85 ? 'easy' : ratio <= 1.1 ? 'moderate' : ratio <= 1.3 ? 'hard' : ratio <= 1.5 ? 'very hard' : 'too hard'
}

/** Their recent speed for an activity (mph, the median of up to the last 10 logs with a distance and time), or null. */
export function recentSpeed(logs: ExerciseLog[], ids: string[]): number | null {
  const speeds = logs
    .filter((l) => ids.includes(l.exerciseId) && l.cardio?.distance && l.cardio.minutes)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
    .map((l) => l.cardio!.distance! / (l.cardio!.minutes! / 60))
    .sort((a, b) => a - b)
  return speeds.length ? speeds[Math.floor(speeds.length / 2)] : null
}

/**
 * The cardio pieces set to burn at `met` (session included): runs, walks and rides get a target distance for their
 * time (so a speed and pace); other cardio gets an effort relative to its usual pace.
 */
export function setCardioEffort(items: PlannedExercise[], met: number, cardioFactor: number): PlannedExercise[] {
  return items.map((p) => {
    if (!isCardioPiece(p)) return p
    const mph = speedForMet(p.exerciseId, met / cardioFactor, p.incline)
    if (mph) return { ...p, distance: Math.round(mph * (p.minutes! / 60) * 10) / 10, intensity: undefined }
    return { ...p, intensity: Math.round((met / (metFor(p.exerciseId, { distance: null, minutes: null }) * cardioFactor)) * 100) / 100 }
  })
}

/** Treadmill pieces (not the warm-up) at an incline (percent grade); 0 takes it off. */
export function setIncline(items: PlannedExercise[], incline: number): PlannedExercise[] {
  return items.map((p) => {
    if (!isCardioPiece(p) || !inclinable(p.exerciseId)) return p
    const { incline: _i, ...rest } = p
    void _i
    return incline > 0 ? { ...rest, incline } : rest
  })
}

/** Effort picks for cardio without a speed, as a share of a usual pace's burn. */
export const EFFORTS = { easy: 0.85, moderate: 1, hard: 1.2, 'very hard': 1.4 } as const
export type Effort = keyof typeof EFFORTS

/**
 * The cardio pieces at the pace they picked: their chosen activity at their speed (a target distance for its time),
 * anything else at the effort they picked.
 */
export function setCardioPace(items: PlannedExercise[], pace: { exerciseId?: string; mph?: number | null; effort: Effort }): PlannedExercise[] {
  return items.map((p) => {
    if (!isCardioPiece(p)) return p
    if (pace.mph && p.exerciseId === pace.exerciseId) return { ...p, distance: Math.round(pace.mph * (p.minutes! / 60) * 10) / 10, intensity: undefined }
    const { distance: _d, ...rest } = p
    void _d
    return pace.effort === 'moderate' ? { ...rest, intensity: undefined } : { ...rest, intensity: EFFORTS[pace.effort] }
  })
}

const minutesOf = (p: PlannedExercise) => p.est ?? (BY_ID.get(p.exerciseId) ? liftMinutes(p, BY_ID.get(p.exerciseId)) : 0)
/** A main cardio piece: a cardio exercise with planned minutes, not the warm-up or a station in a timed block. */
const isCardioPiece = (p: PlannedExercise) => !p.warmup && !p.block && !!p.minutes && BY_ID.get(p.exerciseId)?.kind === 'cardio'
const LOWER = ['Quads', 'Hamstrings', 'Glutes']
const FREE = ['Barbell', 'Dumbbell', 'Kettlebell', 'EZ bar', 'Sandbag']
/**
 * MET for one lifting exercise, its rests included, from the Compendium of Physical Activities: resistance training
 * with multiple exercises at 8-15 reps is 3.5, squats 5.0, vigorous powerlifting or bodybuilding 6.0. Heavy (8 reps or
 * fewer) free-weight lower-body lifts (squats, deadlifts, lunges) burn the most, free-weight upper-body ones (bench,
 * rows, presses) next, machines and cables less, isolation and core least. Supersets cut the rest: about a quarter
 * more a minute.
 */
export function liftMet(e: Exercise | undefined, p: PlannedExercise, fallback = 3.5): number {
  if (!e || e.kind !== 'strength') return fallback
  const ss = p.block?.includes('ss') ? 1.25 : 1
  if (e.group === 'Mobility') return 2.3
  const heavy = p.reps != null && p.reps <= 8
  const lower = LOWER.includes(e.group)
  const met = e.group === 'Core' || e.group === 'Calves' || isIsolation(e) ? 3.0
    : FREE.includes(e.equipment ?? '') ? (lower ? (heavy ? 6.0 : 5.0) : heavy ? 5.0 : 4.5)
      : e.equipment === 'Bodyweight' ? (lower ? 4.0 : 3.8)
        : lower ? 4.0 : 3.5 // machines and cables
  return met * ss
}

const pieceMet = (p: PlannedExercise, factor: number) =>
  metFor(p.exerciseId, { distance: p.distance ?? null, minutes: p.minutes ?? null, incline: p.incline }) * factor * (p.distance ? 1 : p.intensity ?? 1)

/** lift: for a lifting exercise the app doesn't know (see liftMet); cond: timed and circuit blocks. */
export interface WorkoutMets { lift: number; cond: number; cardioFactor: number }

/** Estimated net calories for a workout: warm-up, each lift (see liftMet), timed blocks, and each cardio piece. */
export function workoutCalories(items: PlannedExercise[], rate: (met: number) => number, mets: WorkoutMets): number {
  return Math.round(items.reduce((a, p) => {
    const met = isCardioPiece(p) ? pieceMet(p, mets.cardioFactor) : p.warmup ? WARMUP_MET : p.block && !p.block.includes('ss') ? mets.cond : liftMet(BY_ID.get(p.exerciseId), p, mets.lift)
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
