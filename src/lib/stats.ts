import type { ExerciseLog, ExerciseMode } from '../types'
import { addDays, mondayOf, parseISO, toISO } from './dates'

export interface StrengthSession {
  date: string
  sets: { weight: number; reps: number }[]
  topWeight: number
  e1rm: number
  volume: number
}

export interface CardioSession {
  date: string
  distance: number | null
  minutes: number | null
  pace: number | null // minutes per mile
}

/** Epley estimated one-rep max. */
export const epley = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30))

export function strengthSessions(logs: ExerciseLog[], exerciseId: string): StrengthSession[] {
  return logs
    .filter((l) => l.exerciseId === exerciseId && l.sets)
    .map((l) => {
      const sets = l.sets!.filter((s): s is { weight: number; reps: number } => !!s.weight && !!s.reps)
      return {
        date: l.date,
        sets,
        topWeight: Math.max(0, ...sets.map((s) => s.weight)),
        e1rm: Math.max(0, ...sets.map((s) => epley(s.weight, s.reps))),
        volume: sets.reduce((a, s) => a + s.weight * s.reps, 0),
      }
    })
    .filter((s) => s.sets.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function cardioSessions(logs: ExerciseLog[], exerciseId: string): CardioSession[] {
  return logs
    .filter((l) => l.exerciseId === exerciseId && l.cardio && (l.cardio.distance || l.cardio.minutes))
    .map((l) => {
      const { distance, minutes } = l.cardio!
      return { date: l.date, distance, minutes, pace: distance && minutes ? minutes / distance : null }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** True when the last session beats every earlier one on the given metric. */
export function isPR(values: number[]): boolean {
  if (values.length < 2) return false
  const last = values[values.length - 1]
  return last > 0 && last > Math.max(...values.slice(0, -1))
}

export const hasData = (l: ExerciseLog) =>
  !!l.sets?.some((s) => s.weight || s.reps || s.seconds) || !!(l.cardio?.distance || l.cardio?.minutes)

/** Dates (YYYY-MM-DD) with at least one logged exercise. */
export const workoutDates = (logs: ExerciseLog[]) => new Set(logs.filter(hasData).map((l) => l.date))

const inRange = (date: string, from: string, to: string) => date >= from && date <= to

export interface WeekStats {
  workouts: number
  volume: number // lb
  lastVolume: number
  streak: number // consecutive weeks with a workout
}

export function weekStats(logs: ExerciseLog[], today: string): WeekStats {
  const monday = mondayOf(parseISO(today))
  const range = (offset: number) => [toISO(addDays(monday, offset * 7)), toISO(addDays(monday, offset * 7 + 6))] as const
  const dates = workoutDates(logs)
  const volume = (offset: number) => {
    const [from, to] = range(offset)
    return logs
      .filter((l) => inRange(l.date, from, to))
      .reduce((a, l) => a + (l.sets ?? []).reduce((b, s) => b + (s.weight ?? 0) * (s.reps ?? 0), 0), 0)
  }
  const count = (offset: number) => {
    const [from, to] = range(offset)
    return [...dates].filter((d) => inRange(d, from, to)).length
  }
  // The current week doesn't break a streak until it's over.
  let streak = 0
  for (let w = count(0) > 0 ? 0 : -1; count(w) > 0 && w > -520; w--) streak++
  return { workouts: count(0), volume: volume(0), lastVolume: volume(-1), streak }
}

/** Sessions for reps-only or timed exercises; `values` are reps or seconds per set. */
export interface SetSession {
  date: string
  values: number[]
  best: number
  total: number
}

export function setSessions(logs: ExerciseLog[], exerciseId: string, mode: 'reps' | 'time'): SetSession[] {
  return logs
    .filter((l) => l.exerciseId === exerciseId && l.sets)
    .map((l) => {
      const values = l.sets!.map((s) => (mode === 'time' ? s.seconds : s.reps)).filter((v): v is number => !!v)
      return { date: l.date, values, best: Math.max(0, ...values), total: values.reduce((a, v) => a + v, 0) }
    })
    .filter((s) => s.values.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Best ever for a lift: top weight (lb), most reps in a set, or longest hold (seconds). */
export function bestLift(logs: ExerciseLog[], exerciseId: string, mode: ExerciseMode = 'weight') {
  if (mode === 'weight') return Math.max(0, ...strengthSessions(logs, exerciseId).map((s) => s.topWeight))
  return Math.max(0, ...setSessions(logs, exerciseId, mode).map((s) => s.best))
}
