import { EXERCISES } from '../data/exercises'
import type { Exercise, PlannedExercise } from '../types'
import { generateCrossfit, generateHyrox, generateTimed } from './functionalStyles'
import { liftMinutes, REST_SCALE, restFor, transitionMin, WARMUP_SET_MIN, workSeconds, type RestPref } from './timing'
import { BY_ID, FULL_BODY_GROUPS, isAdvanced, isIsolation, isMainLift, isTechnical, POOL, pick, roundTo5, shuffle, softShuffle, type Rng } from './randomUtil'

export const FOCUS_OPTIONS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core', 'Cardio'] as const
export const LIFT_GROUPS = FOCUS_OPTIONS.filter((g) => g !== 'Cardio')

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

/** Rep target by exercise style: heavy barbell work low, accessories higher. */
export function repsFor(e: Exercise, rng: Rng = Math.random): number {
  if (e.group === 'Core') return 15
  if (e.mode === 'reps') return [10, 12, 15][Math.floor(rng() * 3)]
  const r = equipmentRank(e)
  if (r === 0) return rng() < 0.5 ? 6 : 8
  if (r <= 2) return rng() < 0.5 ? 10 : 12
  return 12
}

/** Reps for weights and bodyweight moves, a hold time in seconds for timed ones. */
export function targetsFor(e: Exercise, rng: Rng = Math.random): Pick<PlannedExercise, 'reps' | 'seconds'> {
  return e.mode === 'time' ? { seconds: [30, 45, 60][Math.floor(rng() * 3)] } : { reps: repsFor(e, rng) }
}

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

/** Warm-up minutes for a session when there's no per-part control (week/month plans). */
export function defaultWarmup(warm: ('cardio' | 'mobility' | 'sets')[], lifting: boolean): WarmupOptions {
  const both = warm.includes('cardio') && warm.includes('mobility')
  return {
    ...(warm.includes('cardio') ? { cardio: 5 } : {}),
    ...(warm.includes('mobility') ? { mobility: both ? 4 : 5 } : {}),
    sets: warm.includes('sets') && lifting,
  }
}

const WARMUP_CARDIO = ['Bicycling_Stationary', 'Rowing_Stationary', 'Elliptical_Trainer', 'Rope_Jumping', 'Walking_Treadmill']
const MOVE_SECONDS = 30
const MOVE_SWITCH = 10

/** Mobility moves suited to what's being trained: upper-body focus warms shoulders and chest, lower warms hips and legs. */
function mobilityPool(focus: string[]): Exercise[] {
  const all = EXERCISES.filter((e) => e.tags?.includes('mobility'))
  const upper = focus.some((g) => ['Chest', 'Back', 'Shoulders', 'Arms'].includes(g))
  const lower = focus.some((g) => ['Legs', 'Glutes', 'Core'].includes(g)) || focus.includes('Cardio')
  const want = (e: Exercise) => e.tags!.includes('full') || (upper && e.tags!.includes('upper')) || (lower && e.tags!.includes('lower')) || (!upper && !lower)
  return all.filter(want)
}

