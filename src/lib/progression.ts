import type { Exercise, ExerciseLog, StrengthSet, Units } from '../types'
import { epley } from './stats'
import { familyOf } from './randomUtil'
import { formatSeconds, showWeight } from './units'

/** Working sets with data (warm-ups and drop sets left out). */
export const workSets = (l?: ExerciseLog): StrengthSet[] => (l?.sets ?? []).filter((s) => !s.warmup && !s.drop && (s.weight || s.reps || s.seconds))
/** A set with added weight. Reps with no weight (blank or 0) on a weighted lift is a bodyweight set: dips, pull-ups, an ab roller. */
const loaded = (s: StrengthSet) => !!s.weight && s.weight > 0 && !!s.reps

/**
 * How a session of a lift is measured. With any weighted working set: by load (estimated max). With only bodyweight
 * sets: by reps. Sessions measured differently aren't compared with each other.
 */
export function sessionBasis(l: ExerciseLog | undefined, mode: Exercise['mode'], kind: Exercise['kind']): 'load' | 'reps' | 'time' | 'cardio' | null {
  if (!l) return null
  if (kind === 'cardio') return l.cardio?.distance || l.cardio?.minutes ? 'cardio' : null
  const sets = workSets(l)
  if (mode === 'time') return sets.some((s) => s.seconds) ? 'time' : null
  if (mode !== 'reps' && sets.some(loaded)) return 'load'
  return sets.some((s) => s.reps) ? 'reps' : null
}

/** Drop sets with data. */
export const dropSetsOf = (l?: ExerciseLog): StrengthSet[] => (l?.sets ?? []).filter((s) => s.drop && (s.weight || s.reps))

const LOWER = ['Quads', 'Hamstrings', 'Glutes', 'Legs']

/** The weight step for a lift, in pounds: bigger jumps for heavy lower-body barbell work, small ones for dumbbells. */
export function weightStep(ex: Exercise, units: Units): number {
  const kg = units.weight === 'kg'
  const big = ex.equipment === 'Barbell' && LOWER.includes(ex.group)
  return kg ? (big ? 5 : 2.5) * 2.20462262 : big ? 10 : 5
}

export interface Suggestion {
  /** What to aim for this time. Weight in pounds. */
  weight?: number | null
  reps?: number | null
  seconds?: number | null
  /** One-line reason, e.g. "You hit 3 × 8 at 135 last time: add weight". */
  why: string
  kind: 'add-weight' | 'add-reps' | 'add-time' | 'repeat' | 'first' | 'deload' | 'estimate'
}

/**
 * "Try this next" from the last session, the classic double progression: once every working set reaches the rep
 * target, add weight; otherwise keep the weight and add a rep. Bodyweight moves add a rep, holds add 5 seconds.
 */
export function suggestNext(
  ex: Exercise,
  last: ExerciseLog | undefined,
  target: { reps?: number; seconds?: number },
  units: Units,
  /** Earlier sessions of this exercise, newest first, starting with `last`. Used to spot a plateau. */
  history: ExerciseLog[] = [],
): Suggestion {
  const sets = workSets(last)
  const mode = ex.mode ?? 'weight'
  if (sets.length === 0) return { kind: 'first', why: 'First time: pick a weight you could lift a couple more times, and log it.', reps: target.reps ?? null, seconds: target.seconds ?? null }
  if (mode === 'time') {
    const best = Math.max(...sets.map((s) => s.seconds ?? 0))
    return { kind: 'add-time', seconds: best + 5, why: `Best hold last time was ${best}s. Go for ${best + 5}s.` }
  }
  if (mode === 'reps') {
    const best = Math.max(...sets.map((s) => s.reps ?? 0))
    return { kind: 'add-reps', reps: best + 1, why: `Best set last time was ${best} reps. Beat it with ${best + 1}.` }
  }
  const top = Math.max(...sets.map((s) => s.weight ?? 0))
  if (top <= 0) {
    // Done with bodyweight last time (no weight, or 0): beat the best set by a rep rather than "add 5 lb" to nothing.
    const best = Math.max(...sets.map((s) => s.reps ?? 0))
    if (best > 0) return { kind: 'add-reps', weight: null, reps: best + 1, why: `Bodyweight: best set last time was ${best} reps. Beat it with ${best + 1}.` }
  }
  const atTop = sets.filter((s) => (s.weight ?? 0) === top)
  const goal = target.reps ?? Math.max(...atTop.map((s) => s.reps ?? 0))
  const hit = atTop.every((s) => (s.reps ?? 0) >= goal) && atTop.length >= Math.min(2, sets.length)
  const tooHard = atTop.some((s) => (s.rpe ?? 0) >= 10)
  if (hit && !tooHard) {
    const next = top + weightStep(ex, units)
    return { kind: 'add-weight', weight: next, reps: goal, why: `You got ${atTop.length} × ${goal} last time. Add weight.` }
  }
  const stalled = plateau(ex, history)
  if (stalled) {
    const step = weightStep(ex, units)
    const lighter = Math.max(step, Math.round((top * 0.9) / step) * step)
    return { kind: 'deload', weight: lighter, reps: goal, why: `No progress in your last ${stalled} sessions at ${Math.round(top)}. Drop to about 90% and build back up past it.` }
  }
  const low = Math.min(...atTop.map((s) => s.reps ?? 0))
  if (tooHard && hit) return { kind: 'repeat', weight: top, reps: goal, why: 'That felt maxed out last time. Repeat it and own every rep.' }
  return { kind: 'add-reps', weight: top, reps: Math.min(goal, low + 1), why: `Same weight. Your lowest set was ${low}: get ${Math.min(goal, low + 1)}+ on every set.` }
}

