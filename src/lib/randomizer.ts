import { EXERCISES } from '../data/exercises'
import type { Exercise, PlannedExercise } from '../types'
import { generateCrossfit, generateHyrox, generateTimed } from './functionalStyles'
import { BY_ID, FULL_BODY_GROUPS, isAdvanced, isIsolation, isMainLift, POOL, pick, roundTo5, shuffle, softShuffle, type Rng } from './randomUtil'

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
export const styleInfo = (id: WorkoutStyle) => STYLES.find((s) => s.id === id)!

const MIN_SETS = 2
const MAX_SETS = 4
const MIN_PER_SET = 2.5 // work + rest, used when an item has no `est`
const SETUP_MIN = 1 // per exercise

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
    ? { block: prev.block, blockLabel: prev.blockLabel, est: prev.est, ...(prev.wod ? { wod: prev.wod } : {}), ...(carriesNote(prev.blockLabel) && prev.note ? { note: prev.note } : {}) }
    : { est: prev?.est }
  if (ex.kind === 'cardio') return { exerciseId: ex.id, sets: 1, minutes: prev?.minutes ?? 15, ...keep }
  const targets = keep.note ? {} : targetsFor(ex, rng)
  return { exerciseId: ex.id, sets: Math.max(MIN_SETS, prev?.sets ?? 3), ...targets, ...keep }
}

export const minutesFor = (items: PlannedExercise[]) =>
  items.reduce((sum, p) => {
    if (p.est != null) return sum + p.est
    const e = BY_ID.get(p.exerciseId)
    if (!e) return sum
    return sum + (e.kind === 'cardio' ? (p.minutes ?? 0) : p.sets * MIN_PER_SET + SETUP_MIN)
  }, 0)

function pickCardio(minutes: number, rng: Rng, avoid: Set<string> = new Set()): PlannedExercise[] {
  const pool = softShuffle(POOL.filter((e) => e.kind === 'cardio'), avoid, rng)
  if (pool.length === 0) return []
  if (minutes <= 45) return [{ exerciseId: pool[0].id, sets: 1, minutes: roundTo5(minutes) }]
  const half = roundTo5(minutes / 2)
  return pool.slice(0, 2).map((e, i) => ({ exerciseId: e.id, sets: 1, minutes: i === 0 ? half : roundTo5(minutes - half) }))
}

// ---------------------------------------------------------------------------------------------
// Straight-set styles (standard, strength, bodyweight, supersets) share one picker.
// ---------------------------------------------------------------------------------------------

interface LiftConfig {
  sets: number
  maxSets: number
  minPerSet: number
  setup: number
  /** Exercises this style may use for a group. */
  filter: (e: Exercise) => boolean
  /** When a group has nothing that passes `filter`: use anything (true) or borrow another group (map). */
  fallback: 'any' | Record<string, string>
  targets: (e: Exercise, rng: Rng) => Pick<PlannedExercise, 'reps' | 'seconds'>
  /** Add sets to use leftover time. */
  fill: boolean
  sortByRank: boolean
  /** Use an even number of exercises (for pairing). */
  even?: boolean
  /** Give every exercise the same number of sets (pairs must match). */
  uniform?: boolean
}

const STANDARD: LiftConfig = {
  sets: 3, maxSets: MAX_SETS, minPerSet: MIN_PER_SET, setup: SETUP_MIN,
  filter: () => true, fallback: 'any', targets: targetsFor, fill: true, sortByRank: true,
}

const STRENGTH: LiftConfig = {
  sets: 4, maxSets: 5, minPerSet: 3.5, setup: 1,
  filter: (e) => e.mode === 'weight' && equipmentRank(e) <= 1 && isMainLift(e),
  fallback: 'any',
  targets: (e, rng) => (isMainLift(e) && e.mode === 'weight' && equipmentRank(e) <= 1 ? { reps: equipmentRank(e) === 0 ? pick([3, 5], rng) : pick([5, 6], rng) } : targetsFor(e, rng)),
  fill: true, sortByRank: true,
}

