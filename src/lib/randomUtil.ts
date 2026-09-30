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

/**
 * Everyday gym staples: what most programs are built from. Random workouts reach for these first and only use the
 * rest of the library to fill gaps (checked against the everyday and the full name).
 */
const STAPLES = new RegExp([
  'squat', 'leg press', 'lunge', 'split squat', 'step-?up', 'deadlift', 'hip thrust', 'glute bridge', 'leg curl', 'leg extension', 'calf raise',
  'bench press', 'incline .*press', 'chest press', 'push-?up', 'chest dip', '\\bfly', 'flyes', 'crossover',
  '\\brow\\b', '\\brows\\b', 'pulldown', 'pull-?up', 'chin-?up', 'face pull', 'shrug',
  'overhead press', 'shoulder press', 'military press', 'arnold', 'lateral raise', 'front raise', 'rear delt', 'reverse fly',
  '\\bcurl', 'pushdown', 'skull ?crusher', 'triceps? extension', 'triceps dip', 'close-grip bench',
  'plank', '\\bcrunch', 'leg raise', 'russian twist', 'dead bug', 'ab roller', 'mountain climber', 'kettlebell swing', 'farmer',
].join('|'), 'i')
/** Cache a per-exercise check: generators ask the same question about the same exercise thousands of times. */
function perExercise<T>(fn: (e: Exercise) => T): (e: Exercise) => T {
  const cache = new WeakMap<Exercise, T>()
  return (e) => {
    if (cache.has(e)) return cache.get(e)!
    const v = fn(e)
    cache.set(e, v)
    return v
  }
}

export const isStaple = perExercise((e) => STAPLES.test(`${e.name} ${e.fullName ?? ''}`))

// Movement families, so a workout doesn't repeat the same thing (three squats, three incline presses...).
const FAMILIES: [string, RegExp][] = [
  ['squat', /squat/i], ['hinge', /deadlift|good morning|pull through/i], ['lunge', /lunge|split squat|step-?up/i],
  ['incline', /incline.*(press|bench)/i], ['bench', /bench press|chest press|floor press/i], ['pushup', /push-?up/i],
  ['row', /\brows?\b/i], ['vertical pull', /pulldown|pull-?up|chin-?up/i], ['overhead', /overhead press|shoulder press|military|arnold|push press/i],
  ['raise', /lateral raise|front raise|rear delt|reverse fly/i], ['fly', /\bfly|flyes|crossover/i], ['curl', /(?<!leg )curl/i],
  ['triceps', /pushdown|triceps? extension|skull|kickback/i], ['calf', /calf/i], ['bridge', /hip thrust|glute bridge|bridge/i],
  ['crunch', /crunch|sit-?up/i], ['plank', /plank/i],
]
export const familyOf = perExercise((e) => FAMILIES.find(([, re]) => re.test(`${e.name} ${e.fullName ?? ''}`))?.[0])

/** Niche or gimmicky moves that make a random workout feel odd. Still available to pick by hand. */
export const isQuirky = perExercise((e) =>
  /\b(bands?|chains?|isometric|around the worlds?|turkish|windmill|get-?up|wipers?|body-up|butt-ups|halo|pass between|otis|london bridges|conan)\b/i.test(e.name))

/** Olympic lifts and their variations: great, but too technical to hand out at random for sets of 6-12. */
export const isTechnical = perExercise((e) => /\b(clean|snatch|jerk)\b/i.test(e.name))

/** Movements too advanced or awkward to prescribe at random. */
export const isAdvanced = perExercise((e) => /single-arm|one-arm|one arm|pistol|handstand|muscle-up|planche|clap|archer|freehand jump|explosive|kipping/i.test(e.name))
