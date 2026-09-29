import type { PlanOverrides, PlannedExercise, WeekPlan } from '../types'
import { parseISO, weekdayIndex } from './dates'

/** The exercises planned for a date: a date-specific override if one exists, else the weekly template. */
export function dayPlanOf(plan: WeekPlan, overrides: PlanOverrides | undefined, date: string): PlannedExercise[] {
  return overrides?.[date] ?? plan[weekdayIndex(parseISO(date))]
}
