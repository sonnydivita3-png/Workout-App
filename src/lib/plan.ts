import type { Exercise, ExerciseLog, PlanOverrides, PlannedExercise, WeekPlan } from '../types'
import { areaOf } from './bodyParts'
import { addDays, mondayOf, parseISO, toISO, weekdayIndex } from './dates'
import { hasData } from './stats'

/** The exercises planned for a date: a date-specific override if one exists, else the weekly template. */
export function dayPlanOf(plan: WeekPlan, overrides: PlanOverrides | undefined, date: string): PlannedExercise[] {
  return overrides?.[date] ?? plan[weekdayIndex(parseISO(date))]
}

/** PHA stations planned on the other days of a date's week (Monday to Sunday), so another PHA that week can differ. */
export function phaThisWeek(plan: WeekPlan, overrides: PlanOverrides | undefined, date: string): string[] {
  const monday = mondayOf(parseISO(date))
  return [0, 1, 2, 3, 4, 5, 6]
    .map((i) => toISO(addDays(monday, i)))
    .filter((d) => d !== date)
    .flatMap((d) => dayPlanOf(plan, overrides, d).filter((p) => p.block === 'pha' || p.block?.endsWith('-pha')).map((p) => p.exerciseId))
}

/** The exercises that count as the workout itself (warm-up moves aren't tracked as things to do). */
export const workItems = (items: PlannedExercise[]) => items.filter((p) => !p.warmup)

/** A session's own cardio: a run, ride or row with planned minutes (not the warm-up, not a station in a timed block). */
const mainCardio = (p: PlannedExercise) => !p.warmup && !p.block && !p.wod && p.minutes != null
/** Lifting or conditioning: anything else past the warm-up. */
const training = (p: PlannedExercise) => !p.warmup && !mainCardio(p)

/** Whether a day has both lifting (or conditioning) and cardio of its own: the days "cardio first or last" is about. */
export const liftAndCardio = (items: PlannedExercise[]) => items.some(mainCardio) && items.some(training)

/** Whether the day's cardio comes before its lifting. */
export const cardioFirst = (items: PlannedExercise[]) => items.findIndex(mainCardio) < items.findIndex(training)

/** The day with its cardio moved to the start (just after the warm-up) or the end; everything else keeps its order. */
export function placeCardio(items: PlannedExercise[], first: boolean): PlannedExercise[] {
  if (!liftAndCardio(items)) return items
  const warm = items.filter((p) => p.warmup)
  const cardio = items.filter(mainCardio)
  const rest = items.filter(training)
  return first ? [...warm, ...cardio, ...rest] : [...warm, ...rest, ...cardio]
}

/** A day explicitly marked as rest (an empty date override), as opposed to a day that just has nothing planned. */
export const isRestDay = (overrides: PlanOverrides | undefined, date: string) => overrides?.[date]?.length === 0

/**
 * The most recent workout actually logged: on or before `today`, with real data, and not on a day marked as rest.
 * Future dates and rest days never count.
 */
export function lastWorkout(
  logs: ExerciseLog[],
  overrides: PlanOverrides | undefined,
  today: string,
): { date: string; logs: ExerciseLog[] } | null {
  const eligible = logs.filter((l) => l.date <= today && hasData(l) && !isRestDay(overrides, l.date))
  const date = eligible.map((l) => l.date).sort().at(-1)
  return date ? { date, logs: eligible.filter((l) => l.date === date) } : null
}

/**
 * Turn a logged workout back into a plan, so it can be done again: same exercises in the same order, as many working
 * sets as last time, and the reps, hold or cardio time that was done.
 */
export function repeatPlan(logs: ExerciseLog[], lookup: (id: string) => Exercise | undefined): PlannedExercise[] {
  const mostCommon = (xs: number[]) => {
    const counts = new Map<number, number>()
    for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0]
  }
  return logs.flatMap((l): PlannedExercise[] => {
    const ex = lookup(l.exerciseId)
    if (!ex) return []
    if (ex.kind === 'cardio') {
      return [{ exerciseId: l.exerciseId, sets: 1, ...(l.cardio?.minutes ? { minutes: l.cardio.minutes } : {}), ...(l.cardio?.distance ? { distance: l.cardio.distance } : {}) }]
    }
    const work = (l.sets ?? []).filter((s) => !s.warmup && (s.reps || s.seconds || s.weight))
    const warm = (l.sets ?? []).filter((s) => s.warmup).length
    const reps = mostCommon(work.map((s) => s.reps ?? 0).filter(Boolean))
    const seconds = mostCommon(work.map((s) => s.seconds ?? 0).filter(Boolean))
    return [{
      exerciseId: l.exerciseId,
      sets: Math.max(1, work.length),
      ...(ex.mode === 'time' ? (seconds ? { seconds } : {}) : reps ? { reps } : {}),
      ...(warm ? { warmupSets: warm } : {}),
    }]
  })
}

