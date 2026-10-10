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

/**
 * `n` more working sets, each after the last working set (and after any drop sets already done straight after it, so
 * they stay with their set; planned ones not done yet stay at the end).
 */
export function addWorkingSets(rows: StrengthSet[], n: number): StrengthSet[] {
  let out = rows
  for (let k = 0; k < n; k++) {
    const last = out.findLastIndex((s) => !s.warmup && !s.drop)
    let at = last >= 0 ? last + 1 : out.findLastIndex((s) => s.warmup) + 1
    while (at < out.length && out[at].drop && isTicked(out[at])) at++
    out = [...out.slice(0, at), { weight: null, reps: null }, ...out.slice(at)]
  }
  return out
}

/** Without the last `n` working sets (their numbers too); warm-ups and drop sets stay. */
export function removeWorkingSets(rows: StrengthSet[], n: number): StrengthSet[] {
  let out = rows
  for (let k = 0; k < n; k++) {
    const i = out.findLastIndex((s) => !s.warmup && !s.drop)
    if (i < 0) break
    out = out.filter((_, j) => j !== i)
  }
  return out
}

/** With an empty drop set straight after row `after`. */
export const insertDropSet = (rows: StrengthSet[], after: number): StrengthSet[] =>
  [...rows.slice(0, after + 1), { weight: null, reps: null, drop: true }, ...rows.slice(after + 1)]

/** A row's number among its own kind: warm-ups, working sets and drop sets are each counted from 1. */
export function rowNumber(rows: StrengthSet[], i: number): number {
  const kind = (s: StrengthSet) => (s.warmup ? 'w' : s.drop ? 'd' : 's')
  return rows.slice(0, i + 1).filter((s) => kind(s) === kind(rows[i])).length
}
