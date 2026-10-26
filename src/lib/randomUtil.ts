import { BUILTIN_BY_ID, EXERCISES } from '../data/exercises'
import type { Exercise } from '../types'
import { FULL_BODY_ORDER } from './bodyParts'

export type Rng = () => number

// The person's own exercises, set from their profile (store.ts) like their favorites, so every generator can use them.
let mine = new Map<string, Exercise>()
export function setCustomExercises(list: Exercise[] | undefined) {
  mine = new Map((Array.isArray(list) ? list : []).map((e) => [e.id, e]))
}
/** Their own lifting exercises, for workouts made for them (not ones they deleted). */
export const customPool = (): Exercise[] => [...mine.values()].filter((e) => !e.retired && e.kind === 'strength')
/** Any exercise by id: the library (retired ones included: they can still be in old plans) and their own. */
export const BY_ID = {
  get: (id: string): Exercise | undefined => BUILTIN_BY_ID.get(id) ?? mine.get(id),
  has: (id: string) => BUILTIN_BY_ID.has(id) || mine.has(id),
}
/** Exercises sensible to auto-pick in ordinary workouts. */
export const POOL = EXERCISES.filter((e) => e.suggest)
export const byName = (name: string) => EXERCISES.find((e) => e.name === name)

/** Every body part, biggest movements first (see bodyParts.ts). */
export const FULL_BODY_GROUPS = [...FULL_BODY_ORDER]

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
export const isIsolation = (e: Exercise) =>
  /curl|raise|fly|flye|extension|kickback|crossover|iron cross|pec deck|butterfly|shrug|pullover|pushdown|wrist|calf|external rotation|internal rotation|abduct|adduct|scaption|triceps press|tate press|leg lift/i.test(e.name)
  && !/step-?up/i.test(e.name) // a step-up with a knee raise is still a step-up

/** Big, classic barbell/dumbbell lifts, for strength work and CrossFit primers. */
export const isMainLift = (e: Exercise) =>
  /\b(squat|deadlift|bench press|shoulder press|overhead press|military press|push press|bent over row|barbell row|pull-?up|chin-?up|hip thrust|lunge|dip)\b/i.test(e.name) &&
  !/band|chain|smith|high pull|one arm|single|reverse|box|jump|kettlebell|upright|rear delt|lying|hyperextension/i.test(e.name)

/**
 * Everyday gym staples: what most programs are built from. Random workouts reach for these first and only use the
 * rest of the library to fill gaps (checked against the everyday and the full name).
 */
