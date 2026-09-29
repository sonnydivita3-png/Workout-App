import { BUILTIN_BY_ID } from '../data/exercises'
import type { CardioSport, Exercise, ExerciseLog, GoalPeriod, Sport } from '../types'
import { addDays, mondayOf, parseISO, toISO } from './dates'

export type Lookup = (id: string) => Exercise | undefined
const builtin: Lookup = (id) => BUILTIN_BY_ID.get(id)

/** Run, ride, or something else, judged from the exercise name (so custom exercises work too). */
export function sportOf(ex: Exercise | undefined): Sport | 'other' {
  if (!ex || ex.kind !== 'cardio') return 'other'
  if (/\b(bicycl\w*|cycl\w*|bike|biking|spin)\b/i.test(ex.name)) return 'bike'
  if (/\b(run\w*|jog\w*|treadmill|trail)\b/i.test(ex.name)) return 'run'
  return 'other'
}

export interface CardioSession {
  date: string
  sport: Sport | 'other'
  distance: number | null // miles
  minutes: number | null
}

export function cardioSessions(logs: ExerciseLog[], lookup: Lookup = builtin): CardioSession[] {
  return logs
    .filter((l) => l.cardio && (l.cardio.distance || l.cardio.minutes))
    .map((l) => ({ date: l.date, sport: sportOf(lookup(l.exerciseId)), distance: l.cardio!.distance, minutes: l.cardio!.minutes }))
}

export const matchesSport = (s: CardioSession, sport: CardioSport) => sport === 'any' || s.sport === sport

/** [first day, last day] of the current week (Mon–Sun) or calendar month. */
export function periodRange(period: GoalPeriod, today: string): [string, string] {
  if (period === 'week') {
    const monday = mondayOf(parseISO(today))
    return [toISO(monday), toISO(addDays(monday, 6))]
  }
  const d = parseISO(today)
  return [toISO(new Date(d.getFullYear(), d.getMonth(), 1)), toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0))]
}

/** Key that changes when the goal's period rolls over, so "goal reached" can fire again next week/month. */
export const periodKey = (period: GoalPeriod, today: string) => periodRange(period, today)[0]

/** Total distance (miles) and minutes for a sport so far this period (never counts future dates). */
export function periodTotals(logs: ExerciseLog[], sport: CardioSport, period: GoalPeriod, today: string, lookup: Lookup = builtin) {
  const [from, to] = periodRange(period, today)
  let distance = 0
  let minutes = 0
  for (const s of cardioSessions(logs, lookup)) {
    if (s.date < from || s.date > to || s.date > today || !matchesSport(s, sport)) continue
    distance += s.distance ?? 0
    minutes += s.minutes ?? 0
  }
  return { distance, minutes }
}

/** Longest single session (miles) for a sport, up to today. */
export function longestSession(logs: ExerciseLog[], sport: CardioSport, today: string, lookup: Lookup = builtin) {
  return Math.max(0, ...cardioSessions(logs, lookup).filter((s) => s.date <= today && matchesSport(s, sport)).map((s) => s.distance ?? 0))
}

/**
 * Best pace (min/mile, lower is better) for a runner, or best average speed (mph) for a rider,
 * over sessions of at least `minDistance` miles.
 */
export function bestEffort(logs: ExerciseLog[], sport: Sport, minDistance: number, today: string, lookup: Lookup = builtin): number | null {
  const ok = cardioSessions(logs, lookup).filter((s) => s.sport === sport && s.date <= today && (s.distance ?? 0) >= minDistance && (s.minutes ?? 0) > 0)
  if (ok.length === 0) return null
  return sport === 'run'
    ? Math.min(...ok.map((s) => s.minutes! / s.distance!))
    : Math.max(...ok.map((s) => s.distance! / (s.minutes! / 60)))
}
