import { EXERCISES } from '../data/exercises'
import { hasGear } from './equipment'
import { modeOf } from './exerciseModes'
import { sessionSets } from './muscles'
import type { Exercise, PlannedExercise } from '../types'
import { generateCrossfit, generateHyrox, generateTimed } from './functionalStyles'
import { liftMinutes, REST_SCALE, restFor, transitionMin, WARMUP_SET_MIN, workSeconds, type RestPref } from './timing'
import { addDropSets, placeWarmups } from './warmups'
import { cardioSession, type CardioSessionKind } from './cardioSession'
import { cardioSplit, likedCardio, wodAmount, wodCardio } from './cardioPrefs'
import { expandParts, FULL_BODY_ORDER, isFullBody, LOWER_PARTS, UPPER_PARTS, BODY_PARTS } from './bodyParts'
import { byPreference, liked, preferenceBonus, tooAdvanced, unwanted } from './movePrefs'
import { favoriteIds, isFavorite } from './favorites'
import { stationOf, staysPut, walkCost } from './stations'
import { BY_ID, customPool, familyOf, FULL_BODY_GROUPS, isAdvanced, isIsolation, isMainLift, isQuirky, isStaple, isTechnical, ONE_ONLY, POOL, pick, roundTo5, shuffle, softShuffle, type Rng } from './randomUtil'

export const FOCUS_OPTIONS = [...BODY_PARTS, 'Cardio'] as const
export const LIFT_GROUPS: string[] = [...BODY_PARTS]

export type WorkoutStyle = 'standard' | 'strength' | 'supersets' | 'circuit' | 'pha' | 'hyrox' | 'crossfit' | 'amrap' | 'emom' | 'fortime' | 'tabata' | 'bodyweight'

export interface StyleInfo {
  id: WorkoutStyle
  label: string
  blurb: string
  /** Whether body-part selection is needed, optional (empty = full body), or ignored (format is always full body). */
  focus: 'required' | 'optional' | 'ignored'
}

export const STYLES: StyleInfo[] = [
  { id: 'standard', label: 'Standard', blurb: 'Straight sets — the classic gym workout.', focus: 'required' },
  { id: 'strength', label: 'Strength', blurb: 'Heavy compound lifts: 4–5 sets of low reps with longer rests.', focus: 'required' },
  { id: 'supersets', label: 'Supersets', blurb: 'Exercises paired back to back with little rest, so you fit more work into the time.', focus: 'required' },
  { id: 'circuit', label: 'HIIT circuit', blurb: 'Rounds of timed work and short rests. Leave body parts empty for full body.', focus: 'optional' },
  { id: 'pha', label: 'PHA', blurb: 'Peripheral heart action: alternate upper- and lower-body moves with almost no rest.', focus: 'optional' },
  { id: 'hyrox', label: 'Hyrox-style', blurb: 'Run plus a station, repeated: SkiErg, sleds, carries, wall balls. Always full body.', focus: 'ignored' },
  { id: 'crossfit', label: 'CrossFit-style', blurb: 'Optional strength primer, then a timed WOD: AMRAP, EMOM, or rounds for time. Full body.', focus: 'ignored' },
  { id: 'amrap', label: 'AMRAP', blurb: 'As many rounds as possible in a set time. Leave body parts empty for full body.', focus: 'optional' },
  { id: 'emom', label: 'EMOM', blurb: 'Every minute on the minute: a movement each minute, rest what’s left of it.', focus: 'optional' },
  { id: 'fortime', label: 'For time', blurb: 'A set number of rounds against the clock, with a time cap.', focus: 'optional' },
  { id: 'tabata', label: 'Tabata', blurb: '20 seconds all-out, 10 rest, 8 times per movement, then a minute\'s break. Leave body parts empty for full body.', focus: 'optional' },
  { id: 'bodyweight', label: 'Bodyweight', blurb: 'No equipment needed.', focus: 'required' },
]
/** How styles are shown: a few top-level choices, some with variations underneath. */
export const STYLE_GROUPS: { label: string; styles: WorkoutStyle[] }[] = [
  { label: 'Standard', styles: ['standard'] },
  { label: 'Strength', styles: ['strength'] },
  { label: 'Supersets', styles: ['supersets'] },
  { label: 'Bodyweight', styles: ['bodyweight'] },
  { label: 'HIIT', styles: ['circuit', 'pha'] },
  { label: 'Timed', styles: ['amrap', 'emom', 'tabata', 'fortime'] },
  { label: 'Hyrox / CrossFit', styles: ['hyrox', 'crossfit'] },
]

export const styleInfo = (id: WorkoutStyle) => STYLES.find((s) => s.id === id)!

const MIN_SETS = 2
const MAX_SETS = 4

/** Lower = more "main lift" (done earlier in a workout). */
const equipmentRank = (e: Exercise) =>
  ({ Barbell: 0, Dumbbell: 1, Kettlebell: 1, Machine: 2, Cable: 2, 'EZ bar': 2, Bodyweight: 3 })[e.equipment ?? ''] ?? 4

/** Bodyweight moves few people can do 15 of: pull-ups, chin-ups, dips, inverted rows, Nordic curls… */
const HARD_BODYWEIGHT = /pull-?up|chin-?up|\bdips?\b|inverted|australian|muscle-?up|nordic|pistol|handstand/i

/** Rep target by exercise style: heavy barbell work low, accessories higher. */
export function repsFor(e: Exercise, rng: Rng = Math.random): number {
  if (e.group === 'Core') return 15
  if (modeOf(e) === 'reps') return (HARD_BODYWEIGHT.test(e.name) ? [6, 8, 10] : [10, 12, 15])[Math.floor(rng() * 3)]
  const r = equipmentRank(e)
  if (r === 0) return rng() < 0.5 ? 6 : 8
  if (r <= 2) return rng() < 0.5 ? 10 : 12
  return 12
}

/** Reps for weights and bodyweight moves, a hold time in seconds for timed ones. */
export function targetsFor(e: Exercise, rng: Rng = Math.random): Pick<PlannedExercise, 'reps' | 'seconds'> {
  return e.mode === 'time' ? { seconds: [30, 45, 60][Math.floor(rng() * 3)] } : { reps: repsFor(e, rng) }
}

/** Reps from a chosen range for a weighted lift (the low end for big compound lifts), or null to use the style's own. */
const repsIn = (range: [number, number] | undefined, e: Exercise, main = false): Pick<PlannedExercise, 'reps' | 'seconds'> | null =>
  range && modeOf(e) === 'weight' ? { reps: main || isMainLift(e) ? range[0] : range[1] } : null

/** Only carry an instruction to a replacement when it applies to any exercise (interval timing), not one station. */
const carriesNote = (label?: string) => !!label && /^(HIIT|PHA)/.test(label)

/** A plan entry for `ex`, borrowing the previous entry's sets, minutes, and block when replacing one. */
export function plannedFor(ex: Exercise, prev?: PlannedExercise, rng: Rng = Math.random): PlannedExercise {
  const keep: Partial<PlannedExercise> = prev?.block
    ? { block: prev.block, blockLabel: prev.blockLabel, est: prev.est, ...(prev.wod ? { wod: prev.wod } : {}), ...(prev.warmup ? { warmup: true } : {}), ...(carriesNote(prev.blockLabel) && prev.note ? { note: prev.note } : {}) }
    : { est: prev?.est }
  if (ex.kind === 'cardio') return { exerciseId: ex.id, sets: 1, minutes: prev?.minutes ?? 15, ...keep }
  const targets = keep.note ? {} : targetsFor(ex, rng)
  const item: PlannedExercise = { exerciseId: ex.id, sets: Math.max(prev?.warmup ? 1 : MIN_SETS, prev?.sets ?? 3), ...targets, ...keep }
  if (!prev?.block) {
    // A straight-set replacement gets its own rest and time estimate.
    item.rest = restFor(ex, item.reps, item.seconds)
    item.est = Math.round(liftMinutes(item, ex) * 10) / 10
  }
  return item
}

/** Estimated minutes for a workout: each item's own estimate, or the realistic lifting model when it has none. */
export const minutesFor = (items: PlannedExercise[]) =>
  items.reduce((sum, p) => {
    if (p.est != null) return sum + p.est
    const e = BY_ID.get(p.exerciseId)
    return e ? sum + liftMinutes(p, e) : sum
  }, 0)

// ---------------------------------------------------------------------------------------------
// Warm-up: easy cardio and/or dynamic mobility moves before the workout.
// ---------------------------------------------------------------------------------------------

export interface WarmupOptions {
  /** Minutes of easy cardio. */
  cardio?: number
  /** Minutes of dynamic mobility moves. */
  mobility?: number
  /** Ramp-up sets before heavy lifts (their time comes out of the lifting part). */
  sets?: boolean
}

/** Usual warm-up length: 5 minutes of either easy cardio or mobility, 9 for both. */
export const defaultWarmMinutes = (warm: ('cardio' | 'mobility' | 'sets')[]) =>
  (warm.includes('cardio') ? 5 : 0) + (warm.includes('mobility') ? (warm.includes('cardio') ? 4 : 5) : 0)

/** Warm-up for a session when there's no per-part control (week/month plans), optionally `total` minutes long. */
export function defaultWarmup(warm: ('cardio' | 'mobility' | 'sets')[], lifting: boolean, total?: number): WarmupOptions {
  const both = warm.includes('cardio') && warm.includes('mobility')
  const t = total ?? defaultWarmMinutes(warm)
  const cardio = both ? Math.round(t * 0.55) : t
  return {
    ...(warm.includes('cardio') ? { cardio } : {}),
    ...(warm.includes('mobility') ? { mobility: both ? t - cardio : t } : {}),
    sets: warm.includes('sets') && lifting,
  }
}

const WARMUP_CARDIO = ['Bicycling_Stationary', 'x-row-erg', 'Elliptical_Trainer', 'Rope_Jumping', 'Walking_Treadmill']
const MOVE_SECONDS = 30
const MOVE_SWITCH = 10

