import type { Exercise, ExerciseLog, PlanOverrides, PlannedExercise, WeekPlan } from '../types'
import { areaOf } from './bodyParts'
import { parseISO, weekdayIndex } from './dates'
import { hasData } from './stats'

/** The exercises planned for a date: a date-specific override if one exists, else the weekly template. */
export function dayPlanOf(plan: WeekPlan, overrides: PlanOverrides | undefined, date: string): PlannedExercise[] {
  return overrides?.[date] ?? plan[weekdayIndex(parseISO(date))]
}

/** The exercises that count as the workout itself (warm-up moves aren't tracked as things to do). */
export const workItems = (items: PlannedExercise[]) => items.filter((p) => !p.warmup)

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
