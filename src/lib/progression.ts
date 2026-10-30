import type { Exercise, ExerciseLog, StrengthSet, Units } from '../types'
import { epley } from './stats'
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


/**
 * What to do the first time, by how the exercise is logged. The app never suggests a weight (a guess can be too
 * heavy and get someone hurt): it shows what they did last time, and the first time, how to pick their own.
 */
export const FIRST_TIME: Record<NonNullable<Exercise['mode']>, string> = {
  weight: 'First time: pick a weight you could lift a couple more times than the reps planned, and log it.',
  reps: 'First time: stop a couple of reps short of failure, and log it.',
  time: 'First time: keep going until your form starts to slip, and log the time.',
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
  // Total reps at that weight: a rep gained on any set is progress (progress comes a set or two at a time).
  const best = (l: ExerciseLog) => workSets(l).filter((s) => s.weight === tops[0]).reduce((a, s) => a + (s.reps ?? 0), 0)
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

/** One set for display: "185×5", "12 reps" (bodyweight on a weighted lift), "12" (reps moves), "45s" (holds) or "50×40s" (a carry). */
export function formatSet(s: StrengthSet, mode: Exercise['mode'], units: Units): string {
  if (mode === 'time' && s.seconds) return `${s.weight ? `${showWeight(s.weight, units)}×` : ''}${formatSeconds(s.seconds)}`
  // Reps only, with any weight shown (sets logged before the exercise was switched to bodyweight keep their load, and
  // sets done for reps before it was switched to time keep their reps).
  if (mode === 'reps' || mode === 'time') return s.reps ? (s.weight ? `${showWeight(s.weight, units)}×${s.reps}` : `${s.reps}`) : '–'
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
