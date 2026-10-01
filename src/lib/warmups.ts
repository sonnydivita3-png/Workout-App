import type { Exercise, PlannedExercise } from '../types'

/** Warm-up sets are for weight lifting: never bodyweight moves, core, cardio, holds or timed blocks. */
export const takesWarmup = (e?: Exercise) =>
  !!e && e.kind === 'strength' && (e.mode ?? 'weight') === 'weight' && e.group !== 'Core' && e.equipment !== 'Bodyweight'

/**
 * Warm-up sets always sit on the first two weight-lifting exercises of the day, whatever the order: more before the
 * first (`first`, or the most the day already had), one fewer before the second. Days without warm-ups are untouched.
 */
export function placeWarmups(items: PlannedExercise[], lookup: (id: string) => Exercise | undefined, first?: number): PlannedExercise[] {
  const top = first ?? Math.max(0, ...items.map((p) => p.warmupSets ?? 0))
  if (!top) return items
  const counts = [Math.max(2, top), Math.max(2, top) - 1]
  let n = 0
  let changed = false
  const out = items.map((p) => {
    const want = n < 2 && !p.warmup && !p.wod && takesWarmup(lookup(p.exerciseId)) ? counts[n++] : undefined
    if (p.warmupSets === want) return p
    changed = true
    const { warmupSets: _old, ...rest } = p
    void _old
    return want ? { ...rest, warmupSets: want } : rest
  })
  return changed ? out : items
}