/** Mobility moves suited to what's being trained: upper-body focus warms shoulders and chest, lower warms hips and legs. */
function mobilityPool(focus: string[]): Exercise[] {
  const all = EXERCISES.filter((e) => e.tags?.includes('mobility'))
  const upper = focus.some((g) => UPPER_PARTS.includes(g))
  const lower = focus.some((g) => LOWER_PARTS.includes(g) || g === 'Core') || focus.includes('Cardio')
  const want = (e: Exercise) => e.tags!.includes('full') || (upper && e.tags!.includes('upper')) || (lower && e.tags!.includes('lower')) || (!upper && !lower)
  return all.filter(want)
}

export function generateWarmup(focus: string[], w: WarmupOptions, rng: Rng, avoid: Set<string>): PlannedExercise[] {
  const out: PlannedExercise[] = []
  const base = { block: 'warmup', blockLabel: 'Warm-up', warmup: true } as const
  if (w.cardio && w.cardio > 0) {
    // Machines only if they're available; otherwise a jump rope or a brisk walk outside.
    // Their favourite machine when they have one (easy running is a warm-up too, swimming and cycling outside aren't).
    const ok = (c: string) => BY_ID.has(c) && hasGear(BY_ID.get(c)!)
    const mine = (likedCardio() ?? []).map((e) => e.id).filter((id) => id !== 'swimming' && id !== 'cycling')
    // Something not already in the workout first (the WOD's rower stays the WOD's), else their favourite anyway.
    const id = mine.find((c) => !avoid.has(c)) ?? WARMUP_CARDIO.find((c) => !avoid.has(c) && ok(c)) ?? (['walking'].find((c) => !avoid.has(c))) ?? mine[0] ?? WARMUP_CARDIO.find(ok) ?? 'walking'
    out.push({ exerciseId: id, sets: 1, minutes: Math.round(w.cardio), est: Math.round(w.cardio), note: 'Easy pace, building up gradually', ...base })
  }
  if (w.mobility && w.mobility > 0) {
    const count = Math.max(3, Math.min(12, Math.round((w.mobility * 60) / (MOVE_SECONDS + MOVE_SWITCH))))
    const pool = mobilityPool(focus)
    // Keep a sensible order: full-body moves, then upper, then lower (roughly top to bottom).
    const rank = (e: Exercise) => (e.tags!.includes('full') ? 0 : e.tags!.includes('upper') ? 1 : 2)
    const moves = shuffle(pool, rng).slice(0, count).sort((a, b) => rank(a) - rank(b))
    for (const e of moves) out.push({ exerciseId: e.id, sets: 1, seconds: MOVE_SECONDS, est: (MOVE_SECONDS + MOVE_SWITCH) / 60, ...base })
  }
  return out
}

/**
 * Steady cardio for `minutes`: the kinds the person likes (all of them, sharing the time, if they split it),
 * otherwise anything they can do, with long sessions split over two.
 */
function pickCardio(minutes: number, rng: Rng, avoid: Set<string> = new Set(), spec?: CardioSpec): PlannedExercise[] {
  const liked = likedCardio()
  const pool = softShuffle(liked ?? POOL.filter((e) => e.kind === 'cardio' && hasGear(e)), avoid, rng)
  // A chosen activity or session type (intervals, tempo…): one session, written out for that activity.
  if (spec?.exerciseId || (spec?.kind && spec.kind !== 'steady')) {
    const id = spec.exerciseId ?? pool[0]?.id
    return id ? [cardioSession(id, spec.kind ?? 'steady', roundTo5(minutes))] : []
  }
  if (pool.length === 0) return []
  // Split: every liked kind gets a share, at least 5 minutes each.
  const n = liked && cardioSplit() ? Math.max(1, Math.min(pool.length, Math.floor(minutes / 5))) : !liked && minutes > 45 ? 2 : 1
  const total = roundTo5(minutes)
  const each = Math.max(5, roundTo5(total / n))
  return pool.slice(0, n).map((e, i) => ({ exerciseId: e.id, sets: 1, minutes: i < n - 1 ? each : Math.max(5, total - each * (n - 1)) }))
}

// ---------------------------------------------------------------------------------------------
// Straight-set styles (standard, strength, bodyweight, supersets) share one picker. Time comes from a realistic
// model (work + rest + setup, see timing.ts); exercises and sets are added until the workout fills the time.
// ---------------------------------------------------------------------------------------------

interface LiftConfig {
  /** Sets each exercise starts with, and the most it grows to when filling time. */
  sets: number
  maxSets: number
  /** Exercises this style may use for a group. */
  filter: (e: Exercise) => boolean
  /** When a group has nothing that passes `filter`: use anything ('any', for all or per group) or borrow another group. */
  fallback: 'any' | Record<string, string>
  targets: (e: Exercise, rng: Rng) => Pick<PlannedExercise, 'reps' | 'seconds'>
  sortByRank: boolean
  /** Strength: start with one heavy main lift per chosen muscle group (up to 3), then accessories. */
  mains?: boolean
  /** Targets for those main lifts (the rest use `targets`). */
  mainTargets?: (e: Exercise, rng: Rng) => Pick<PlannedExercise, 'reps' | 'seconds'>
}

/** The cardio part of a workout: a specific activity (e.g. treadmill running) and the kind of session. */
export interface CardioSpec {
  exerciseId?: string
  kind?: CardioSessionKind
}

export interface LiftOptions {
  /** The cardio part (on its own or as a finisher), when the person chose an activity or session type. */
  cardio?: CardioSpec
  rest?: RestPref
  /** Full body: never give a part a second exercise, even if the session comes up short (supersets pick from this). */
  noRepeats?: boolean
  /** Add ramp-up warm-up sets before the heavy lifts. */
  warmupSets?: boolean
  /** Lifts the person has been logging: picked first so their numbers carry over and keep progressing. */
  familiar?: Set<string>
  /**
   * Most hard sets a muscle gets in one session (planned weeks use this). Past about 10-15, more sets add fatigue
   * rather than growth, so the time goes elsewhere instead of to a ninth exercise for the same muscle.
   */
  setCap?: (part: string) => number
  /** Reps for weighted lifts: [big compound lifts, everything else] (e.g. [5, 8] for heavy work). */
  repRange?: [number, number]
  /** Most different exercises for one muscle (default: 5 when sets are capped, else no limit). */
  maxPerPart?: number
  /** Sets each exercise starts with and grows to while filling the time (the style's own otherwise). */
  setsPerExercise?: [number, number]
}

/** At most this many different exercises for one muscle in a session, when sets are capped. */
const MAX_PER_PART = 5

const STANDARD: LiftConfig = {
  sets: 3, maxSets: MAX_SETS, fallback: 'any', targets: targetsFor, sortByRank: true,
  // Jumps are power and conditioning work (plyometrics), not straight sets: they're for circuits and bodyweight days.
  filter: (e) => familyOf(e) !== 'jump',
}

const isHeavyLift = (e: Exercise) => modeOf(e) === 'weight' && equipmentRank(e) <= 1 && isMainLift(e)
/** Heavy work that loads the lower back: a heavy lift, or any barbell squat or hinge (a good morning too). */
const loadsBack = (e: Exercise) => isHeavyLift(e) || (e.equipment === 'Barbell' && modeOf(e) === 'weight' && (familyOf(e) === 'squat' || familyOf(e) === 'hinge'))
/** A big squat or deadlift: it tires out everything else that's heavy, so it pairs with lighter work. */
const bigLegLift = (e: Exercise) => loadsBack(e) && (familyOf(e) === 'squat' || familyOf(e) === 'hinge')
/** Two lifts too heavy to pair: a squat with a deadlift or good morning, a deadlift with a heavy row. */
const tooHeavyPair = (a: Exercise, b: Exercise) => (bigLegLift(a) && loadsBack(b)) || (bigLegLift(b) && loadsBack(a))

const STRENGTH: LiftConfig = {
  sets: 3, maxSets: 5,
  // Compound work only. Arms and core fall back to their usual moves (they're isolation by nature); calves get more
  // heavy leg work instead of calf raises.
  filter: (e) => e.mode !== 'time' && e.group !== 'Core' && !isIsolation(e) && !isAdvanced(e) && familyOf(e) !== 'jump',
  fallback: { Calves: 'Quads', Biceps: 'any', Triceps: 'any', Forearms: 'any', Core: 'any' },
  // Main lifts heavy: 3-5 reps for barbell squats, deadlifts and presses, 5-6 for the rest (rows, dumbbells, hip
  // thrusts); accessories after them in the 6-10 range (ACSM 2009: heavy multi-joint work first, 1-6 reps for strength).
  mainTargets: (e, rng) => ({ reps: equipmentRank(e) === 0 && ['squat', 'hinge', 'bench', 'incline', 'overhead'].includes(familyOf(e) ?? '') ? pick([3, 5], rng) : pick([5, 6], rng) }),
  targets: (e, rng) => (modeOf(e) === 'weight' ? { reps: pick([6, 8, 10], rng) } : targetsFor(e, rng)),
  sortByRank: true,
  mains: true,
}

const BODYWEIGHT: LiftConfig = {
  sets: 3, maxSets: 4,
  // Moves people log as bodyweight (their choice where they've made one; weighted dips and pull-ups otherwise aren't).
  filter: (e) => e.equipment === 'Bodyweight' && modeOf(e) !== 'weight' && !isAdvanced(e),
  fallback: { Shoulders: 'Chest', Biceps: 'Back', Triceps: 'Chest', Glutes: 'Quads', Hamstrings: 'Glutes', Calves: 'Quads' },
  targets: (e, rng) =>
    e.mode === 'time'
      ? { seconds: pick([30, 45, 60], rng) }
      : { reps: pick(HARD_BODYWEIGHT.test(e.name) ? [6, 8, 10] : e.group === 'Core' ? [15, 20] : [12, 15, 20], rng) },
  sortByRank: false,
}

const SUPERSET: LiftConfig = { ...STANDARD }

