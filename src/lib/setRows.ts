import type { PlannedExercise, StrengthSet } from '../types'

/** A set with numbers in it. */
export const hasNumbers = (s: StrengthSet) => !!(s.weight || s.reps || s.seconds)

/** Done: ticked ✓. Older sets saved before ticks existed count when they have numbers. */
export const isTicked = (s: StrengthSet) => s.done ?? hasNumbers(s)

/**
 * The rows an exercise card shows: planned warm-ups, then working sets, then drop sets. A logged set keeps its own
 * flags, so a set you turned into a warm-up (or back into a working set) counts as that everywhere: on the card, in
 * "Finish workout" and in your history.
 */
export function setRows(p: Pick<PlannedExercise, 'sets' | 'warmupSets' | 'dropSets'>, logged?: StrengthSet[]): StrengthSet[] {
  const warm = p.warmupSets ?? 0
  const firstDrop = warm + p.sets
  // Never hide a logged set, even if the plan changed after it was logged (e.g. warm-ups moved to another lift).
  const length = Math.max(firstDrop + (p.dropSets ?? 0), logged?.length ?? 0)
  return Array.from({ length }, (_, i) => logged?.[i] ?? {
    weight: null, reps: null, seconds: null, ...(i < warm ? { warmup: true } : {}), ...(i >= firstDrop ? { drop: true } : {}),
  })
}

/** The working sets among a card's rows: not warm-ups, not drop sets. */
export const workingRows = (rows: StrengthSet[]) => rows.filter((s) => !s.warmup && !s.drop)