const BODYWEIGHT: LiftConfig = {
  sets: 3, maxSets: 4, minPerSet: 2, setup: 0.5,
  filter: (e) => e.equipment === 'Bodyweight' && e.mode !== 'weight' && !isAdvanced(e),
  fallback: { Shoulders: 'Chest', Arms: 'Chest', Glutes: 'Legs' },
  targets: (e, rng) =>
    e.mode === 'time'
      ? { seconds: pick([30, 45, 60], rng) }
      : { reps: pick(/pull-?up|chin-?up|dip|inverted|australian/i.test(e.name) ? [6, 8, 10] : e.group === 'Core' ? [15, 20] : [12, 15, 20], rng) },
  fill: true, sortByRank: false,
}

const SUPERSET: LiftConfig = { ...STANDARD, minPerSet: 1.75, setup: 0.5, fill: true, even: true, uniform: true }

function pickLifts(groups: string[], minutes: number, rng: Rng, avoid: Set<string>, cfg: LiftConfig): PlannedExercise[] {
  if (groups.length === 0 || minutes < 5) return []
  const perExercise = (sets: number) => sets * cfg.minPerSet + cfg.setup
  let sets = cfg.sets
  let count = Math.floor(minutes / perExercise(sets))
  if (count < groups.length) {
    sets = Math.min(sets, MIN_SETS)
    count = Math.floor(minutes / perExercise(sets))
  }
  if (cfg.even && count > 2 && count % 2 === 1) count--
  count = Math.max(1, Math.min(count, 12))

  const order = shuffle(groups, rng).slice(0, count)
  const strengthPool = (g: string) => POOL.filter((e) => e.kind === 'strength' && e.group === g)
  const queues = new Map(
    order.map((g) => {
      let pool = strengthPool(g).filter(cfg.filter)
      if (pool.length === 0) {
        if (cfg.fallback === 'any') pool = strengthPool(g)
        else if (cfg.fallback[g]) pool = strengthPool(cfg.fallback[g]).filter(cfg.filter)
      }
      return [g, softShuffle(pool, avoid, rng)] as const
    }),
  )
  const picked: { group: string; ex: Exercise }[] = []
  const taken = new Set<string>()
  while (picked.length < count) {
    let progressed = false
    for (const g of order) {
      const q = queues.get(g)!
      let next = q.shift()
      while (next && taken.has(next.id)) next = q.shift()
      if (next && picked.length < count) {
        picked.push({ group: g, ex: next })
        taken.add(next.id)
        progressed = true
      }
    }
    if (!progressed) break
  }

  const ordered = order.flatMap((g) => {
    const exs = picked.filter((p) => p.group === g).map((p) => p.ex)
    return cfg.sortByRank ? exs.sort((a, b) => equipmentRank(a) - equipmentRank(b)) : exs
  })
  const items: PlannedExercise[] = ordered.map((e) => ({ exerciseId: e.id, sets, ...cfg.targets(e, rng), est: perExercise(sets) }))

  const total = () => items.reduce((a, p) => a + (p.est ?? 0), 0)
  if (cfg.fill && cfg.uniform) {
    while (items.length && items[0].sets < cfg.maxSets && total() + items.length * cfg.minPerSet <= minutes) {
      for (const p of items) { p.sets++; p.est = (p.est ?? 0) + cfg.minPerSet }
    }
  } else if (cfg.fill) {
    for (let i = 0; items.length && i < items.length * cfg.maxSets; i++) {
      const p = items[i % items.length]
      if (p.sets < cfg.maxSets && total() + cfg.minPerSet <= minutes) {
        p.sets++
        p.est = (p.est ?? 0) + cfg.minPerSet
      }
    }
  }
  return items
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
  rng?: Rng
  /** Exercises to use only if nothing else fits (e.g. what was in the previous workout). */
  avoid?: Set<string>
}