/** A one-word label for a day in the week strip: the main muscle group, "Full", "Run", "Ride", "Timed" or "Cardio". */
export function dayLabel(items: PlannedExercise[], lookup: (id: string) => Exercise | undefined): string {
  const work = workItems(items)
  if (work.length === 0) return ''
  if (work.some((p) => p.wod)) return 'Timed'
  if (work.some((p) => p.block === 'hyrox' || p.block?.endsWith('-hyrox'))) return 'Hyrox'
  const exs = work.map((p) => lookup(p.exerciseId)).filter((e): e is Exercise => !!e)
  const lifts = exs.filter((e) => e.kind === 'strength' && e.group !== 'Conditioning' && e.group !== 'Mobility')
  if (lifts.length === 0) {
    const ids = exs.map((e) => e.id.toLowerCase())
    if (ids.length && ids.every((id) => /run|jog|treadmill|trail/.test(id))) return 'Run'
    if (ids.length && ids.every((id) => /cycl|bik/.test(id))) return 'Ride'
    return exs.some((e) => e.group === 'Conditioning') ? 'HIIT' : 'Cardio'
  }
  const counts = new Map<string, number>()
  // By area, so a leg day reads Legs rather than Quads.
  for (const e of lifts) counts.set(areaOf(e.group), (counts.get(areaOf(e.group)) ?? 0) + 1)
  const groups = [...counts].sort((a, b) => b[1] - a[1])
  // Three or more groups with none dominating reads as a full-body day.
  if (groups.length >= 3 && groups[0][1] <= lifts.length / 2) return 'Full'
  return groups[0][0]
}

/**
 * A short title for a logged workout, e.g. "Full body", "Upper body", "Chest & arms", "Legs + cardio", "Run": for
 * lists where every exercise name would be too much.
 */
export function workoutTitle(exs: Exercise[]): string {
  const lifts = exs.filter((e) => e.kind === 'strength' && e.group !== 'Conditioning' && e.group !== 'Mobility')
  const cardio = exs.filter((e) => e.kind === 'cardio')
  if (lifts.length === 0) {
    if (exs.some((e) => e.group === 'Conditioning')) return 'HIIT'
    const ids = cardio.map((e) => e.id.toLowerCase())
    if (ids.length && ids.every((id) => /run|jog|treadmill|trail/.test(id))) return 'Run'
    if (ids.length && ids.every((id) => /cycl|bik/.test(id))) return 'Ride'
    return exs.some((e) => e.group === 'Mobility') && !cardio.length ? 'Mobility' : 'Cardio'
  }
  const ORDER = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core']
  const areas = new Set(lifts.map((e) => (areaOf(e.group) === 'Glutes' ? 'Legs' : areaOf(e.group))).filter((a) => ORDER.includes(a)))
  const upper = ['Chest', 'Back', 'Shoulders', 'Arms'].filter((a) => areas.has(a)).length
  let title: string
  if (upper >= 2 && areas.has('Legs')) title = 'Full body'
  else if (upper >= 3) title = 'Upper body'
  else {
    const names = ORDER.filter((a) => areas.has(a))
    title = names.length === 0 ? 'Strength' : names.map((n, i) => (i ? n.toLowerCase() : n)).join(', ').replace(/, ([^,]*)$/, ' & $1')
  }
  return cardio.length ? `${title} + cardio` : title
}

/**
 * Where the most recent drop sets before `before` went (within two weeks), planned or logged: the next workout puts
 * its drop sets on other muscles.
 */
export function lastDropGroups(plan: WeekPlan, overrides: PlanOverrides | undefined, logs: ExerciseLog[], before: string, lookup: (id: string) => Exercise | undefined): string[] {
  for (let back = 1; back <= 14; back++) {
    const date = toISO(addDays(parseISO(before), -back))
    const ids = new Set([
      ...dayPlanOf(plan, overrides, date).filter((p) => p.dropSets).map((p) => p.exerciseId),
      ...logs.filter((l) => l.date === date && l.sets?.some((x) => x.drop && (x.weight || x.reps))).map((l) => l.exerciseId),
    ])
    const groups = [...new Set([...ids].map((id) => lookup(id)?.group).filter((g): g is string => !!g))]
    if (groups.length) return groups
  }
  return []
}