/** Muscle groups to borrow from once a group runs out of suitable exercises (long workouts, small pools). */
const RELATED: Record<string, string[]> = {
  Quads: ['Glutes', 'Hamstrings'], Hamstrings: ['Glutes', 'Quads'], Glutes: ['Hamstrings', 'Quads'], Calves: ['Quads', 'Hamstrings'],
  Chest: ['Shoulders', 'Triceps'], Back: ['Biceps', 'Shoulders'], Shoulders: ['Chest', 'Back'], Biceps: ['Back', 'Triceps'],
  Triceps: ['Chest', 'Biceps'], Core: ['Glutes', 'Quads'],
}

/** Favorite library exercises that random workouts wouldn't usually pick (they're in the running too). */
const favoritesOutsidePool = () => [...favoriteIds()].map((id) => BY_ID.get(id)).filter((e): e is Exercise => !!e && !e.suggest && !e.custom)

/**
 * Deadlifts and other hip hinges belong on days that train the legs, or a back-and-biceps (pull) day, not a chest and
 * back upper-body day (upper/lower and push/pull/legs splits put them with the legs or the pulling).
 */
export const hingeFits = (groups: string[]) =>
  groups.some((g) => LOWER_PARTS.includes(g)) || (groups.includes('Back') && !groups.some((g) => ['Chest', 'Shoulders', 'Triceps'].includes(g)))

/** Everyday lifts first in random workouts; their own exercises count as everyday (they made them to use them). */
const everyday = (e: Exercise) => !!e.custom || isStaple(e)

/** Candidate exercises per group, in the order they'll be offered: the group's own first, then related groups. */
function queuesFor(groups: string[], rng: Rng, avoid: Set<string>, cfg: LiftConfig, familiar = new Set<string>()) {
  // Olympic lifts stay out of random straight-set workouts (CrossFit-style keeps its own list).
  // Random workouts stick to mainstream moves; niche and advanced ones only if a group would otherwise be empty.
  // Favorites are always in the running, whatever they are.
  // Their own exercises are in the running too, like favorites.
  const hinges = hingeFits(groups)
  const strengthPool = (g: string) => {
    const all = [...POOL, ...favoritesOutsidePool(), ...customPool()].filter((e) => e.kind === 'strength' && e.group === g && (isFavorite(e) || !!e.custom || !isTechnical(e)) && hasGear(e) && (hinges || familyOf(e) !== 'hinge'))
    const plain = all.filter((e) => isFavorite(e) || !!e.custom || (!isQuirky(e) && !tooAdvanced(e)))
    return plain.length ? plain : all
  }
  const own = (g: string) => {
    let pool = strengthPool(g).filter(cfg.filter)
    if (pool.length === 0) {
      const fb = cfg.fallback === 'any' ? 'any' : cfg.fallback[g]
      if (fb === 'any') pool = strengthPool(g)
      else if (fb) pool = strengthPool(fb).filter(cfg.filter)
    }
    // Staples first (in random order), then the rest of the library as a fallback.
    // With equipment around, weighted staples before bodyweight versions (bodyweight squats aren't a gym workout).
    const mixed = softShuffle(pool, avoid, rng)
    const weighted = (e: Exercise) => equipmentRank(e) <= 2
    // Lifts they've been logging go first, so the numbers carry over from plan to plan.
    const known = mixed.filter((e) => familiar.has(e.id) && !avoid.has(e.id))
    const rest = mixed.filter((e) => !known.includes(e))
    const tiered = [...known, ...rest.filter((e) => everyday(e) && weighted(e)), ...rest.filter((e) => everyday(e) && !weighted(e)), ...rest.filter((e) => !everyday(e))]
    // Kinds of movement they asked for more of, and favorites, are likelier picks (less of: last); last workout's
    // picks a tier down.
    const tierOf = (e: Exercise) => (known.includes(e) ? 0 : !everyday(e) ? 3 : weighted(e) ? 1 : 2)
    return byPreference(tiered, rng, tierOf, avoid)
  }
  return new Map(
    groups.map((g) => {
      const borrowed = (RELATED[g] ?? []).filter((r) => !groups.includes(r)).flatMap((r) => softShuffle(strengthPool(r).filter(cfg.filter), avoid, rng))
      return [g, [...own(g), ...borrowed]] as [string, Exercise[]]
    }),
  )
}

/** Time for a list of lifts, counting paired supersets as sharing one rest. */
export function liftsMinutes(items: PlannedExercise[], pref: RestPref = 'normal'): number {
  let total = 0
  for (let i = 0; i < items.length; i++) {
    const p = items[i]
    const ex = BY_ID.get(p.exerciseId)
    const q = items[i + 1]
    if (p.block?.startsWith('ss') && q && q.block === p.block) {
      total += supersetMinutes(p, q, pref)
      i++
    } else total += liftMinutes(p, ex, pref)
  }
  return total
}

const PAIR_REST = 75
function supersetMinutes(a: PlannedExercise, b: PlannedExercise, pref: RestPref): number {
  const rounds = Math.max(a.sets, b.sets)
  const rest = Math.round(PAIR_REST * REST_SCALE[pref])
  const secs = rounds * (workSeconds(a) + workSeconds(b) + 20) + (rounds - 1) * rest
  return secs / 60 + (a.warmupSets ?? 0) * WARMUP_SET_MIN + transitionMin(BY_ID.get(a.exerciseId)) + transitionMin(BY_ID.get(b.exerciseId))
}

/** Each part's classic movements, tried in order on full-body days (the first that fits the equipment wins). */
const PART_PATTERNS: Record<string, RegExp[]> = {
  Quads: [/squat/i, /leg press|lunge|split squat|step-?up/i],
  Hamstrings: [/romanian|stiff[- ]legged|deadlift/i, /good ?morning|leg curl|glute[- ]ham/i],
  Chest: [/bench press/i, /press|dip|push-?up/i],
  Back: [/(?<!upright )\brows?\b/i, /pull-?up|chin-?up|pulldown/i],
  Shoulders: [/overhead press|shoulder press|military press|push press|arnold/i, /press/i],
  Glutes: [/hip thrust|glute bridge|bridge/i],
  Biceps: [/curl/i],
  Triceps: [/push-?down|extension|skull|dip/i],
  Calves: [/calf raise/i],
  Core: [/plank|crunch|leg raise|rollout|ab roller|sit-?up|dead bug|pallof|hollow/i],
}
/** Parts whose full-body pick should be a multi-joint lift when the pattern list finds nothing. */
const COMPOUND_PARTS = new Set(['Quads', 'Hamstrings', 'Chest', 'Back', 'Shoulders', 'Glutes'])
/**
 * Each part's movements in the order programs reach for them: its main compound pattern first (a row or pull-down for
 * back, a press for chest, a squat for quads, a deadlift for hamstrings), then the next one, then work for what those
 * miss (ACSM 2009; NSCA: core lifts, then assistance). Exercises for a part are picked from its next two patterns not
 * yet in the workout, so an upper-body day gets a row before a shrug.
 */
const PATTERN_ORDER: Record<string, string[]> = {
  Chest: ['bench', 'incline', 'fly', 'dip', 'pushup', 'decline pushup', 'pullover'],
  Back: ['row', 'vertical pull', 'pullover', 'back extension', 'shrug', 'hinge'],
  Shoulders: ['overhead', 'lateral raise', 'rear delt', 'upright row', 'front raise'],
  Biceps: ['curl', 'hammer curl', 'reverse curl'],
  Triceps: ['pushdown', 'overhead triceps', 'lying triceps', 'dip', 'bench', 'close pushup'],
  Quads: ['squat', 'lunge', 'leg press', 'leg extension'],
  Hamstrings: ['hinge', 'leg curl', 'back extension'],
  Glutes: ['bridge', 'lunge', 'abduction', 'glute kickback'],
  Calves: ['calf', 'seated calf'],
  Core: ['plank', 'crunch', 'leg raise', 'rotation', 'side plank'],
}
/** Each part's main lift, what it starts with and what leads a strength day: the movements programs are built on. */
const MAIN_LIFTS: Record<string, string[]> = {
  Quads: ['squat'], Hamstrings: ['hinge'], Chest: ['bench', 'incline'], Back: ['row', 'vertical pull'], Shoulders: ['overhead'], Glutes: ['bridge'],
}
/** One of the part's main lifts (a squat for quads, a deadlift or RDL for hamstrings, a row or pull-down for back…). */
const isMainMove = (e: Exercise) => (MAIN_LIFTS[e.group] ?? []).includes(familyOf(e) ?? '')

/** Workout order: big multi-joint lifts first, then single-joint work, core last; heavier equipment first within each. */
const orderKey = (e: Exercise) => (e.group === 'Core' ? 3 : isIsolation(e) ? 2 : isMainLift(e) ? 0 : 1) * 10 + equipmentRank(e)