/**
 * Rough load per piece of kit compared with a barbell, for the same movement: each dumbbell is about 40% of the bar
 * (a 185 bench ≈ 70s), cables a bit over half. Rough on purpose; the estimate is then trimmed to stay on the safe side.
 */
const LOAD: Record<string, number> = { Barbell: 1, 'EZ bar': 0.9, Machine: 1, Cable: 0.6, Dumbbell: 0.4, Kettlebell: 0.4 }
/** Close movements in different families (incline pressing is about 80% of flat). */
const NEAR: Record<string, [string, number][]> = { incline: [['bench', 0.8]], bench: [['incline', 1.2]] }

/**
 * A starting weight for a lift they've never logged, from the most recent similar lift they have (same movement, same
 * muscle): its best set's estimated max, scaled for the equipment, cut 10% to be safe, then worked back to `reps`.
 * Null when there's nothing close enough to go on.
 */
export function estimateStart(
  ex: Exercise,
  logs: ExerciseLog[],
  reps: number | undefined,
  units: Units,
  lookup: (id: string) => Exercise | undefined,
): Suggestion | null {
  if ((ex.mode ?? 'weight') !== 'weight' || !LOAD[ex.equipment ?? '']) return null
  const fam = familyOf(ex)
  if (!fam) return null
  const near = new Map<string, number>([[fam, 1], ...(NEAR[fam] ?? [])])
  const goal = reps ?? 10
  const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date))
  for (const l of recent) {
    if (l.exerciseId === ex.id) continue
    const src = lookup(l.exerciseId)
    const f = src && familyOf(src)
    if (!src || !f || !near.has(f) || src.group !== ex.group || (src.mode ?? 'weight') !== 'weight' || !LOAD[src.equipment ?? '']) continue
    const sets = workSets(l).filter((s) => s.weight && s.reps)
    if (sets.length === 0) continue
    const best = sets.reduce((a, s) => (epley(s.weight!, s.reps!) > epley(a.weight!, a.reps!) ? s : a))
    const max = epley(best.weight!, best.reps!) * near.get(f)! * (LOAD[ex.equipment!] / LOAD[src.equipment!]) * 0.9
    const step = weightStep(ex, units)
    const weight = Math.floor(max / (1 + goal / 30) / step) * step
    if (weight <= 0) return null
    return {
      kind: 'estimate', weight, reps: goal,
      why: `New lift: estimated from your ${src.name} (${showWeight(best.weight!, units)}×${best.reps}). Go lighter if it feels heavy.`,
    }
  }
  return null
}

/**
 * Stuck at the same weight for 3+ sessions without beating your best set there: returns how many sessions, else 0.
 * A short step back (a deload) is the standard fix for a plateau.
 */
