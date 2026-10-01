import type { AboutMe, BodyweightEntry, CardioEntry, ExerciseLog } from '../types'

/**
 * Cardio calories, the standard way: MET (how hard the activity is, from the Compendium of Physical Activities)
 * × bodyweight in kg × hours. Speed sets the MET for running, walking and cycling when a distance is logged.
 *
 * That's the gross burn, which includes what the body burns anyway at rest. Like most watches, we show the net:
 * the exercise on top of resting. Resting burn comes from Mifflin-St Jeor when sex, age and height are set,
 * else the standard 1 MET (about 1 kcal per kg per hour). Bodyweight is the only detail that's required.
 * It's an estimate, about as rough as a watch's.
 */

/** [mph, MET] points, interpolated between. */
type Curve = [number, number][]
const RUN: Curve = [[4, 6.0], [5, 8.3], [5.2, 9.0], [6, 9.8], [6.7, 10.5], [7, 11.0], [7.5, 11.5], [8, 11.8], [8.6, 12.3], [9, 12.8], [10, 14.5], [11, 16.0], [12, 19.0], [13, 19.8], [14, 23.0]]
const WALK: Curve = [[2, 2.8], [2.5, 3.0], [3, 3.5], [3.5, 4.3], [4, 5.0], [4.5, 7.0]]
const CYCLE: Curve = [[9, 4.0], [11, 6.8], [13, 8.0], [15, 10.0], [18, 12.0], [20, 15.8]]

function onCurve(c: Curve, mph: number): number {
  if (mph <= c[0][0]) return c[0][1]
  for (let i = 1; i < c.length; i++) {
    const [x1, y1] = c[i]
    const [x0, y0] = c[i - 1]
    if (mph <= x1) return y0 + ((mph - x0) / (x1 - x0)) * (y1 - y0)
  }
  return c[c.length - 1][1]
}

/** Each cardio exercise: a fixed MET, or a speed curve with the MET to use when there's no distance. */
const ACTIVITY: Record<string, number | { curve: 'run' | 'walk' | 'cycle'; usual: number }> = {
  running: { curve: 'run', usual: 8.0 }, Running_Treadmill: { curve: 'run', usual: 8.0 }, Jogging_Treadmill: { curve: 'run', usual: 7.0 },
  Trail_Running_Walking: { curve: 'run', usual: 9.0 },
  walking: { curve: 'walk', usual: 3.5 }, Walking_Treadmill: { curve: 'walk', usual: 3.5 }, hiking: 6.0,
  cycling: { curve: 'cycle', usual: 7.5 }, Bicycling: { curve: 'cycle', usual: 7.5 },
  Bicycling_Stationary: 7.0, Recumbent_Bike: 5.5, 'x-bike-erg': 7.0, 'x-air-bike': 8.8,
  Rowing_Stationary: 7.0, 'x-row-erg': 7.0, 'x-skierg': 6.8, Elliptical_Trainer: 5.0,
  Stairmaster: 9.0, Step_Mill: 9.0, 'x-versaclimber': 9.0, Rope_Jumping: 11.8, swimming: 5.8, Skating: 7.0, Prowler_Sprint: 8.0,
}
/** Anything else (e.g. a custom cardio exercise): a moderate effort. */
const GENERAL = 6.0
const CURVES = { run: RUN, walk: WALK, cycle: CYCLE }

/** MET for an activity, using its speed when distance and time are both logged. */
export function metFor(exerciseId: string, c: Pick<CardioEntry, 'distance' | 'minutes'>): number {
  const a = ACTIVITY[exerciseId] ?? GENERAL
  if (typeof a === 'number') return a
  if (!c.distance || !c.minutes) return a.usual
  const mph = c.distance / (c.minutes / 60)
  // A "run" at walking speed is a walk, and a fast walk is a run.
  if (a.curve === 'run' && mph < 4) return onCurve(WALK, mph)
  if (a.curve === 'walk' && mph > 4.5) return onCurve(RUN, mph)
  return onCurve(CURVES[a.curve], mph)
}

/** Bodyweight (lb) on a date: the latest entry on or before it, else the earliest one after. */
export function bodyweightOn(entries: BodyweightEntry[], date: string): number | null {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const before = sorted.filter((e) => e.date <= date).at(-1)
  return (before ?? sorted[0])?.lb ?? null
}

const KG_PER_LB = 1 / 2.20462262

/** Age on a date from a birth year (good enough for a resting-burn estimate). */
const ageOn = (birthYear: number, date: string) => Number(date.slice(0, 4)) - birthYear

/** Whether resting burn can be personal: a believable birth year and height (sex refines it). */
export const hasPersonalDetails = (me?: AboutMe | null) =>
  !!me?.birthYear && me.birthYear > 1900 && me.birthYear <= new Date().getFullYear() - 10 && !!me.heightIn && me.heightIn >= 36 && me.heightIn <= 96

/**
 * Resting burn in kcal per hour. Mifflin-St Jeor with age and height (sex adds +5 for men, −161 for women, halfway
 * between if not set); without them, 1 MET.
 */
export function restingPerHour(lb: number, date: string, me?: AboutMe | null): number {
  const kg = lb * KG_PER_LB
  if (!hasPersonalDetails(me)) return kg
  const s = me!.sex === 'male' ? 5 : me!.sex === 'female' ? -161 : -78
  return (10 * kg + 6.25 * me!.heightIn! * 2.54 - 5 * ageOn(me!.birthYear!, date) + s) / 24
}

/** Estimated (net) calories for a cardio log, or null without minutes or a bodyweight. */
export function estimateCalories(exerciseId: string, c: Pick<CardioEntry, 'distance' | 'minutes'>, lb: number | null, me?: AboutMe | null, date = new Date().toISOString().slice(0, 10)): number | null {
  if (!lb || !c.minutes || c.minutes <= 0) return null
  const hours = c.minutes / 60
  const gross = metFor(exerciseId, c) * lb * KG_PER_LB * hours
  return Math.max(0, Math.round(gross - restingPerHour(lb, date, me) * hours))
}

export interface CalorieTotal {
  total: number
  /** How much of `total` is estimated. */
  estimated: number
  /** Cardio sessions with no calories: no number typed in and no bodyweight to estimate from. */
  missing: number
}

/**
 * Calories from every cardio log between two dates (inclusive): steady cardio, and the runs, rows and rides inside
 * Hyrox and timed workouts. Lifting isn't counted (estimates for it are unreliable).
 */
export function caloriesBetween(logs: ExerciseLog[], bodyweight: BodyweightEntry[], from: string, to: string, me?: AboutMe | null): CalorieTotal {
  const out = { total: 0, estimated: 0, missing: 0 }
  for (const l of logs) {
    if (!l.cardio || l.date < from || l.date > to) continue
    const cal = caloriesOf(l, bodyweight, me)
    if (cal) {
      out.total += cal.kcal
      if (cal.estimated) out.estimated += cal.kcal
    } else if (l.cardio.minutes) out.missing++
  }
  return out
}

/** Calories for a cardio log: what they entered (e.g. from a watch), else the estimate. */
export function caloriesOf(l: ExerciseLog, bodyweight: BodyweightEntry[], me?: AboutMe | null): { kcal: number; estimated: boolean } | null {
  if (!l.cardio) return null
  if (l.cardio.calories != null && l.cardio.calories > 0) return { kcal: l.cardio.calories, estimated: false }
  const est = estimateCalories(l.exerciseId, l.cardio, bodyweightOn(bodyweight, l.date), me, l.date)
  return est == null ? null : { kcal: est, estimated: true }
}
