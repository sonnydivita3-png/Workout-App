import type { Exercise, ExerciseLog, PlannedExercise } from '../types'
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

/** Hard sets per muscle in planned workouts (e.g. a plan's week). Warm-ups, cardio and timed pieces aren't counted. */
export function plannedSets(items: PlannedExercise[], lookup: (id: string) => Exercise | undefined): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, 0]))
  for (const p of items) {
    const ex = lookup(p.exerciseId)
    if (!ex || ex.kind !== 'strength' || p.warmup || p.wod) continue
    const part = partFromName(ex.group, ex.name)
    if (part in out) out[part] += p.sets
  }
  return out
}

/**
 * Most hard sets for one muscle in a session: about 15 for the big ones and 10 for arms, calves and core. Past roughly
 * 10-15, more sets in one go mostly add fatigue rather than growth.
 */
const SMALL_PARTS = new Set(['Biceps', 'Triceps', 'Calves', 'Forearms', 'Core'])
export const sessionSets = (part: string) => (SMALL_PARTS.has(part) ? 10 : 15)
/** The usual most exercises for one muscle in a session (people can set their own). */
export const PER_MUSCLE = 5

export interface Overload { part: string; exercises: number; sets: number }
/**
 * Muscles a workout gives more than is useful in one session: more exercises than `maxExercises`, or more hard sets
 * than sessionSets. Straight sets and supersets only (circuit stations and timed pieces work differently).
 */
export function overloaded(items: PlannedExercise[], lookup: (id: string) => Exercise | undefined, maxExercises = PER_MUSCLE): Overload[] {
  const by = new Map<string, { exercises: number; sets: number }>()
  for (const p of items) {
    const ex = lookup(p.exerciseId)
    if (!ex || ex.kind !== 'strength' || p.warmup || p.wod || (p.block && !p.block.startsWith('ss'))) continue
    const part = partFromName(ex.group, ex.name)
    const cur = by.get(part) ?? { exercises: 0, sets: 0 }
    by.set(part, { exercises: cur.exercises + 1, sets: cur.sets + p.sets })
  }
  return [...by].filter(([part, v]) => v.exercises > maxExercises || v.sets > sessionSets(part)).map(([part, v]) => ({ part, ...v }))
}