function pickLifts(groups: string[], minutes: number, rng: Rng, avoid: Set<string>, cfg: LiftConfig, opts: LiftOptions = {}): PlannedExercise[] {
  if (groups.length === 0 || minutes < 5) return []
  const pref = opts.rest ?? 'normal'
  // Full body: one exercise per body part, big movements first (squat, press, pull, hinge…), extra time as extra sets.
  // Other choices can get several exercises each, and the bigger parts get theirs first (a lunge and a leg curl before a
  // second calf raise; ACSM 2009: large muscle groups before small).
  const fullBody = isFullBody(groups)
  const order = [...FULL_BODY_ORDER.filter((g) => groups.includes(g)), ...groups.filter((g) => !FULL_BODY_ORDER.includes(g))]
  const startSets = opts.setsPerExercise?.[0] ?? cfg.sets
  const maxSets = opts.setsPerExercise?.[1] ?? (fullBody ? Math.max(cfg.maxSets, 5) : cfg.maxSets)
  const perPartMax = opts.maxPerPart ?? (opts.setCap ? MAX_PER_PART : Infinity)
  const familiar = opts.familiar ?? new Set<string>()
  const queues = queuesFor(order, rng, avoid, cfg, familiar)
  const taken = new Set<string>()
  const items: PlannedExercise[] = []
  const perPart = new Map<string, number>()
  const cost = () => liftsMinutes(items, pref)
  const make = (e: Exercise, sets: number, main = false): PlannedExercise => {
    const t = repsIn(opts.repRange, e, main) ?? (main && cfg.mainTargets ? cfg.mainTargets : cfg.targets)(e, rng)
    return { exerciseId: e.id, sets, ...t, rest: restFor(e, t.reps, t.seconds, pref) }
  }
  // Hard sets per muscle so far, against the session cap (when there is one).
  const setsIn = (g: string) => items.reduce((a, p) => a + (BY_ID.get(p.exerciseId)?.group === g ? p.sets : 0), 0)
  const roomFor = (g: string | undefined, n: number) => !opts.setCap || !g || setsIn(g) + n <= opts.setCap(g)
  // One exercise per movement pattern (one deadlift, one squat, one flat press, one leg curl…): programs are built from
  // distinct patterns, and a second variation of one adds fatigue more than anything new (Kassiano et al. 2022). A kind
  // they asked for more of can have a second variation of a smaller movement on a day that isn't full body (two lunges
  // for someone who wants more one-leg work), never of a big lift.
  const family = new Map<string, number>()
  const tooSimilar = (e: Exercise) => {
    const f = familyOf(e)
    return !!f && (family.get(f) ?? 0) >= (!fullBody && liked(e) && !ONE_ONLY.has(f) ? 2 : 1)
  }
  /**
   * The part's next exercise. Strict: only a new movement for the part itself. Normal: when the part has nothing new
   * left (a long biceps day), a second variation of a smaller movement before borrowing a related part's (an arm day
   * stays arms, not rows), never a second of the big lifts. Neither uses a kind they asked for less of; 'any' does,
   * when the part has nothing else at all.
   */
  const nextFrom = (g: string, want?: (e: Exercise) => boolean, mode: 'strict' | 'normal' | 'any' = 'any') => {
    const q = queues.get(g)!
    const ok = (e: Exercise) => !taken.has(e.id) && (!want || want(e))
    const mine = (e: Exercise) => e.group === g
    const find = (fits: (e: Exercise) => boolean) => {
      let i = q.findIndex((e) => fits(e) && !tooSimilar(e))
      if (i < 0 && mode !== 'strict') i = q.findIndex((e) => fits(e) && !ONE_ONLY.has(familyOf(e) ?? ''))
      return i
    }
    let i = find((e) => ok(e) && mine(e) && !unwanted(e))
    if (i < 0 && mode === 'any') i = find((e) => ok(e) && mine(e))
    if (i < 0 && mode !== 'strict') i = find((e) => ok(e) && !unwanted(e))
    if (i < 0 && mode === 'any') i = find(ok)
    return i < 0 ? undefined : q.splice(i, 1)[0]
  }
  /**
   * The best candidate for part `g` on a full-body day, by what matters most: its own part (not borrowed), not
   * something rerolled away, a different movement from the rest of the workout, the part's classic pattern (a squat
   * for quads, a row for back…), free weights, and an everyday lift (Back Squat over Squat with Plate Movers).
   */
  const pickFor = (g: string, bonus: (e: Exercise) => number = () => 0, only?: (e: Exercise) => boolean) => {
    const q = queues.get(g)!
    const pats = PART_PATTERNS[g] ?? []
    let best = -1
    let bestScore = -Infinity
    q.forEach((e, i) => {
      // Only the part's own moves: a part with nothing suitable is left out rather than borrowing another's.
      if (taken.has(e.id) || e.group !== g || (only && !only(e))) return
      const score = (avoid.has(e.id) ? 0 : 16) + (tooSimilar(e) ? 0 : 8)
        + (pats[0]?.test(e.name) ? 4 : pats[1]?.test(e.name) ? 2 : 0) + (equipmentRank(e) <= 1 ? 1.5 : 0)
        + (e.fullName ? 2 : 0) + (isMainLift(e) ? 1 : 0) - (COMPOUND_PARTS.has(g) && isIsolation(e) ? 3 : 0) + bonus(e)
        // Kinds of movement they like (free weights, one arm / one leg…) and favorites win close calls, often not always.
        + preferenceBonus(e, rng)
        // A lift they've been doing keeps its progress going (but not over a squat for quads with a leg extension).
        + (familiar.has(e.id) && !(COMPOUND_PARTS.has(g) && isIsolation(e)) ? 5 : 0)
      if (score > bestScore) { bestScore = score; best = i }
    })
    return best < 0 ? undefined : q.splice(best, 1)[0]
  }
  // The part's next movement in program order (see PATTERN_ORDER): its main lift first where it has one (a squat for
  // quads, a deadlift or RDL for hamstrings), then one of its next two patterns not yet in, at random between them.
  // Favorites, lifts they've been logging and their own exercises of a kind it can't tell are always in the running;
  // once the part has its first exercise, so are kinds they asked for more of (from further down the list, or a second
  // variation).
  const nextInOrder = (g: string, strict: boolean) => {
    const open = (PATTERN_ORDER[g] ?? []).filter((f) => !family.get(f))
    const started = (perPart.get(g) ?? 0) > 0
    const from = (win: string[]) => win.length
      ? nextFrom(g, (x) => x.group === g && (isFavorite(x) || familiar.has(x.id) || win.includes(familyOf(x) ?? '') || (!!x.custom && !familyOf(x)) || (started && liked(x))), 'strict')
      : undefined
    return (started ? undefined : from((MAIN_LIFTS[g] ?? []).filter((f) => open.includes(f)))) ?? from(open.slice(0, 2)) ?? nextFrom(g, undefined, strict ? 'strict' : 'normal')
  }
  const fits = (limit: number) => cost() <= minutes * limit
  const tryAdd = (g: string, e: Exercise | undefined, sets: number, limit: number, main = false) => {
    if (!e || !roomFor(e.group, sets) || (perPart.get(g) ?? 0) >= perPartMax) return false
    items.push(make(e, sets, main))
    if (!fits(limit)) { items.pop(); return false }
    taken.add(e.id)
    perPart.set(g, (perPart.get(g) ?? 0) + 1)
    const f = familyOf(e)
    if (f) family.set(f, (family.get(f) ?? 0) + 1)
    return true
  }

  // Strength: the day's big lifts first, heavy, one per movement, in the classic order: a squat, a bench press, a row,
  // a deadlift or RDL, an overhead press (up to three). Arms, calves and core get no main lift; a hip thrust leads
  // only when there's no squat or deadlift to lead the legs.
  let mains = 0
  if (cfg.mains) {
    const lead = FULL_BODY_ORDER.filter((g) => groups.includes(g) && MAIN_LIFTS[g] && !(g === 'Glutes' && (groups.includes('Quads') || groups.includes('Hamstrings'))))
    for (const g of lead.slice(0, 3)) {
      // (A favorite or their own exercise of that movement can lead too, with a barbell or dumbbells.)
      const heavy = (x: Exercise) => isHeavyLift(x) || ((isFavorite(x) || !!x.custom) && modeOf(x) === 'weight' && equipmentRank(x) <= 1)
      const isMain = (x: Exercise) => x.group === g && heavy(x) && MAIN_LIFTS[g].includes(familyOf(x) ?? '')
      // The classic version (Bench Press, Back Squat, Deadlift, Barbell Row), with a barbell; dumbbells if there's none.
      const e = pickFor(g, (x) => (equipmentRank(x) === 0 ? 6 : 3), isMain)
      if (tryAdd(g, e, Math.min(maxSets, startSets + 1), 0.8, true)) mains++
    }
  }
  // Warm-up sets before the heavy lifts: more before the first one, fewer after (you're already warm).
  const warmups = () => {
    if (!opts.warmupSets) return
    // The first two weight lifts get them (never bodyweight or core), as on any day you edit later.
    const placed = placeWarmups(items.map(({ warmupSets: _w, ...p }) => (void _w, p)), (id) => BY_ID.get(id), cfg.mains ? 3 : 2)
    items.splice(0, items.length, ...placed)
  }
  warmups()
  // Strength is about the main lifts: give them up to 5 sets before accessories, within about 60% of the time.
  if (mains) {
    for (let round = 0; round < 2; round++) {
      for (const p of items.slice(0, mains)) {
        if (p.sets >= cfg.maxSets || !roomFor(BY_ID.get(p.exerciseId)?.group, 1)) continue
        p.sets++
        if (!fits(0.6)) p.sets--
      }
    }
  }

  // Full body: each part's classic movement with the heaviest equipment available (a squat for quads, a deadlift or
  // RDL for hamstrings, a bench press, a row, an overhead press, a hip thrust…), then the smaller parts while they fit.
  // A part with nothing but kinds they asked for less of (curls, for less isolation) waits until the rest are in.
  if (fullBody) {
    const later: string[] = []
    for (const g of order) {
      if (perPart.get(g)) continue
      const e = pickFor(g)
      if (e && unwanted(e)) { queues.get(g)!.unshift(e); later.push(g) } else tryAdd(g, e, startSets, 1.02)
    }
    for (const g of later) tryAdd(g, pickFor(g), startSets, 1.02)
  }

  // Then round-robin through the groups adding exercises while they fit (full body: only parts still missing one).
  const CAP = minutes >= 75 ? 12 : 10
  const roundRobin = (onePerPart: boolean, strict = false) => {
    for (let pass = 0; items.length < CAP; pass++) {
      let added = false
      for (const g of order) {
        if (items.length >= CAP) break
        if (onePerPart && perPart.get(g)) continue
        const accessorySets = opts.setsPerExercise ? startSets : cfg.mains ? 3 : cfg.sets
        if (tryAdd(g, onePerPart ? nextFrom(g, (x) => x.group === g) : nextInOrder(g, strict), accessorySets, 1.02)) added = true
      }
      if (!added || pass > 12) break
    }
  }
  roundRobin(fullBody, true)
  if (items.length === 0) {
    // Not even one exercise at the usual sets: take the first candidate with fewer sets.
    const e = order.map((g) => nextFrom(g)).find(Boolean)
    if (e) { items.push(make(e, MIN_SETS)); taken.add(e.id) }
  }

  const sortItems = () => {
    if (!cfg.sortByRank) return
    const heavy = items.slice(0, mains)
    const key = (p: PlannedExercise) => orderKey(BY_ID.get(p.exerciseId)!)
    const rest = items.slice(mains).sort((a, b) => key(a) - key(b))
    items.splice(0, items.length, ...heavy, ...rest)
  }
  // Fill leftover time with extra sets: main lifts first, then everything else, one set at a time.
  const fillSets = (cap = maxSets) => {
    for (let round = 0; round < cap + 2; round++) {
      let grew = false
      for (const p of items) {
        if (p.sets >= cap || !roomFor(BY_ID.get(p.exerciseId)?.group, 1)) continue
        p.sets++
        if (fits(1.02)) grew = true
        else p.sets--
      }
      if (!grew) break
    }
  }
  sortItems()
  warmups()
  fillSets()
  // A long session can still come up short (a few parts picked, or no equipment for some parts). Every part picked:
  // one more set each first. Then a part can get a second exercise, but only a different movement (never two squats).
  if (fullBody && fits(0.88) && !opts.noRepeats) {
    if (BODY_PARTS.every((p) => groups.includes(p))) fillSets(opts.setsPerExercise ? maxSets : maxSets + 1)
    if (fits(0.88)) {
      roundRobin(false, true)
      sortItems()
      warmups()
      fillSets()
    }
  }
  // Every movement in with its sets and still well short (one small part for a long time, a bodyweight leg day): a
  // second variation where the part has nothing new (a seated calf raise after a standing one), never of a big lift.
  if (!fullBody && fits(0.85)) {
    roundRobin(false)
    sortItems()
    warmups()
    fillSets()
  }

  // Still short (e.g. every exercise at max sets): squeeze in one more exercise with fewer sets.
  if (fits(0.9)) {
    // (A kind they asked for less of only when nothing else will do.)
    const squeeze = (mode: 'normal' | 'any') => order.some((g) =>
      cost() < minutes * 0.9 && (!fullBody || !perPart.get(g)) && tryAdd(g, nextFrom(g, fullBody ? (x) => x.group === g : undefined, mode), MIN_SETS, 1.08))
    if (!squeeze('normal')) squeeze('any')
  }
  // Out of suitable exercises (a long bodyweight leg day): one more set each rather than ending early.
  if (fits(0.88)) fillSets(opts.setsPerExercise ? maxSets : maxSets + 1)
  for (const p of items) p.est = Math.round(liftMinutes(p, BY_ID.get(p.exerciseId), pref) * 10) / 10
  return items
}

