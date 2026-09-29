import type { ExerciseLog } from '../types'

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