/**
 * Build a workout for the chosen focus areas and style that fits roughly `minutes`.
 * Cardio takes ~25% of the time when mixed with lifting, all of it when alone.
 * Hyrox- and CrossFit-style workouts are full-body formats and ignore the body-part focus.
 */
/** Heavy lifting first, then conditioning, then whole-workout formats. */
const STYLE_ORDER: WorkoutStyle[] = ['strength', 'standard', 'bodyweight', 'supersets', 'pha', 'circuit', 'amrap', 'emom', 'tabata', 'fortime', 'crossfit', 'hyrox']

/** Several styles back to back, splitting the time between them, with any cardio at the end. */
function generateMixed(focus: string[], minutes: number, styles: WorkoutStyle[], rng: Rng, avoid: Set<string>): PlannedExercise[] {
  const cardio = focus.includes('Cardio')
  const body = focus.filter((g) => g !== 'Cardio')
  const cardioMin = cardio ? Math.min(30, Math.max(10, roundTo5(minutes * 0.25))) : 0
  const share = Math.max(10, roundTo5((minutes - cardioMin) / styles.length))
  const used = new Set<string>()
  const out: PlannedExercise[] = []
  for (const style of styles) {
    const part = generateWorkout(body, share, { style, rng, avoid: new Set([...avoid, ...used]) })
    for (const p of part) {
      if (used.has(p.exerciseId)) continue // one entry per exercise across the whole workout
      used.add(p.exerciseId)
      out.push(p.block ? { ...p, block: `${style}-${p.block}` } : p)
    }
  }
  return cardio ? [...out, ...pickCardio(cardioMin, rng, new Set([...avoid, ...used])).filter((p) => !used.has(p.exerciseId))] : out
}

export function generateWorkout(focus: string[], minutes: number, opts: GenerateOptions = {}): PlannedExercise[] {
  const { style = 'standard', rng = Math.random, avoid = new Set<string>() } = opts
  if (opts.styles && new Set(opts.styles).size > 1) {
    const list = [...new Set(opts.styles)].sort((a, b) => STYLE_ORDER.indexOf(a) - STYLE_ORDER.indexOf(b))
    return generateMixed(focus, minutes, list, rng, avoid)
  }
  if (opts.styles?.length === 1) return generateWorkout(focus, minutes, { style: opts.styles[0], rng, avoid })
  if (style === 'hyrox') return generateHyrox(minutes)
  if (style === 'crossfit') return generateCrossfit(minutes, rng, avoid)
  if (style === 'amrap' || style === 'emom' || style === 'fortime' || style === 'tabata') return generateTimed(style, focus.filter((g) => g !== 'Cardio'), minutes, rng, avoid)

  let lift = focus.filter((g) => g !== 'Cardio')
  const cardio = focus.includes('Cardio')
  if (lift.length === 0 && !cardio && (style === 'circuit' || style === 'pha')) lift = FULL_BODY_GROUPS
  if (lift.length === 0) return cardio ? pickCardio(minutes, rng, avoid) : []

  const cardioMin = cardio ? Math.min(30, Math.max(10, roundTo5(minutes * 0.25))) : 0
  const liftMin = minutes - cardioMin
  let items: PlannedExercise[]
  switch (style) {
    case 'strength': items = pickLifts(lift, liftMin, rng, avoid, STRENGTH); break
    case 'bodyweight': items = pickLifts(lift, liftMin, rng, avoid, BODYWEIGHT); break
    case 'supersets': items = makeSupersets(pickLifts(lift, liftMin, rng, avoid, SUPERSET)); break
    case 'circuit': items = generateCircuit(lift, liftMin, rng, avoid); break
    case 'pha': items = generatePha(lift, liftMin, rng, avoid); break
    default: items = pickLifts(lift, liftMin, rng, avoid, STANDARD)
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
