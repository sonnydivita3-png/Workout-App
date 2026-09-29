import type { ExerciseLog, PlanOverrides, PlannedExercise, WeekPlan } from '../types'
import { parseISO, weekdayIndex } from './dates'
import { hasData } from './stats'

/** The exercises planned for a date: a date-specific override if one exists, else the weekly template. */
export function dayPlanOf(plan: WeekPlan, overrides: PlanOverrides | undefined, date: string): PlannedExercise[] {
  return overrides?.[date] ?? plan[weekdayIndex(parseISO(date))]
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