/** Supersets: pick exercises, pair them, then choose how many pairs and rounds come closest to the time. */
function pickSupersets(groups: string[], minutes: number, rng: Rng, avoid: Set<string>, opts: LiftOptions = {}): PlannedExercise[] {
  const pref = opts.rest ?? 'normal'
  // Paired work is quicker, so ask for more exercises than straight sets would fit, then choose from them: they come in
  // the order they were picked (each part's main movement first), so the ones that make the cut are the important ones.
  const picked = pickLifts(groups, minutes * 1.8, rng, avoid, { ...SUPERSET, maxSets: 3, sortByRank: false }, { rest: pref, noRepeats: BODY_PARTS.every((p) => groups.includes(p)), familiar: opts.familiar, setCap: opts.setCap && ((g) => opts.setCap!(g) * 1.8), repRange: opts.repRange, maxPerPart: opts.maxPerPart && opts.maxPerPart * 2 }).map((p) => ({ ...p, sets: 3, warmupSets: undefined }))
  // A second variation of a movement (when a long day runs out of new ones) goes after every first one, so it's the
  // first to go when the pairs fill the time.
  const seen = new Set<string>()
  const again = picked.map((p) => { const f = familyOf(BY_ID.get(p.exerciseId)!); const was = !!f && seen.has(f); if (f) seen.add(f); return was })
  const pool = [...picked.filter((_, i) => !again[i]), ...picked.filter((_, i) => again[i])]
  // Partners to fall back on: the chosen parts' usual moves (in the same order straight sets would offer them).
  const chosen = new Set(groups)
  const extras = [...new Set([...queuesFor(groups, rng, avoid, SUPERSET, opts.familiar).values()].flat())].filter((e) => chosen.has(e.group))
  const extra = (e: Exercise): PlannedExercise => { const t = repsIn(opts.repRange, e) ?? targetsFor(e, rng); return { exerciseId: e.id, sets: 3, ...t, rest: restFor(e, t.reps, t.seconds, pref) } }
  // Within the session's sets and exercises per muscle, when capped.
  const withinCap = (list: PlannedExercise[]) => {
    if (!opts.setCap && !opts.maxPerPart) return true
    const sets = new Map<string, number>()
    const count = new Map<string, number>()
    for (const p of list) {
      const g = BY_ID.get(p.exerciseId)?.group ?? ''
      sets.set(g, (sets.get(g) ?? 0) + p.sets)
      count.set(g, (count.get(g) ?? 0) + 1)
    }
    return [...sets].every(([g, n]) => !opts.setCap || n <= opts.setCap(g)) && [...count].every(([, n]) => !opts.maxPerPart || n <= opts.maxPerPart)
  }
  const pairs = entriesOf(makeSupersets(pool, extras, extra, BODY_PARTS.every((p) => groups.includes(p))))
  let best: PlannedExercise[] = []
  let bestScore = Infinity
  for (let k = 1; k <= pairs.length; k++) {
    for (const rounds of [3, 4, 5]) {
      const trial = pairs.slice(0, k).flat().map((p) => ({ ...p, sets: rounds }))
      const t = liftsMinutes(trial, pref)
      const score = t > minutes * 1.08 || !withinCap(trial) ? Infinity : Math.abs(t - minutes)
      if (score < bestScore) { best = trial; bestScore = score }
    }
  }
  if (best.length === 0 && pairs[0]) best = pairs[0].map((p) => ({ ...p, sets: 3 }))
  // Still short: finish with one straight-set exercise from the leftovers.
  if (liftsMinutes(best, pref) < minutes * 0.9) {
    // Not one already in (nor a second of a movement or, when every part is in, a second of a body part).
    const oneEach = BODY_PARTS.every((p) => groups.includes(p))
    const of = (p: PlannedExercise) => BY_ID.get(p.exerciseId)
    const clash = (p: PlannedExercise) => best.some((b) => b.exerciseId === p.exerciseId
      || (oneEach && of(b)?.group === of(p)?.group)
      || (!!of(p) && !!familyOf(of(p)!) && of(b) && familyOf(of(b)!) === familyOf(of(p)!)))
    const leftovers = pool.filter((p) => !clash(p))
    const options = leftovers.flatMap((p) => [3, 2].map((sets) => ({ ...p, sets, block: undefined, blockLabel: undefined })))
    let pick: PlannedExercise | undefined
    for (const extra of options) {
      const t = liftsMinutes([...best, extra], pref)
      if (t <= minutes * 1.08 && withinCap([...best, extra]) && (!pick || Math.abs(t - minutes) < Math.abs(liftsMinutes([...best, pick], pref) - minutes))) pick = extra
    }
    if (pick) best = [...best, pick]
  }
  best = bigLiftsFirst(best)
  if (opts.warmupSets) best = placeWarmups(best, (id) => BY_ID.get(id), 2)
  // Spread each pair's time over its two exercises for the per-item estimate.
  for (let i = 0; i < best.length; ) {
    const a = best[i]
    const b = best[i + 1]
    if (a.block && b?.block === a.block) {
      const m = supersetMinutes(a, b, pref) / 2
      a.est = b.est = Math.round(m * 10) / 10
      i += 2
    } else {
      a.est = Math.round(liftMinutes(a, BY_ID.get(a.exerciseId), pref) * 10) / 10
      i++
    }
  }
  return best
}

/** A workout's supersets (two exercises) and straight sets (one), in order. */
function entriesOf(list: PlannedExercise[]): PlannedExercise[][] {
  const out: PlannedExercise[][] = []
  for (let i = 0; i < list.length; ) {
    const n = list[i].block && list[i + 1]?.block === list[i].block ? 2 : 1
    out.push(list.slice(i, i + n))
    i += n
  }
  return out
}

/** Supersets and straight sets ordered by their biggest lift (bigger one first in each pair), numbered in that order. */
function bigLiftsFirst(list: PlannedExercise[]): PlannedExercise[] {
  const key = (p: PlannedExercise) => { const e = BY_ID.get(p.exerciseId); return e ? orderKey(e) : 99 }
  const entries = entriesOf(list).map((e) => [...e].sort((a, b) => key(a) - key(b)))
  entries.sort((a, b) => key(a[0]) - key(b[0]))
  let n = 0
  return entries.flatMap((e) => {
    if (e.length < 2 || !e[0].block?.startsWith('ss')) return e
    n++
    return e.map((p) => ({ ...p, block: `ss${n}`, blockLabel: p.blockLabel?.replace(/^Superset \d+/, `Superset ${n}`) }))
  })
}

// ---------------------------------------------------------------------------------------------
// Supersets: pair exercises you can do in one spot (see stations.ts), preferring opposing muscle groups.
// ---------------------------------------------------------------------------------------------

const ANTAGONISTS: Record<string, string[]> = {
  Chest: ['Back'], Back: ['Chest', 'Shoulders'], Shoulders: ['Back', 'Quads'], Biceps: ['Triceps', 'Core'], Triceps: ['Biceps', 'Core'],
  Quads: ['Hamstrings', 'Core'], Hamstrings: ['Quads', 'Core'], Glutes: ['Core', 'Biceps'], Calves: ['Core', 'Biceps', 'Triceps'],
  Core: ['Quads', 'Glutes', 'Back'],
}
/** Pairs where the second move needs what the first just tired (triceps after pressing, biceps after rows). */
const COMPETING: Record<string, string[]> = {
  Chest: ['Triceps', 'Shoulders'], Shoulders: ['Triceps', 'Chest'], Triceps: ['Chest', 'Shoulders'],
  Back: ['Biceps'], Biceps: ['Back'], Glutes: ['Hamstrings'], Hamstrings: ['Glutes'],
}

