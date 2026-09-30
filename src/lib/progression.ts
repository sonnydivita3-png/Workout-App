import type { Exercise, ExerciseLog, StrengthSet, Units } from '../types'
import { epley } from './stats'

/** Working sets with data (warm-ups left out). */
export const workSets = (l?: ExerciseLog): StrengthSet[] => (l?.sets ?? []).filter((s) => !s.warmup && (s.weight || s.reps || s.seconds))

const LOWER = ['Legs', 'Glutes']

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
  kind: 'add-weight' | 'add-reps' | 'add-time' | 'repeat' | 'first'
}

/**
 * "Try this next" from the last session, the classic double progression: once every working set reaches the rep
 * target, add weight; otherwise keep the weight and add a rep. Bodyweight moves add a rep, holds add 5 seconds.
 */
export function suggestNext(ex: Exercise, last: ExerciseLog | undefined, target: { reps?: number; seconds?: number }, units: Units): Suggestion {
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
  const atTop = sets.filter((s) => (s.weight ?? 0) === top)
  const goal = target.reps ?? Math.max(...atTop.map((s) => s.reps ?? 0))
  const hit = atTop.every((s) => (s.reps ?? 0) >= goal) && atTop.length >= Math.min(2, sets.length)
  const tooHard = atTop.some((s) => (s.rpe ?? 0) >= 10)
  if (hit && !tooHard) {
    const next = top + weightStep(ex, units)
    return { kind: 'add-weight', weight: next, reps: goal, why: `You got ${atTop.length} × ${goal} last time. Add weight.` }
  }
  const low = Math.min(...atTop.map((s) => s.reps ?? 0))
  if (tooHard && hit) return { kind: 'repeat', weight: top, reps: goal, why: 'That felt maxed out last time. Repeat it and own every rep.' }
  return { kind: 'add-reps', weight: top, reps: Math.min(goal, low + 1), why: `Same weight. Your lowest set was ${low}: get ${Math.min(goal, low + 1)}+ on every set.` }
}

/** How a set compares with the same set last time: better, same, or worse (null if nothing to compare). */
export function compareSet(now: StrengthSet, then: StrengthSet | undefined, mode: Exercise['mode']): 'up' | 'same' | 'down' | null {
  if (!then || now.warmup || then.warmup) return null
  const score = (s: StrengthSet) => (mode === 'time' ? s.seconds ?? 0 : mode === 'reps' ? s.reps ?? 0 : s.weight && s.reps ? epley(s.weight, s.reps) : 0)
  const a = score(now)
  const b = score(then)
  if (!a || !b) return null
  return a > b + 0.01 ? 'up' : a < b - 0.01 ? 'down' : 'same'
}

/** One number per session to compare against last time: best est. 1RM, best reps or longest hold. */
export function sessionScore(l: ExerciseLog | undefined, mode: Exercise['mode'], kind: Exercise['kind']): number {
  if (!l) return 0
  if (kind === 'cardio') return l.cardio?.distance ?? l.cardio?.minutes ?? 0
  const sets = workSets(l)
  if (mode === 'time') return Math.max(0, ...sets.map((s) => s.seconds ?? 0))
  if (mode === 'reps') return Math.max(0, ...sets.map((s) => s.reps ?? 0))
  return Math.max(0, ...sets.map((s) => (s.weight && s.reps ? epley(s.weight, s.reps) : 0)))
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
