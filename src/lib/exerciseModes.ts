import type { Exercise, ExerciseMode } from '../types'

/**
 * How the person tracks an exercise when they've said so (with weight, or bodyweight reps only), over the library's
 * default. Kept here, like the equipment they own, so plain functions (generators, warm-up placement) see it too.
 */
let chosen: Record<string, ExerciseMode> = {}

export function setChosenModes(modes: Record<string, ExerciseMode> | undefined) {
  chosen = modes ?? {}
}

/** The mode an exercise is tracked in: the person's choice, else the library's. */
export const modeOf = (e: Exercise): ExerciseMode | undefined => (e.kind === 'strength' ? chosen[e.id] ?? e.mode : e.mode)

const copies = new WeakMap<Exercise, Exercise>()

/** The exercise as the person tracks it. The same object when nothing changes, so per-exercise caches keep working. */
export function withChosenMode(e: Exercise): Exercise {
  const mode = modeOf(e)
  if ((mode ?? 'weight') === (e.mode ?? 'weight')) return e
  const copy = copies.get(e)
  if (copy && copy.mode === mode) return copy
  const next = { ...e, mode }
  copies.set(e, next)
  return next
}