/**
 * How good a superset two exercises make. Staying in one spot matters most (no walking from the rack to the cable
 * stack mid-pair, or holding two stations at a busy gym), then opposing muscles (push + pull, quads + hamstrings), and
 * never the same muscle twice.
 */
export function pairScore(a: Exercise, b: Exercise): number {
  const muscle = a.group === b.group ? -3
    : ANTAGONISTS[a.group]?.includes(b.group) ? 3
    : COMPETING[a.group]?.includes(b.group) ? -1
    : 1
  // A heavy squat or deadlift tires out everything else that's heavy (a squat with a deadlift, a deadlift with a row): it
  // pairs with lighter work. Heavy pushing with heavy pulling (bench press and row) is fine (Robbins et al. 2010).
  const heavy = tooHeavyPair(a, b) ? -4 : 0
  return muscle + heavy - 2.5 * walkCost(a, b)
}

const PLACE: Record<string, string> = {
  cable: 'the cable stack', rack: 'the squat rack', bench: 'your bench', platform: 'your barbell', smith: 'the Smith machine',
  pullup: 'the pull-up bar', dip: 'the dip station', box: 'the box', turf: 'the turf', 'machine:leg-ext-curl': 'the leg extension and curl machines',
}
const placeOf = (s: string) => PLACE[s] ?? (s.startsWith('machine:') ? 'the machine' : '')

/** Where a pair is done, for its label: "stay at the cable stack", "take your dumbbells to one bench". */
function whereLabel(a: Exercise, b: Exercise): string {
  const sa = stationOf(a)
  const sb = stationOf(b)
  const portable = (s: string) => s === 'floor' || s === 'dumbbells' || s === 'kettlebells'
  const fixed = [sa, sb].filter((s) => !portable(s))
  const carried = [sa, sb].find((s) => s === 'dumbbells' || s === 'kettlebells')
  if (fixed.length === 2) return fixed[0] !== fixed[1] || !placeOf(fixed[0]) ? '' : fixed[0] === 'platform' ? 'one barbell for both' : `stay at ${placeOf(fixed[0])}`
  if (fixed.length === 1) {
    const at = placeOf(fixed[0])
    if (!at) return ''
    return carried ? `take your ${carried} to ${at}` : fixed[0] === 'platform' ? 'stay by your barbell' : `stay at ${at}`
  }
  if (carried && (sa === sb || sa === 'floor' || sb === 'floor')) return `just your ${carried}, no walking`
  return sa === 'floor' && sb === 'floor' ? 'no equipment needed' : ''
}

/**
 * Pair the picked exercises, biggest lifts first, each with the best partner by `pairScore`. When nothing picked makes a
 * good partner (a back squat with only cable moves left), a partner comes from `extras` instead: another move for one
 * of the chosen body parts that can be done in the same spot, favouring the parts with the fewest exercises so far.
 */
