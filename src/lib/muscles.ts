import type { Exercise, ExerciseLog } from '../types'
import type { ProgramGoal } from './program'
import { addDays, mondayOf, parseISO, toISO } from './dates'
import { workSets } from './progression'
import { BODY_PARTS, partFromName } from './bodyParts'

export const MUSCLE_GROUPS = BODY_PARTS

/**
 * Hard sets per muscle group for the week containing `date` and the week before. Warm-ups don't count. This is the
 * number most coaches track for muscle growth (roughly 10-20 hard sets per muscle per week is a common target).
 */
export function weeklySets(logs: ExerciseLog[], date: string, lookup: (id: string) => Exercise | undefined) {
  const mon = mondayOf(parseISO(date))
  const range = (start: Date) => [toISO(start), toISO(addDays(start, 6))] as const
  const count = ([from, to]: readonly [string, string]) => {
    const out: Record<string, number> = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, 0]))
    for (const l of logs) {
      if (l.date < from || l.date > to) continue
      const ex = lookup(l.exerciseId)
      if (!ex || ex.kind !== 'strength') continue
      const part = partFromName(ex.group, ex.name)
      if (part in out) out[part] += workSets(l).length
    }
    return out
  }
  return { thisWeek: count(range(mon)), lastWeek: count(range(addDays(mon, -7))) }
}

/**
 * Weekly hard-set targets per muscle, by goal. Based on the research most coaches use: about 10+ sets a week grows
 * muscle (more helps, up to ~20), strength comes mostly from heavy work and needs less volume, and about a third to
 * half of a growth dose keeps muscle while dieting or training for general fitness.
 */
export const GOAL_SETS: Record<ProgramGoal, number> = { muscle: 12, strength: 8, fatloss: 8, fitness: 6, functional: 6 }
/** With no goal set: the common middle-of-the-road number. */
export const DEFAULT_SETS = 10
/** Muscles that also work hard in the big lifts (biceps in rows, triceps in presses, glutes in squats, core in all of them). */
const INDIRECT = new Set<string>(['Biceps', 'Triceps', 'Glutes', 'Calves', 'Core'])

/** The base target (a big muscle's): their own number, else their goal's, else the default. */
export const baseTarget = (goal?: ProgramGoal | ProgramGoal[] | null, custom?: number | null) => {
  if (custom && custom > 0) return Math.round(custom)
  // Several goals: the biggest dose any of them needs (build muscle + lose fat aims for build muscle's sets).
  const known = (Array.isArray(goal) ? goal : goal ? [goal] : []).filter((g) => g in GOAL_SETS)
  return known.length ? Math.max(...known.map((g) => GOAL_SETS[g])) : DEFAULT_SETS
}

/** Hard sets to aim for this week for one muscle. Smaller muscles that the big lifts already train get about 60%. */
export const weeklyTarget = (part: string, goal?: ProgramGoal | ProgramGoal[] | null, custom?: number | null) => {
  const base = baseTarget(goal, custom)
  return INDIRECT.has(part) ? Math.max(2, Math.round(base * 0.6)) : base
}
