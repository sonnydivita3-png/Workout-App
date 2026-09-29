import type { ExerciseLog, PlanOverrides, Program } from '../types'
import { hasData } from './stats'

/** A program is active while any of its days is today or later. */
export const isActive = (p: Program, today: string) => p.entries.some((e) => e.date >= today)

export const activePrograms = (programs: Program[], today: string) => programs.filter((p) => isActive(p, today))

const logged = (logs: ExerciseLog[], date: string, exerciseId?: string) =>
  logs.some((l) => l.date === date && hasData(l) && (!exerciseId || l.exerciseId === exerciseId))

/** Days a stop would change: today or later, and nothing logged on them yet. */
export function stoppableEntries(p: Program, logs: ExerciseLog[], from: string) {
  return p.entries.filter((e) => e.date >= from && !logged(logs, e.date, e.exerciseId))
}

/**
 * Remove a program's upcoming days from the calendar. Cardio programs take out only their run/ride and leave anything
 * else planned that day; other programs clear the whole day back to the weekly plan. Anything already logged stays.
 */
export function removeProgramDays(p: Program, overrides: PlanOverrides, logs: ExerciseLog[], from: string): { overrides: PlanOverrides; count: number } {
  const next = { ...overrides }
  let count = 0
  for (const e of stoppableEntries(p, logs, from)) {
    const day = next[e.date]
    if (!day) continue
    if (e.exerciseId) {
      const rest = day.filter((x) => x.exerciseId !== e.exerciseId)
      if (rest.length === day.length) continue
      if (rest.length === 0) delete next[e.date]
      else next[e.date] = rest
    } else delete next[e.date]
    count++
  }
  return { overrides: next, count }
}

/** Clear planned days in a date range back to the weekly plan, keeping any day with something logged. */
export function clearRange(overrides: PlanOverrides, logs: ExerciseLog[], from: string, to: string): { overrides: PlanOverrides; count: number } {
  const next = { ...overrides }
  let count = 0
  for (const date of Object.keys(next)) {
    if (date < from || date > to || logged(logs, date)) continue
    delete next[date]
    count++
  }
  return { overrides: next, count }
}