const STAPLES = new RegExp([
  'squat', 'leg press', 'lunge', 'split squat', 'step-?up', 'deadlift', 'hip thrust', 'glute bridge', 'leg curl', 'leg extension', 'calf raise', 'back extension', 'good morning',
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

/**
 * Specialist variations of everyday lifts (a deficit deadlift, a speed box squat, curls lying against an incline):
 * fine to pick by hand, odd in a random workout. They don't count as staples.
 */
const ODD_VARIANT = /\b(kneeling squat|speed|deficit|cambered|against|off of|with no|sprint|pass through|inner|plie|long bar|bosu|zercher|jefferson|anderson|pin|board|partial|tempo|bottoms?[- ]up|lying cambered|close and wide|side to side|one-legged|reverse triceps bench|front raise and pullover|bent-arm|mixed grip|suspended|sled|neck|bodyweight flyes)\b/i
export const isStaple = perExercise((e) => STAPLES.test(`${e.name} ${e.fullName ?? ''}`) && !ODD_VARIANT.test(e.name))

// Movement patterns ("families"), so a workout covers different movements instead of variations of one: one deadlift
// (not an RDL, a stiff-legged deadlift and a sumo deadlift), one squat, one flat press. Programs are built from distinct
// patterns (squat, hinge, lunge, horizontal and vertical push and pull...), and variation helps when each exercise works
// a muscle differently (squats plus leg extensions for quads), not when it repeats one (Kassiano et al. 2022, J Strength
// Cond Res). First match wins, so specific patterns come before general ones (seated calf raise before calf raise).
const FAMILIES: [string, RegExp][] = [
  // Legs and hips
  // (Burpee-like floor moves first: a squat thrust isn't a squat.)
  ['burpee', /squat thrust|sprawl/i],
  ['seated calf', /seated.*calf|calf.*seated/i], ['calf', /calf|calves/i],
  ['leg curl', /leg curl|hamstring curl|nordic|glute[- ]ham/i], ['leg extension', /leg extension|sissy squat/i], ['leg press', /leg press/i],
  ['hinge', /deadlift|\brdl\b|good ?morning|pull[- ]?through|(kettlebell|dumbbell)s? swings?|rack pull|stiff[- ]legs?\b/i],
  ['lunge', /lunge|split squat|step[- ]?ups?\b/i], ['jump', /jump|bound\b|\bhops?\b|skater/i], ['squat', /squat|thruster/i],
  ['bridge', /hip thrust|glute bridge|hip bridge|butt lift|hip lift|leg bridge/i], ['abduction', /abduct|monster walk|clamshell/i], ['adduction', /adduct/i],
  ['glute kickback', /glute kickback|hip extension|legged cable kickback|^leg lift\b/i], ['back extension', /back extension|hyperextension|superman/i],
  // Pushing
  ['incline', /incline.*press/i], ['overhead', /overhead press|shoulder press|military|arnold|push press|pike push|handstand push|see-saw press/i],
  ['decline pushup', /decline push|feet elevated|feet on an exercise ball/i], ['close pushup', /(close|diamond).*push[- ]?up|push[- ]?ups?.*(close|diamond|triceps position)/i], ['pushup', /push[- ]?ups?\b/i],
  ['bench', /bench press|chest press|floor press|decline.*press|svend press/i], ['dip', /\bdips?\b|dip machine/i],
  ['rear delt', /rear[- ]delt|rear lateral|bent over.*lateral|reverse.*fly|reverse.*flye|face pull|pull apart/i], ['fly', /\bfly|flye|crossover|pec deck|iron cross|butterfly/i],
  ['lateral raise', /lateral raise|laterals|deltoid raise|scaption/i], ['front raise', /front.*raise/i], ['rotator cuff', /external rotation|internal rotation|cuban press/i],
  // Pulling
  ['upright row', /upright.*row|high pull\b/i], ['shrug', /shrug/i], ['pullover', /pullover|straight[- ]arm pulldown/i],
  ['vertical pull', /pulldown|pull[- ]?ups?\b|chin[- ]?ups?\b|chin\b|muscle[- ]up/i], ['row', /\brows?\b|bench pull/i],
  // Arms
  ['hammer curl', /hammer.*curl|cross body hammer/i], ['reverse curl', /reverse.*curl|zottman/i], ['wrist', /wrist|finger curl/i], ['curl', /(?<!leg |hamstring )curl/i],
  ['overhead triceps', /overhead.*(triceps|extension)|seated triceps press|standing triceps press|french press|standing (one-arm )?dumbbell triceps extension|one-arm triceps extension|low-pulley one-arm triceps/i],
  ['lying triceps', /skull|lying.*triceps?|triceps?.*lying|tate press|jm press|decline.*triceps extension|incline barbell triceps/i],
  ['pushdown', /push-?down|triceps? extension|kickback/i],
  // Trunk and the rest
  ['side plank', /side plank|side bridge|side bend/i], ['plank', /plank|rollout|ab roller|ab wheel|dead bug/i],
  ['leg raise', /leg raise|knee raise|leg lift|knee tuck|leg tuck|pull-in|toes to bar|hanging pike|flutter kick|scissor kick|reverse crunch|hip raise/i],
  ['crunch', /crunch|sit-?up|v-?up|jackknife|toe touch|elbow to knee|heel touch/i], ['rotation', /russian twist|woodchop|wood chop|twist|pallof|landmine 180|cable lift/i],
  ['carry', /carry|farmer|yoke/i], ['olympic', /\bclean\b|snatch|jerk/i], ['burpee', /burpee/i], ['slam', /slam|wall ball/i],
]
/** The big lifts a session never doubles up on, even to fill the time: a second squat or deadlift only adds fatigue. */
export const ONE_ONLY = new Set(['squat', 'hinge', 'bench', 'incline', 'overhead', 'leg press', 'olympic', 'bridge'])
export const familyOf = perExercise((e) => {
  const text = `${e.name} ${e.fullName ?? ''}`
  const f = FAMILIES.find(([, re]) => re.test(text))?.[0]
  if (f) return f
  // Presses named by their kit (Seated Dumbbell Press, Close-Grip EZ-Bar Press): what they are depends on the muscle.
  if (/press/i.test(text)) return e.group === 'Shoulders' ? 'overhead' : e.group === 'Triceps' || e.group === 'Chest' ? 'bench' : undefined
  return undefined
})

/** Niche or gimmicky moves that make a random workout feel odd. Still available to pick by hand. */
export const isQuirky = perExercise((e) =>
  /\b(bands?|chains?|isometric|around the worlds?|turkish|windmill|get-?up|wipers?|body-up|butt-ups|halo|pass between|otis|london bridges|conan|plate movers)\b/i.test(e.name))

/** Olympic lifts and their variations: great, but too technical to hand out at random for sets of 6-12. */
export const isTechnical = perExercise((e) => /\b(clean|snatch|jerk)\b/i.test(e.name))

/** Movements too advanced or awkward to prescribe at random. */
export const isAdvanced = perExercise((e) => /single-arm|one-arm|one arm|pistol|handstand|muscle-up|planche|clap|archer|freehand jump|explosive|kipping/i.test(e.name))
