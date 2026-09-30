import { EXERCISES } from '../data/exercises'
import type { Exercise } from '../types'

export type Rng = () => number

export const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))
/** Exercises sensible to auto-pick in ordinary workouts. */
export const POOL = EXERCISES.filter((e) => e.suggest)
export const byName = (name: string) => EXERCISES.find((e) => e.name === name)

export const FULL_BODY_GROUPS = ['Chest', 'Back', 'Shoulders', 'Legs', 'Glutes', 'Arms', 'Core']

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Shuffle, but put anything in `avoid` at the back so it is only used when nothing else is left. */
export function softShuffle(arr: Exercise[], avoid: Set<string>, rng: Rng): Exercise[] {
  const fresh = shuffle(arr.filter((e) => !avoid.has(e.id)), rng)
  return [...fresh, ...shuffle(arr.filter((e) => avoid.has(e.id)), rng)]
}

/** Small, fast seeded generator so tests (and "same seed, same plan") are reproducible. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const roundTo = (n: number, step: number) => Math.round(n / step) * step
export const roundTo5 = (n: number) => Math.max(5, roundTo(n, 5))
export const pick = <T>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)]

/** Exercises that are mostly single-joint, so poor picks for timed circuits and heavy strength work. */
export const isIsolation = (e: Exercise) => /curl|raise|fly|flye|extension|kickback|crossover|shrug|pullover|pushdown|lateral|wrist|calf/i.test(e.name)

/** Big, classic barbell/dumbbell lifts, for strength work and CrossFit primers. */
export const isMainLift = (e: Exercise) =>
  /\b(squat|deadlift|bench press|shoulder press|overhead press|military press|push press|bent over row|barbell row|pull-?up|chin-?up|hip thrust|lunge|dip)\b/i.test(e.name) &&
  !/band|chain|smith|high pull|one arm|single|reverse|box|jump|kettlebell|upright|rear delt|lying|hyperextension/i.test(e.name)

/** Olympic lifts and their variations: great, but too technical to hand out at random for sets of 6-12. */
export const isTechnical = (e: Exercise) => /\b(clean|snatch|jerk)\b/i.test(e.name)

/** Movements too advanced or awkward to prescribe at random. */
export const isAdvanced = (e: Exercise) => /single-arm|one-arm|one arm|pistol|handstand|muscle-up|planche|clap|archer|freehand jump|explosive|kipping/i.test(e.name)
