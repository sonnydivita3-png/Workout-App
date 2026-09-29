import type { BodyweightEntry, ExerciseLog, Goal, Units } from '../types'
import { showWeight } from './units'
import { bestLift, weekStats } from './stats'

/** Progress toward a goal, 0–1. */
export function goalPct(goal: Goal, logs: ExerciseLog[], bodyweight: BodyweightEntry[], today: string): number {
  let pct = 0
  if (goal.type === 'workouts') {
    pct = weekStats(logs, today).workouts / goal.perWeek
  } else if (goal.type === 'bodyweight') {
    const now = bodyweight.at(-1)?.lb ?? null
    const start = goal.start ?? bodyweight[0]?.lb ?? null
    if (now != null && start != null) pct = start === goal.target ? 1 : (start - now) / (start - goal.target)
  } else {
    pct = bestLift(logs, goal.exerciseId) / goal.target
  }
  return Math.max(0, Math.min(1, pct))
}

export function goalTitle(goal: Goal, units: Units, exerciseName: (id: string) => string | undefined): string {
  if (goal.type === 'workouts') return `${goal.perWeek} workouts a week`
  if (goal.type === 'bodyweight') return `Body weight → ${showWeight(goal.target, units)} ${units.weight}`
  return `${exerciseName(goal.exerciseId) ?? 'Lift'} → ${showWeight(goal.target, units)} ${units.weight}`
}