function makeSupersets(items: PlannedExercise[], extras: Exercise[] = [], extra: (e: Exercise) => PlannedExercise = (e) => ({ exerciseId: e.id, sets: 3 }), oneEach = false): PlannedExercise[] {
  const wontPair = (a: Exercise, b: Exercise) => walkCost(a, b) >= 3 || tooHeavyPair(a, b)
  const ex = (p: PlannedExercise) => BY_ID.get(p.exerciseId)!
  const left = items.filter((p) => BY_ID.has(p.exerciseId))
  const used = new Set(left.map((p) => p.exerciseId))
  const again = new Set(left.filter((p, i) => { const f = familyOf(ex(p)); return !!f && left.slice(0, i).some((q) => familyOf(ex(q)) === f) }).map((p) => p.exerciseId))
  const perGroup = new Map<string, number>()
  const count = (e: Exercise) => perGroup.set(e.group, (perGroup.get(e.group) ?? 0) + 1)
  const out: PlannedExercise[] = []
  let n = 0
  while (left.length) {
    const a = left.shift()!
    const ea = ex(a)
    let best = -1
    let bestScore = -Infinity
    // A second variation of a movement (picked when a long day ran out of new ones) only when nothing else pairs, and a
    // partner across the gym or too heavy to pair only when there's no other (it's swapped or left as straight sets).
    const consider = (ok: (p: PlannedExercise) => boolean) =>
      left.forEach((p, i) => { const sc = pairScore(ea, ex(p)) - (again.has(p.exerciseId) ? 4 : 0); if (ok(p) && sc > bestScore) { bestScore = sc; best = i } })
    consider((p) => !wontPair(ea, ex(p)))
    if (best < 0) consider(() => true)
    // Something unpicked that suits this spot clearly better (no walking), keeping body parts balanced.
    let alt: Exercise | undefined
    let altFor: PlannedExercise | undefined
    let altScore = bestScore + 2
    const families = new Set([...out, a, ...left].map((p) => familyOf(ex(p))).filter(Boolean))
    for (const e of extras) {
      if (used.has(e.id) || (familyOf(e) && families.has(familyOf(e))) || unwanted(e)) continue
      // It takes the place of an unpaired move for the same part (the last one picked), or (unless it's one per part)
      // joins as an extra; never in place of the part's main lift for a smaller one (the row stays, not a back extension
      // that shares the bench).
      const replaced = left.filter((p) => ex(p).group === e.group && !(isMainMove(ex(p)) && !isMainMove(e))).at(-1)
      if (oneEach && !replaced) continue
      const sc = pairScore(ea, e) - 0.75 * (perGroup.get(e.group) ?? 0) + (replaced ? 0.5 : 0)
      if (sc > altScore && walkCost(ea, e) === 0 && !tooHeavyPair(ea, e)) { alt = e; altFor = replaced; altScore = sc }
    }
    let b: PlannedExercise | undefined
    if (alt) {
      if (altFor) left.splice(left.indexOf(altFor), 1)
      b = extra(alt)
      used.add(alt.id)
    } else if (best >= 0) {
      b = left.splice(best, 1)[0]
      if (wontPair(ea, ex(b))) {
        // Its partner is across the gym or too heavy: the same movement somewhere closer or lighter instead (a dumbbell
        // RDL rather than the Smith machine one, a calf raise on the leg press), or straight sets when there's none.
        const eb = ex(b)
        const near = extras.find((e) => !used.has(e.id) && e.group === eb.group && !!familyOf(e) && familyOf(e) === familyOf(eb) && !wontPair(ea, e) && !unwanted(e))
        if (near) { b = extra(near); used.add(near.id) } else { left.splice(best, 0, b); b = undefined }
      }
    }
    count(ea)
    if (!b) {
      // Nothing to pair it with without crossing the gym (or the odd one out): straight sets.
      out.push(a)
      continue
    }
    count(ex(b))
    n++
    const where = whereLabel(ea, ex(b))
    const blockLabel = `Superset ${n} · alternate the two, rest about 60s after each pair${where ? ` · ${where}` : ''}`
    out.push({ ...a, block: `ss${n}`, blockLabel }, { ...b, block: `ss${n}`, blockLabel })
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Circuit-style: HIIT and peripheral heart action.
// ---------------------------------------------------------------------------------------------

const UPPER = new Set(UPPER_PARTS)

/**
 * Up to `count` exercises taking turns between the groups. Circuits stay in one area of the gym: portable gear and
 * floor moves, plus at most `maxFixed` fixed stations (a bench, the cable stack…), unless that leaves the circuit short.
 */
function roundRobinPick(groups: string[], count: number, poolFor: (g: string) => Exercise[], avoid: Set<string>, rng: Rng, maxFixed = 1, already: Exercise[] = []) {
  const order = shuffle(groups, rng)
  const run = (stay: boolean) => {
    const queues = new Map(order.map((g) => [g, byPreference(softShuffle(poolFor(g), avoid, rng), rng, () => 0, avoid)] as const))
    const picked: Exercise[] = []
    const taken = new Set<string>()
    // A different movement at each station (not two deadlifts or two pull-ups); a second of a smaller movement only if
    // the circuit would otherwise come up short, never a second squat or deadlift.
    const fill = (repeats: boolean) => {
      while (picked.length < count) {
        let progressed = false
        for (const g of order) {
          if (picked.length >= count) break
          const q = queues.get(g)!
          const fams = new Set([...already, ...picked].map(familyOf).filter(Boolean))
          const ok = (e: Exercise) => !taken.has(e.id) && (!stay || staysPut([...already, ...picked], e, maxFixed))
          let i = q.findIndex((e) => ok(e) && !(familyOf(e) && fams.has(familyOf(e))))
          if (i < 0 && repeats) i = q.findIndex((e) => ok(e) && !ONE_ONLY.has(familyOf(e) ?? ''))
          if (i < 0) continue
          const [next] = q.splice(i, 1)
          picked.push(next)
          taken.add(next.id)
          progressed = true
        }
        if (!progressed) break
      }
    }
    fill(false)
    fill(true)
    return picked
  }
  const near = run(true)
  return near.length >= Math.min(count, 4) ? near : run(false)
}

/** Reorder so consecutive exercises hit different muscle groups where possible. */
function spreadGroups(exs: Exercise[]): Exercise[] {
  const left = [...exs]
  const out: Exercise[] = []
  while (left.length) {
    const last = out.at(-1)
    const i = left.findIndex((e) => !last || e.group !== last.group)
    out.push(...left.splice(i < 0 ? 0 : i, 1))
  }
  return out
}

function generateCircuit(groups: string[], minutes: number, rng: Rng, avoid: Set<string>): PlannedExercise[] {
  const WORK = 40
  const REST = 20
  const ROUND_REST = 1
  const hiitOk = (e: Exercise) =>
    e.kind === 'strength' &&
    (e.tags?.includes('hiit') || ((e.suggest || e.custom) && ['Bodyweight', 'Kettlebell', 'Dumbbell'].includes(e.equipment ?? '') && !isIsolation(e) && !isTechnical(e) && !isQuirky(e) && !tooAdvanced(e)))
  const poolFor = (g: string) => [...EXERCISES, ...customPool()].filter((e) => e.group === g && hiitOk(e) && hasGear(e))
  const withConditioning = [...new Set([...groups, 'Conditioning'])]

  let n = minutes <= 20 ? 5 : minutes <= 35 ? 6 : minutes <= 50 ? 7 : 8
  const roundMin = (k: number) => (k * (WORK + REST)) / 60 + ROUND_REST
  while (n > 4 && roundMin(n) * 2 > minutes) n--
  const picked = spreadGroups(roundRobinPick(withConditioning, n, poolFor, avoid, rng))
  if (picked.length === 0) return []
  // A cardio machine station (bike, rower, SkiErg…) in the middle: always when they've said what they like.
  const machines = wodCardio().filter((e) => !avoid.has(e.id))
  if (machines.length && picked.length >= 4 && (likedCardio() || rng() < 0.5)) {
    picked.pop()
    picked.splice(Math.floor(picked.length / 2), 0, pick(machines, rng))
  }
  n = picked.length
  const rounds = Math.max(2, Math.min(minutes >= 75 ? 10 : 6, Math.floor(minutes / roundMin(n))))
  const blockLabel = `HIIT circuit · ${rounds} rounds · ${WORK}s on / ${REST}s off · ${ROUND_REST} min rest between rounds`
  return picked.map((e) => ({
    exerciseId: e.id, sets: rounds, note: `${WORK}s on / ${REST}s off`, est: (rounds * roundMin(n)) / n, block: 'circuit', blockLabel,
  }))
}

function generatePha(groups: string[], minutes: number, rng: Rng, avoid: Set<string>): PlannedExercise[] {
  const ROUND_REST = 1.5
  const roundMin = (k: number) => k * 1 + ROUND_REST
  let n = minutes <= 25 ? 4 : minutes <= 40 ? 5 : minutes <= 55 ? 6 : 7
  while (n > 4 && roundMin(n) * 2 > minutes) n--
  // Quick, low-skill stations: not barbell lifts, and compound moves where the group has any.
  const poolFor = (g: string) => {
    const base = [...POOL, ...customPool()].filter((e) => e.kind === 'strength' && e.group === g && equipmentRank(e) >= 1 && !tooAdvanced(e) && !isTechnical(e) && !isQuirky(e) && hasGear(e))
    // (Three different movements: hip thrusts and glute bridges are one.)
    const compound = base.filter((e) => !isIsolation(e))
    return new Set(compound.map(familyOf)).size >= 3 ? compound : base
  }

  // Half the stations upper body, half lower; Core counts as lower. Falls back to whatever was chosen.
  const upperGroups = groups.filter((g) => UPPER.has(g))
  const lowerGroups = groups.filter((g) => !UPPER.has(g))
  let picked: Exercise[]
  if (upperGroups.length && lowerGroups.length) {
    const up = roundRobinPick(upperGroups, Math.ceil(n / 2), poolFor, avoid, rng)
    const low = roundRobinPick(lowerGroups, Math.floor(n / 2), poolFor, avoid, rng, 1, up)
    // With an odd count the longer half goes first, or the circuit would end with two of a kind back to back.
    const first = up.length !== low.length ? (up.length > low.length ? up : low) : rng() < 0.5 ? up : low
    const second = first === up ? low : up
    picked = []
    for (let i = 0; picked.length < up.length + low.length; i++) {
      if (first[i]) picked.push(first[i])
      if (second[i]) picked.push(second[i])
    }
  } else {
    picked = spreadGroups(roundRobinPick(groups, n, poolFor, avoid, rng))
  }
  if (picked.length === 0) return []

  const k = picked.length
  const rounds = Math.max(2, Math.min(minutes >= 75 ? 10 : 6, Math.floor(minutes / roundMin(k))))
  const blockLabel = `PHA circuit · ${rounds} rounds · station to station with no rest, ${ROUND_REST * 60}s between rounds`
  return picked.map((e) => ({
    exerciseId: e.id, sets: rounds, ...(e.mode === 'time' ? { seconds: 40 } : { reps: pick([12, 15], rng) }),
    note: 'no rest', est: (rounds * roundMin(k)) / k, block: 'pha', blockLabel,
  }))
}

// ---------------------------------------------------------------------------------------------

export interface GenerateOptions {
  style?: WorkoutStyle
  /** Several styles in one workout, e.g. Strength then HIIT circuit. Cardio (a focus option) always comes last. */
  styles?: WorkoutStyle[]
  /** Minutes for each style in a mixed workout. Missing styles share what's left. */
  minutesByStyle?: Partial<Record<WorkoutStyle, number>>
  /** Minutes of cardio at the end (when Cardio is a focus). Defaults to about a quarter of the time. */
  cardioMinutes?: number
  rng?: Rng
  /** Exercises to use only if nothing else fits (e.g. what was in the previous workout). */
  avoid?: Set<string>
  /** How long you rest between sets. */
  rest?: RestPref
  /** Warm-up before the workout; its minutes are part of `minutes`. */
  warmup?: WarmupOptions
  /** Finish the last two weight lifts with drop sets (their time is part of `minutes`). */
  dropSets?: boolean
  /** Lifts the person has been logging, picked first so progress carries over. */
  familiar?: Set<string>
  /** The cardio activity and session type (steady, intervals, tempo, hills, time trial). */
  cardio?: CardioSpec
  /** Already warmed up (a warm-up was added, or this is a later part of a mixed workout): no warm-up of its own. */
  warmed?: boolean
  /** Most hard sets per muscle in the session (see LiftOptions). */
  setCap?: (part: string) => number
  /** Reps for weighted lifts: [big compound lifts, everything else]. */
  repRange?: [number, number]
  /** Most different exercises for one muscle (see LiftOptions). */
  maxPerPart?: number
  /** Sets each exercise starts with and grows to (see LiftOptions). */
  setsPerExercise?: [number, number]
}

/**
 * Build a workout for the chosen focus areas and style that fits roughly `minutes`.
 * Cardio takes ~25% of the time when mixed with lifting, all of it when alone.
 * Hyrox- and CrossFit-style workouts are full-body formats and ignore the body-part focus.
 */
/** Heavy lifting first, then conditioning, then whole-workout formats. */
const STYLE_ORDER: WorkoutStyle[] = ['strength', 'standard', 'bodyweight', 'supersets', 'pha', 'circuit', 'amrap', 'emom', 'tabata', 'fortime', 'crossfit', 'hyrox']

/** Several styles back to back, splitting the time between them, with any cardio at the end. */
function generateMixed(focus: string[], minutes: number, styles: WorkoutStyle[], rng: Rng, avoid: Set<string>, byStyle: Partial<Record<WorkoutStyle, number>> = {}, cardioMinutes?: number, lift: LiftOptions = {}): PlannedExercise[] {
  const cardio = focus.includes('Cardio')
  const body = focus.filter((g) => g !== 'Cardio')
  const cardioMin = cardio ? (cardioMinutes ?? Math.min(30, Math.max(10, roundTo5(minutes * 0.25)))) : 0
  const fixed = styles.reduce((a, s) => a + (byStyle[s] ?? 0), 0)
  const open = styles.filter((s) => byStyle[s] == null).length
  const share = open ? Math.max(10, roundTo5((minutes - cardioMin - fixed) / open)) : 0
  const used = new Set<string>()
  const out: PlannedExercise[] = []
  for (const style of styles) {
    // Warm-up sets only before the first lifting part; later parts are already warm.
    const part = generateWorkout(body, byStyle[style] ?? share, { style, rng, avoid: new Set([...avoid, ...used]), rest: lift.rest, warmup: { sets: !!lift.warmupSets && out.length === 0 }, familiar: lift.familiar, warmed: out.length > 0 })
    for (const p of part) {
      if (used.has(p.exerciseId)) continue // one entry per exercise across the whole workout
      used.add(p.exerciseId)
      out.push(p.block ? { ...p, block: `${style}-${p.block}` } : p)
    }
  }
  return cardio ? [...out, ...pickCardio(cardioMin, rng, new Set([...avoid, ...used]), lift.cardio).filter((p) => !used.has(p.exerciseId))] : out
}

/**
 * Warm-ups that conditioning formats bring with them when none was picked (minutes of easy cardio and mobility),
 * for sessions of at least `from` minutes.
 */
const OWN_WARMUP: Partial<Record<WorkoutStyle, { cardio: number; mobility: number; from: number }>> = {
  hyrox: { cardio: 4, mobility: 4, from: 30 },
  crossfit: { cardio: 4, mobility: 4, from: 30 },
  ...Object.fromEntries((['amrap', 'emom', 'fortime', 'tabata', 'circuit', 'pha'] as const).map((st) => [st, { cardio: 3, mobility: 2, from: 20 }])),
}
/** Whether a style adds its own short warm-up when none is picked. */
export const bringsOwnWarmup = (style: WorkoutStyle) => !!OWN_WARMUP[style]

export function generateWorkout(focusIn: string[], minutes: number, opts: GenerateOptions = {}): PlannedExercise[] {
  // Older saved choices (and some plans) say Legs or Arms: those mean every part of them.
  const focus = expandParts(focusIn)
  if (opts.dropSets) {
    // Two drops on two lifts take about 2.5 minutes; leave room for them in the time asked for.
    const lifting = (opts.styles ?? [opts.style ?? 'standard']).some((st) => ['standard', 'strength', 'supersets'].includes(st))
    const base = generateWorkout(focus, lifting ? minutes - 2.5 : minutes, { ...opts, dropSets: false })
    return lifting ? addDropSets(base, (id) => BY_ID.get(id)) : base
  }
  const w = opts.warmup ?? {}
  const warmMin = (w.cardio ?? 0) + (w.mobility ?? 0)
  if (warmMin > 0) {
    const rng = opts.rng ?? Math.random
    const main = generateWorkout(focus, Math.max(5, minutes - warmMin), { ...opts, rng, warmup: { sets: w.sets }, warmed: true })
    const warm = generateWarmup(focus, w, rng, new Set(main.map((p) => p.exerciseId)))
    return [...warm, ...main.filter((p) => !warm.some((x) => x.exerciseId === p.exerciseId))]
  }
  const { style = 'standard', rng = Math.random, avoid = new Set<string>() } = opts
  const lift: LiftOptions = { rest: opts.rest, warmupSets: w.sets, familiar: opts.familiar, cardio: opts.cardio, setCap: opts.setCap, repRange: opts.repRange, maxPerPart: opts.maxPerPart, setsPerExercise: opts.setsPerExercise }
  const custom = opts.cardioMinutes != null || (opts.minutesByStyle && Object.keys(opts.minutesByStyle).length > 0)
  if (opts.styles && (new Set(opts.styles).size > 1 || custom)) {
    const list = [...new Set(opts.styles)].sort((a, b) => STYLE_ORDER.indexOf(a) - STYLE_ORDER.indexOf(b))
    return generateMixed(focus, minutes, list, rng, avoid, opts.minutesByStyle, opts.cardioMinutes, lift)
  }
  if (opts.styles?.length === 1) return generateWorkout(focus, minutes, { style: opts.styles[0], rng, avoid, rest: opts.rest, warmup: { sets: w.sets }, familiar: opts.familiar, cardio: opts.cardio, warmed: opts.warmed, setCap: opts.setCap, repRange: opts.repRange, maxPerPart: opts.maxPerPart, setsPerExercise: opts.setsPerExercise })
  // Cardio and no body parts with a conditioning style: that's a hard cardio session (intervals, or a time trial for
  // "for time"), not a bodyweight circuit with one cardio station.
  const cardioOnly = focus.includes('Cardio') && focus.every((g) => g === 'Cardio')
  if (cardioOnly && ['amrap', 'emom', 'tabata', 'circuit', 'pha', 'fortime'].includes(style)) {
    return pickCardio(minutes, rng, avoid, { exerciseId: opts.cardio?.exerciseId, kind: opts.cardio?.kind ?? (style === 'fortime' ? 'trial' : 'intervals') })
  }
  // Like a class, hard conditioning starts with its own general warm-up (easy cardio, then mobility) unless the person
  // already asked for one or this comes after another part of the workout: going all-out cold is how people get hurt.
  const own = opts.warmed ? undefined : OWN_WARMUP[style]
  if (own && minutes >= own.from) {
    const mins = own.cardio + own.mobility
    const main = generateWorkout(focus, minutes - mins, { ...opts, rng, warmup: { sets: w.sets }, warmed: true })
    const ids = new Set(main.map((p) => p.exerciseId))
    const body = focus.filter((g) => g !== 'Cardio')
    // Never the same exercise twice in a day: if the warm-up picked the WOD's machine, it warms up without it.
    const warm = generateWarmup(body.length ? body : FULL_BODY_GROUPS, own, rng, ids).filter((p) => !ids.has(p.exerciseId))
    return [...warm, ...main]
  }
  if (style === 'hyrox' || style === 'crossfit') return style === 'hyrox' ? generateHyrox(minutes, rng) : generateCrossfit(minutes, rng, avoid)
  if (style === 'amrap' || style === 'emom' || style === 'fortime' || style === 'tabata') return generateTimed(style, focus.filter((g) => g !== 'Cardio'), minutes, rng, avoid, focus.includes('Cardio'))

  let groups = focus.filter((g) => g !== 'Cardio')
  const cardio = focus.includes('Cardio')
  if (groups.length === 0 && !cardio && (style === 'circuit' || style === 'pha')) groups = FULL_BODY_GROUPS
  if (groups.length === 0) return cardio ? pickCardio(minutes, rng, avoid, opts.cardio) : []

  const cardioMin = cardio ? Math.min(30, Math.max(10, roundTo5(minutes * 0.25))) : 0
  const liftMin = minutes - cardioMin
  let items: PlannedExercise[]
  switch (style) {
    case 'strength': items = pickLifts(groups, liftMin, rng, avoid, STRENGTH, lift); break
    case 'bodyweight': items = pickLifts(groups, liftMin, rng, avoid, BODYWEIGHT, lift); break
    case 'supersets': items = pickSupersets(groups, liftMin, rng, avoid, lift); break
    case 'circuit': items = generateCircuit(groups, liftMin, rng, avoid); break
    case 'pha': items = generatePha(groups, liftMin, rng, avoid); break
    default: items = pickLifts(groups, liftMin, rng, avoid, STANDARD, lift)
  }
  return cardio ? [...items, ...pickCardio(cardioMin, rng, avoid, opts.cardio)] : items
}

/** Easy cardio for whatever's left when a session comes up 10+ minutes short (marked as a finisher). */
export function addFinisher(items: PlannedExercise[], minutes: number, rng: Rng = Math.random): PlannedExercise[] {
  const spare = minutes - minutesFor(items)
  if (spare < 10) return items
  const used = new Set(items.map((p) => p.exerciseId))
  const finisher = generateWorkout(['Cardio'], roundTo5(spare - 2), { style: 'standard', rng, avoid: used, cardio: { kind: 'steady' } })
  return [...items, ...finisher.filter((p) => !used.has(p.exerciseId)).map((p) => ({ ...p, note: FINISHER }))]
}
export const FINISHER = 'Finisher, easy pace'

/** Ways to use a session's time when filling it would give one muscle too much (see muscles.ts `overloaded`). */
export type ExtraTime = 'heavier' | 'finisher' | 'part' | 'shorter'
export interface ExtraTimeOption {
  id: ExtraTime
  items: PlannedExercise[]
  /** For 'part': the body part added. */
  part?: string
}
/** A related part to add when one muscle has too much: chest → triceps, back → biceps… */
const ADD_PART: Record<string, string[]> = {
  Chest: ['Triceps', 'Shoulders'], Back: ['Biceps', 'Shoulders'], Shoulders: ['Triceps', 'Chest'], Biceps: ['Triceps', 'Back'], Triceps: ['Biceps', 'Chest'],
  Quads: ['Hamstrings', 'Glutes'], Hamstrings: ['Glutes', 'Quads'], Glutes: ['Hamstrings', 'Quads'], Calves: ['Quads', 'Hamstrings'], Core: ['Glutes', 'Quads'],
}

/**
 * The same workout, using the time another way than more and more exercises for `over` (the muscles past their limit):
 * heavier (fewer exercises, 4-5 sets each, 5-8 reps, longer rests), a cardio finisher, a related body part, or simply
 * shorter. Each keeps at most `maxPer` exercises per muscle (and, except heavier, about 15 hard sets: see sessionSets).
 */
export function extraTimeOptions(focus: string[], minutes: number, opts: GenerateOptions, maxPer: number, over: string[]): ExtraTimeOption[] {
  const rng = opts.rng ?? Math.random
  const capped: GenerateOptions = { ...opts, rng, maxPerPart: maxPer, setCap: sessionSets }
  const out: ExtraTimeOption[] = [{ id: 'heavier', items: generateWorkout(focus, minutes, { ...opts, rng, maxPerPart: maxPer, setsPerExercise: [4, 5], repRange: [5, 8] }) }]
  const short = generateWorkout(focus, minutes, capped)
  // A workout with its own cardio part doesn't need a finisher too.
  if (!focus.includes('Cardio')) out.push({ id: 'finisher', items: addFinisher(short, minutes, rng) })
  const part = over.flatMap((g) => ADD_PART[g] ?? []).find((g) => !focus.includes(g))
  if (part) out.push({ id: 'part', part, items: generateWorkout([...focus, part], minutes, capped) })
  out.push({ id: 'shorter', items: short })
  return out
}

/** Swap one item for a different random exercise from the same group or style (keeps sets/minutes/block). */
export function swapExercise(items: PlannedExercise[], index: number, rng: Rng = Math.random): PlannedExercise[] {
  const cur = BY_ID.get(items[index].exerciseId)
  if (!cur) return items
  const used = new Set(items.map((p) => p.exerciseId))
  // A cardio station inside a timed piece or circuit swaps for another machine, with its own amount.
  const prev = items[index]
  if (cur.kind === 'cardio' && prev.block && !prev.warmup) {
    const machines = wodCardio().filter((e) => !used.has(e.id))
    if (machines.length === 0) return items
    const e = machines[Math.floor(rng() * machines.length)]
    const next: PlannedExercise = { ...prev, exerciseId: e.id, ...(prev.wod ? { note: wodAmount(e.id, prev.wod.kind === 'fortime' ? 1.25 : 1) } : {}) }
    return items.map((p, i) => (i === index ? next : p))
  }
  const groups = [...new Set(items.map((p) => BY_ID.get(p.exerciseId)?.group).filter((g): g is string => !!g))]
  const options = [...EXERCISES, ...customPool()].filter(
    (e) =>
      e.kind === cur.kind &&
      e.group === cur.group &&
      !used.has(e.id) &&
      hasGear(e) &&
      (e.suggest || e.custom || (cur.tags && e.tags?.some((t) => cur.tags!.includes(t)))) &&
      (familyOf(e) !== 'hinge' || familyOf(cur) === 'hinge' || hingeFits(groups)),
  )
  // A movement the rest of the workout doesn't already have (no second deadlift when swapping the leg curl).
  const others = new Set(items.filter((_, i) => i !== index).map((p) => BY_ID.get(p.exerciseId)).map((e) => e && familyOf(e)).filter(Boolean))
  const fresh = options.filter((e) => !familyOf(e) || !others.has(familyOf(e)))
  const from = fresh.length ? fresh : options
  if (from.length === 0) return items
  return replaceExercise(items, index, from[Math.floor(rng() * from.length)], rng)
}

/** Put a specific exercise in slot `index`, keeping its position, sets, minutes, and block. */
export function replaceExercise(items: PlannedExercise[], index: number, ex: Exercise, rng: Rng = Math.random): PlannedExercise[] {
  return items.map((p, i) => (i === index ? plannedFor(ex, p, rng) : p))
}