export function generateWarmup(focus: string[], w: WarmupOptions, rng: Rng, avoid: Set<string>): PlannedExercise[] {
  const out: PlannedExercise[] = []
  const base = { block: 'warmup', blockLabel: 'Warm-up', warmup: true } as const
  if (w.cardio && w.cardio > 0) {
    const id = WARMUP_CARDIO.find((c) => !avoid.has(c) && BY_ID.has(c)) ?? WARMUP_CARDIO[0]
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

function pickCardio(minutes: number, rng: Rng, avoid: Set<string> = new Set()): PlannedExercise[] {
  const pool = softShuffle(POOL.filter((e) => e.kind === 'cardio'), avoid, rng)
  if (pool.length === 0) return []
  if (minutes <= 45) return [{ exerciseId: pool[0].id, sets: 1, minutes: roundTo5(minutes) }]
  const half = roundTo5(minutes / 2)
  return pool.slice(0, 2).map((e, i) => ({ exerciseId: e.id, sets: 1, minutes: i === 0 ? half : roundTo5(minutes - half) }))
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
  /** When a group has nothing that passes `filter`: use anything (true) or borrow another group (map). */
  fallback: 'any' | Record<string, string>
  targets: (e: Exercise, rng: Rng) => Pick<PlannedExercise, 'reps' | 'seconds'>
  sortByRank: boolean
  /** Strength: start with one heavy main lift per chosen muscle group (up to 3), then accessories. */
  mains?: boolean
  /** Targets for those main lifts (the rest use `targets`). */
  mainTargets?: (e: Exercise, rng: Rng) => Pick<PlannedExercise, 'reps' | 'seconds'>
}

export interface LiftOptions {
  rest?: RestPref
  /** Add ramp-up warm-up sets before the heavy lifts. */
  warmupSets?: boolean
}

const STANDARD: LiftConfig = {
  sets: 3, maxSets: MAX_SETS, filter: () => true, fallback: 'any', targets: targetsFor, sortByRank: true,
}

const isHeavyLift = (e: Exercise) => e.mode === 'weight' && equipmentRank(e) <= 1 && isMainLift(e)

const STRENGTH: LiftConfig = {
  sets: 3, maxSets: 5,
  // Compound work only (arms fall back to anything, since arm moves are isolation by nature).
  filter: (e) => e.mode !== 'time' && e.group !== 'Core' && !isIsolation(e) && !isAdvanced(e),
  fallback: 'any',
  // Main lifts heavy (3-6 reps); accessories after them in the 6-10 range.
  mainTargets: (e, rng) => ({ reps: equipmentRank(e) === 0 ? pick([3, 5], rng) : pick([5, 6], rng) }),
  targets: (e, rng) => (e.mode === 'weight' ? { reps: pick([6, 8, 10], rng) } : targetsFor(e, rng)),
  sortByRank: true,
  mains: true,
}

const BODYWEIGHT: LiftConfig = {
  sets: 3, maxSets: 4,
  filter: (e) => e.equipment === 'Bodyweight' && e.mode !== 'weight' && !isAdvanced(e),
  fallback: { Shoulders: 'Chest', Arms: 'Chest', Glutes: 'Legs' },
  targets: (e, rng) =>
    e.mode === 'time'
      ? { seconds: pick([30, 45, 60], rng) }
      : { reps: pick(/pull-?up|chin-?up|dip|inverted|australian/i.test(e.name) ? [6, 8, 10] : e.group === 'Core' ? [15, 20] : [12, 15, 20], rng) },
  sortByRank: false,
}

const SUPERSET: LiftConfig = { ...STANDARD }

/** Muscle groups to borrow from once a group runs out of suitable exercises (long workouts, small pools). */
const RELATED: Record<string, string[]> = {
  Legs: ['Glutes', 'Core'], Glutes: ['Legs', 'Core'], Chest: ['Shoulders', 'Arms'], Back: ['Arms', 'Shoulders'],
  Shoulders: ['Chest', 'Back'], Arms: ['Chest', 'Back'], Core: ['Glutes', 'Legs'],
}

/** Candidate exercises per group, in the order they'll be offered: the group's own first, then related groups. */
function queuesFor(groups: string[], rng: Rng, avoid: Set<string>, cfg: LiftConfig) {
  // Olympic lifts stay out of random straight-set workouts (CrossFit-style keeps its own list).
  const strengthPool = (g: string) => POOL.filter((e) => e.kind === 'strength' && e.group === g && !isTechnical(e))
  const own = (g: string) => {
    let pool = strengthPool(g).filter(cfg.filter)
    if (pool.length === 0) {
      if (cfg.fallback === 'any') pool = strengthPool(g)
      else if (cfg.fallback[g]) pool = strengthPool(cfg.fallback[g]).filter(cfg.filter)
    }
    return softShuffle(pool, avoid, rng)
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

function pickLifts(groups: string[], minutes: number, rng: Rng, avoid: Set<string>, cfg: LiftConfig, opts: LiftOptions = {}): PlannedExercise[] {
  if (groups.length === 0 || minutes < 5) return []
  const pref = opts.rest ?? 'normal'
  const order = shuffle(groups, rng)
  const queues = queuesFor(order, rng, avoid, cfg)
  const taken = new Set<string>()
  const items: PlannedExercise[] = []
  const cost = () => liftsMinutes(items, pref)
  const make = (e: Exercise, sets: number, main = false): PlannedExercise => {
    const t = (main && cfg.mainTargets ? cfg.mainTargets : cfg.targets)(e, rng)
    return { exerciseId: e.id, sets, ...t, rest: restFor(e, t.reps, t.seconds, pref) }
  }
  const nextFrom = (g: string, want?: (e: Exercise) => boolean) => {
    const q = queues.get(g)!
    const i = q.findIndex((e) => !taken.has(e.id) && (!want || want(e)))
    return i < 0 ? undefined : q.splice(i, 1)[0]
  }
  const fits = (limit: number) => cost() <= minutes * limit
  const tryAdd = (e: Exercise | undefined, sets: number, limit: number, main = false) => {
    if (!e) return false
    items.push(make(e, sets, main))
    if (!fits(limit)) { items.pop(); return false }
    taken.add(e.id)
    return true
  }

  // Strength: a heavy main lift for each chosen group first (up to three), trimmed if they'd crowd out everything else.
  let mains = 0
  if (cfg.mains) {
    // Prefer a barbell lift for the heavy work; dumbbells if the group has none.
    for (const g of order.slice(0, 3)) if (tryAdd(nextFrom(g, (e) => isHeavyLift(e) && equipmentRank(e) === 0) ?? nextFrom(g, isHeavyLift), cfg.sets + 1, 0.8, true)) mains++
  }
  // Warm-up sets before the heavy lifts: more before the first one, fewer after (you're already warm).
  const warmups = () => {
    if (!opts.warmupSets) return
    let n = 0
    for (const p of items) {
      const e = BY_ID.get(p.exerciseId)
      if (!e || !(isHeavyLift(e) || (e.mode === 'weight' && equipmentRank(e) === 0))) continue
      p.warmupSets = n === 0 ? (cfg.mains ? 3 : 2) : n === 1 ? 2 : 1
      if (++n === 3) break
    }
  }
  warmups()
  // Strength is about the main lifts: give them up to 5 sets before accessories, within about 60% of the time.
  if (mains) {
    for (let round = 0; round < 2; round++) {
      for (const p of items.slice(0, mains)) {
        if (p.sets >= cfg.maxSets) continue
        p.sets++
        if (!fits(0.6)) p.sets--
      }
    }
  }

  // Then round-robin through the groups adding exercises while they fit.
  const CAP = minutes >= 75 ? 12 : 10
  for (let pass = 0; items.length < CAP; pass++) {
    let added = false
    for (const g of order) {
      if (items.length >= CAP) break
      const accessorySets = cfg.mains ? 3 : cfg.sets
      if (tryAdd(nextFrom(g), accessorySets, 1.02)) added = true
    }
    if (!added || pass > 12) break
  }
  if (items.length === 0) {
    // Not even one exercise at the usual sets: take the first candidate with fewer sets.
    const e = order.map((g) => nextFrom(g)).find(Boolean)
    if (e) { items.push(make(e, MIN_SETS)); taken.add(e.id) }
  }
  if (cfg.sortByRank) {
    const heavy = items.slice(0, mains)
    const rest = items.slice(mains).sort((a, b) => equipmentRank(BY_ID.get(a.exerciseId)!) - equipmentRank(BY_ID.get(b.exerciseId)!))
    items.splice(0, items.length, ...heavy, ...rest)
  }
  warmups()

  // Fill leftover time with extra sets: main lifts first, then everything else, one set at a time.
  for (let round = 0; round < cfg.maxSets + 2; round++) {
    let grew = false
    for (const p of items) {
      if (p.sets >= cfg.maxSets) continue
      p.sets++
      if (fits(1.02)) grew = true
      else p.sets--
    }
    if (!grew) break
  }
  // Still short (e.g. every exercise at max sets): squeeze in one more exercise with fewer sets.
  if (!fits(0.9)) {
    for (const g of order) if (cost() < minutes * 0.9 && tryAdd(nextFrom(g), MIN_SETS, 1.08)) break
  }
  for (const p of items) p.est = Math.round(liftMinutes(p, BY_ID.get(p.exerciseId), pref) * 10) / 10
  return items
}

/** Supersets: pick exercises, pair them, then choose how many pairs and rounds come closest to the time. */
function pickSupersets(groups: string[], minutes: number, rng: Rng, avoid: Set<string>, opts: LiftOptions = {}): PlannedExercise[] {
  const pref = opts.rest ?? 'normal'
  // Paired work is quicker, so ask for more exercises than straight sets would fit, then choose from them.
  const pool = pickLifts(groups, minutes * 1.8, rng, avoid, { ...SUPERSET, maxSets: 3 }, { rest: pref }).map((p) => ({ ...p, sets: 3, warmupSets: undefined }))
  const paired = makeSupersets(pool)
  const pairs: PlannedExercise[][] = []
  for (let i = 0; i < paired.length; ) {
    const n = paired[i].block && paired[i + 1]?.block === paired[i].block ? 2 : 1
    pairs.push(paired.slice(i, i + n))
    i += n
  }
  let best: PlannedExercise[] = []
  let bestScore = Infinity
  for (let k = 1; k <= pairs.length; k++) {
    for (const rounds of [3, 4, 5]) {
      const trial = pairs.slice(0, k).flat().map((p) => ({ ...p, sets: rounds }))
      const t = liftsMinutes(trial, pref)
      const score = t > minutes * 1.08 ? Infinity : Math.abs(t - minutes)
      if (score < bestScore) { best = trial; bestScore = score }
    }
  }
  if (best.length === 0 && pairs[0]) best = pairs[0].map((p) => ({ ...p, sets: 3 }))
  // Still short: finish with one straight-set exercise from the leftovers.
  if (liftsMinutes(best, pref) < minutes * 0.9) {
    const leftovers = pool.filter((p) => !best.some((b) => b.exerciseId === p.exerciseId))
    const options = leftovers.flatMap((p) => [3, 2].map((sets) => ({ ...p, sets, block: undefined, blockLabel: undefined })))
    let pick: PlannedExercise | undefined
    for (const extra of options) {
      const t = liftsMinutes([...best, extra], pref)
      if (t <= minutes * 1.08 && (!pick || Math.abs(t - minutes) < Math.abs(liftsMinutes([...best, pick], pref) - minutes))) pick = extra
    }
    if (pick) best = [...best, pick]
  }
  if (opts.warmupSets && best[0]) {
    const e = BY_ID.get(best[0].exerciseId)
    if (e && e.mode === 'weight' && equipmentRank(e) <= 1) best[0] = { ...best[0], warmupSets: 2 }
  }
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

// ---------------------------------------------------------------------------------------------
// Supersets: pair exercises, preferring opposing muscle groups.
// ---------------------------------------------------------------------------------------------

const ANTAGONISTS: Record<string, string[]> = {
  Chest: ['Back'], Back: ['Chest', 'Shoulders'], Shoulders: ['Back', 'Legs'], Arms: ['Arms', 'Core'],
  Legs: ['Core', 'Arms'], Glutes: ['Core', 'Arms'], Core: ['Legs', 'Glutes', 'Back'],
}

function makeSupersets(items: PlannedExercise[]): PlannedExercise[] {
  const left = [...items]
  const out: PlannedExercise[] = []
  let n = 0
  while (left.length) {
    const a = left.shift()!
    const groupOf = (p: PlannedExercise) => BY_ID.get(p.exerciseId)?.group ?? ''
    const prefer = ANTAGONISTS[groupOf(a)] ?? []
    let j = left.findIndex((p) => prefer.includes(groupOf(p)))
    if (j < 0) j = left.length ? 0 : -1
    if (j < 0) {
      out.push(a) // odd one out stays a straight set
      break
    }
    const [b] = left.splice(j, 1)
    n++
    const blockLabel = `Superset ${n} · alternate the two, rest about 60s after each pair`
    out.push({ ...a, block: `ss${n}`, blockLabel }, { ...b, block: `ss${n}`, blockLabel })
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Circuit-style: HIIT and peripheral heart action.
// ---------------------------------------------------------------------------------------------

const UPPER = new Set(['Chest', 'Back', 'Shoulders', 'Arms'])

function roundRobinPick(groups: string[], count: number, poolFor: (g: string) => Exercise[], avoid: Set<string>, rng: Rng) {
  const order = shuffle(groups, rng)
  const queues = new Map(order.map((g) => [g, softShuffle(poolFor(g), avoid, rng)] as const))
  const picked: Exercise[] = []
  const taken = new Set<string>()
  while (picked.length < count) {
    let progressed = false
    for (const g of order) {
      const q = queues.get(g)!
      let next = q.shift()
      while (next && taken.has(next.id)) next = q.shift()
      if (next && picked.length < count) {
        picked.push(next)
        taken.add(next.id)
        progressed = true
      }
    }
    if (!progressed) break
  }
  return picked
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
    (e.tags?.includes('hiit') || (e.suggest && ['Bodyweight', 'Kettlebell', 'Dumbbell'].includes(e.equipment ?? '') && !isIsolation(e)))
  const poolFor = (g: string) => EXERCISES.filter((e) => e.group === g && hiitOk(e))
  const withConditioning = [...new Set([...groups, 'Conditioning'])]

  let n = minutes <= 20 ? 5 : minutes <= 35 ? 6 : minutes <= 50 ? 7 : 8
  const roundMin = (k: number) => (k * (WORK + REST)) / 60 + ROUND_REST
  while (n > 4 && roundMin(n) * 2 > minutes) n--
  const picked = spreadGroups(roundRobinPick(withConditioning, n, poolFor, avoid, rng))
  if (picked.length === 0) return []
  n = picked.length
  const rounds = Math.max(2, Math.min(6, Math.floor(minutes / roundMin(n))))
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
    const base = POOL.filter((e) => e.kind === 'strength' && e.group === g && equipmentRank(e) >= 1 && !isAdvanced(e))
    const compound = base.filter((e) => !isIsolation(e))
    return compound.length >= 3 ? compound : base
  }

  // Half the stations upper body, half lower; Core counts as lower. Falls back to whatever was chosen.
  const upperGroups = groups.filter((g) => UPPER.has(g))
  const lowerGroups = groups.filter((g) => !UPPER.has(g))
  let picked: Exercise[]
  if (upperGroups.length && lowerGroups.length) {
    const up = roundRobinPick(upperGroups, Math.ceil(n / 2), poolFor, avoid, rng)
    const low = roundRobinPick(lowerGroups, Math.floor(n / 2), poolFor, avoid, rng)
    const first = rng() < 0.5 ? up : low
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
  const rounds = Math.max(2, Math.min(minutes >= 75 ? 8 : 6, Math.floor(minutes / roundMin(k))))
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
    const part = generateWorkout(body, byStyle[style] ?? share, { style, rng, avoid: new Set([...avoid, ...used]), rest: lift.rest, warmup: { sets: !!lift.warmupSets && out.length === 0 } })
    for (const p of part) {
      if (used.has(p.exerciseId)) continue // one entry per exercise across the whole workout
      used.add(p.exerciseId)
      out.push(p.block ? { ...p, block: `${style}-${p.block}` } : p)
    }
  }
  return cardio ? [...out, ...pickCardio(cardioMin, rng, new Set([...avoid, ...used])).filter((p) => !used.has(p.exerciseId))] : out
}

export function generateWorkout(focus: string[], minutes: number, opts: GenerateOptions = {}): PlannedExercise[] {
  const w = opts.warmup ?? {}
  const warmMin = (w.cardio ?? 0) + (w.mobility ?? 0)
  if (warmMin > 0) {
    const rng = opts.rng ?? Math.random
    const main = generateWorkout(focus, Math.max(5, minutes - warmMin), { ...opts, rng, warmup: { sets: w.sets } })
    const warm = generateWarmup(focus, w, rng, new Set(main.map((p) => p.exerciseId)))
    return [...warm, ...main.filter((p) => !warm.some((x) => x.exerciseId === p.exerciseId))]
  }
  const { style = 'standard', rng = Math.random, avoid = new Set<string>() } = opts
  const lift: LiftOptions = { rest: opts.rest, warmupSets: w.sets }
  const custom = opts.cardioMinutes != null || (opts.minutesByStyle && Object.keys(opts.minutesByStyle).length > 0)
  if (opts.styles && (new Set(opts.styles).size > 1 || custom)) {
    const list = [...new Set(opts.styles)].sort((a, b) => STYLE_ORDER.indexOf(a) - STYLE_ORDER.indexOf(b))
    return generateMixed(focus, minutes, list, rng, avoid, opts.minutesByStyle, opts.cardioMinutes, lift)
  }
  if (opts.styles?.length === 1) return generateWorkout(focus, minutes, { style: opts.styles[0], rng, avoid, rest: opts.rest, warmup: { sets: w.sets } })
  if (style === 'hyrox') return generateHyrox(minutes)
  if (style === 'crossfit') return generateCrossfit(minutes, rng, avoid)
  if (style === 'amrap' || style === 'emom' || style === 'fortime' || style === 'tabata') return generateTimed(style, focus.filter((g) => g !== 'Cardio'), minutes, rng, avoid)

  let groups = focus.filter((g) => g !== 'Cardio')
  const cardio = focus.includes('Cardio')
  if (groups.length === 0 && !cardio && (style === 'circuit' || style === 'pha')) groups = FULL_BODY_GROUPS
  if (groups.length === 0) return cardio ? pickCardio(minutes, rng, avoid) : []

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
  return cardio ? [...items, ...pickCardio(cardioMin, rng, avoid)] : items
}

/** Swap one item for a different random exercise from the same group or style (keeps sets/minutes/block). */
export function swapExercise(items: PlannedExercise[], index: number, rng: Rng = Math.random): PlannedExercise[] {
  const cur = BY_ID.get(items[index].exerciseId)
  if (!cur) return items
  const used = new Set(items.map((p) => p.exerciseId))
  const options = EXERCISES.filter(
    (e) =>
      e.kind === cur.kind &&
      e.group === cur.group &&
      !used.has(e.id) &&
      (e.suggest || (cur.tags && e.tags?.some((t) => cur.tags!.includes(t)))),
  )
  if (options.length === 0) return items
  return replaceExercise(items, index, options[Math.floor(rng() * options.length)], rng)
}

/** Put a specific exercise in slot `index`, keeping its position, sets, minutes, and block. */
export function replaceExercise(items: PlannedExercise[], index: number, ex: Exercise, rng: Rng = Math.random): PlannedExercise[] {
  return items.map((p, i) => (i === index ? plannedFor(ex, p, rng) : p))
}