export function plateau(ex: Exercise, history: ExerciseLog[]): number {
  if ((ex.mode ?? 'weight') !== 'weight') return 0
  const recent = history.filter((l) => workSets(l).length > 0).slice(0, 4)
  if (recent.length < 3) return 0
  const tops = recent.map((l) => Math.max(...workSets(l).map((s) => s.weight ?? 0)))
  // Bodyweight sets have no weight to drop: no deload.
  if (tops[0] <= 0) return 0
  const same = tops.findIndex((t) => t !== tops[0])
  const run = same === -1 ? tops.length : same
  if (run < 3) return 0
  const best = (l: ExerciseLog) => Math.max(...workSets(l).filter((s) => s.weight === tops[0]).map((s) => s.reps ?? 0))
  const scores = recent.slice(0, run).map(best) // newest first
  // No improvement: the newest session is no better than the oldest in the run.
  return scores[0] <= scores[run - 1] ? run : 0
}

/** How a set compares with the same set last time: better, same, or worse (null if nothing to compare). */
export function compareSet(now: StrengthSet, then: StrengthSet | undefined, mode: Exercise['mode']): 'up' | 'same' | 'down' | null {
  if (!then || now.warmup || then.warmup) return null
  // A weighted lift done with bodyweight both times compares reps; weighted against bodyweight doesn't compare.
  const byReps = mode === 'reps' || (mode !== 'time' && !loaded(now) && !loaded(then))
  if (mode !== 'time' && !byReps && !(loaded(now) && loaded(then))) return null
  const score = (s: StrengthSet) => (mode === 'time' ? s.seconds ?? 0 : byReps ? s.reps ?? 0 : epley(s.weight!, s.reps!))
  const a = score(now)
  const b = score(then)
  if (!a || !b) return null
  return a > b + 0.01 ? 'up' : a < b - 0.01 ? 'down' : 'same'
}

/**
 * One number per session to compare against last time: best est. 1RM (weighted sets), best reps (bodyweight or reps
 * moves) or longest hold. Check `sessionBasis` before comparing two of them.
 */
export function sessionScore(l: ExerciseLog | undefined, mode: Exercise['mode'], kind: Exercise['kind']): number {
  if (!l) return 0
  if (kind === 'cardio') return l.cardio?.distance ?? l.cardio?.minutes ?? 0
  const sets = workSets(l)
  if (mode === 'time') return Math.max(0, ...sets.map((s) => s.seconds ?? 0))
  if (sessionBasis(l, mode, kind) === 'load') return Math.max(0, ...sets.filter(loaded).map((s) => epley(s.weight!, s.reps!)))
  return Math.max(0, ...sets.map((s) => s.reps ?? 0))
}

/** One set for display: "185×5", "12 reps" (bodyweight on a weighted lift), "12" (reps moves) or "0:45" (holds). */
export function formatSet(s: StrengthSet, mode: Exercise['mode'], units: Units): string {
  if (mode === 'time') return s.seconds ? formatSeconds(s.seconds) : '–'
  if (mode === 'reps') return s.reps ? `${s.reps}` : '–'
  if (!s.weight) return s.reps ? `${s.reps} reps` : '–'
  return `${showWeight(s.weight, units)}×${s.reps ?? '–'}`
}

/** Total work in a session: weight × reps, total reps, or total seconds. */
export function sessionVolume(l: ExerciseLog | undefined, mode: Exercise['mode']): number {
  const sets = workSets(l)
  if (mode === 'time') return sets.reduce((a, s) => a + (s.seconds ?? 0), 0)
  if (mode === 'reps') return sets.reduce((a, s) => a + (s.reps ?? 0), 0)
  return sets.reduce((a, s) => a + (s.weight ?? 0) * (s.reps ?? 0), 0)
}

/** Plates per side for a barbell load (in the person's units), greedy from the heaviest plate. */
export function platesFor(total: number, units: Units): { bar: number; perSide: number[]; left: number } {
  const kg = units.weight === 'kg'
  const bar = kg ? 20 : 45
  const plates = kg ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5]
  let side = Math.max(0, (total - bar) / 2)
  const perSide: number[] = []
  for (const p of plates) while (side >= p - 1e-9) { perSide.push(p); side -= p }
  return { bar, perSide, left: Math.round(side * 2 * 100) / 100 }
}
