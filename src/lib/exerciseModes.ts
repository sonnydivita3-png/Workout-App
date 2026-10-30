import type { Exercise, ExerciseMode } from '../types'

/**
 * How the person tracks an exercise when they've said so (with weight, or bodyweight reps only), over the library's
 * default. Kept here, like the equipment they own, so plain functions (generators, warm-up placement) see it too.
 */
let chosen: Record<string, ExerciseMode> = {}

export function setChosenModes(modes: Record<string, ExerciseMode> | undefined) {
  chosen = modes ?? {}
}

/**
 * What adds the weight to a bodyweight move they've made weighted (a dip machine, a cable, dumbbells, a belt or vest),
 * so it files under that equipment.
 */
let gear: Record<string, string> = {}

export function setChosenGear(g: Record<string, string> | undefined) {
  gear = g ?? {}
}

/** Equipment someone can say adds the weight to a bodyweight move, in the order it's offered. */
export const WEIGHT_GEAR = ['Machine', 'Cable', 'Dumbbell', 'Barbell', 'Kettlebell', 'Other'] as const

/** Whether making this exercise weighted should ask what adds the weight: a bodyweight move with no answer yet. */
export const needsGear = (e: Exercise) => e.kind === 'strength' && (e.equipment ?? 'Bodyweight') === 'Bodyweight' && !gear[e.id]

/** The mode an exercise is tracked in: the person's choice, else the library's. */
export const modeOf = (e: Exercise): ExerciseMode | undefined => (e.kind === 'strength' ? chosen[e.id] ?? e.mode : e.mode)

/** Timed sets that carry a weight too (a farmer's carry, curls for 30 s): free weights, cables and machines, not ergs. */
export const timedWithWeight = (e: Exercise) =>
  e.kind === 'strength' && (['Barbell', 'Dumbbell', 'EZ bar', 'Kettlebell', 'Cable', 'Sled', 'Sandbag', 'Medicine ball'].includes(e.equipment ?? '') || (e.equipment === 'Machine' && e.group !== 'Conditioning'))

const copies = new WeakMap<Exercise, Exercise>()

/**
 * The exercise as the person tracks it (their mode, and the equipment they said adds the weight while it's weighted).
 * The same object when nothing changes, so per-exercise caches keep working.
 */
export function withChosenMode(e: Exercise): Exercise {
  const mode = modeOf(e)
  const equipment = e.kind === 'strength' && (mode ?? 'weight') === 'weight' && gear[e.id] ? gear[e.id] : e.equipment
  if ((mode ?? 'weight') === (e.mode ?? 'weight') && equipment === e.equipment) return e
  const copy = copies.get(e)
  if (copy && copy.mode === mode && copy.equipment === equipment) return copy
  const next = { ...e, mode, equipment }
  copies.set(e, next)
  return next
}
