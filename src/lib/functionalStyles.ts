import { EXERCISES } from '../data/exercises'
import { hasGear, isHomeSetup } from './equipment'
import { likedCardio, wodAmount, wodCardio } from './cardioPrefs'
import type { Exercise, PlannedExercise, Wod, WodKind } from '../types'
import { buildWodItems, makeTabata } from './wod'
import { staysPut } from './stations'
import { BY_ID, byName, familyOf, isAdvanced, isIsolation, isMainLift, isQuirky, isStaple, isTechnical, pick, roundTo, roundTo5, softShuffle, type Rng } from './randomUtil'

const RUN = 'running'
const minutesOf = (n: number) => Math.round(n * 10) / 10

// ---------------------------------------------------------------------------------------------
// Hyrox-style: run + station, eight times in the real event. Scaled to fit the time available.
// ---------------------------------------------------------------------------------------------

/** Full-size Hyrox stations: [exercise id, distance (m) or reps, unit, estimated minutes at full size]. */
const HYROX_STATIONS: [string, number, 'm' | 'reps', number][] = [
  ['x-skierg', 1000, 'm', 4.5],
  ['x-sled-push', 50, 'm', 2.5],
  ['x-sled-pull', 50, 'm', 3],
  ['x-burpee-broad-jump', 80, 'm', 4],
  ['x-row-erg', 1000, 'm', 4.5],
  ['x-farmers-carry', 200, 'm', 1.5],
  ['x-sandbag-lunges', 100, 'm', 4],
  ['x-wall-balls', 100, 'reps', 5],
]
/** Stand-ins when a station's equipment isn't available: [exercise id, full-size amount, unit]. All bodyweight. */
const HYROX_SUBS: Record<string, [string, number, 'm' | 'reps']> = {
  'x-skierg': ['x-burpee', 30, 'reps'],
  'x-sled-push': ['x-jump-squat', 30, 'reps'],
  'x-sled-pull': ['Mountain_Climbers', 60, 'reps'],
  'x-row-erg': ['x-jumping-jacks', 100, 'reps'],
  'x-farmers-carry': ['x-high-knees', 100, 'reps'],
  'x-sandbag-lunges': ['Bodyweight_Walking_Lunge', 100, 'm'],
  'x-wall-balls': ['x-air-squat', 75, 'reps'],
}
const FULL_RUN_KM = 1
const MIN_PER_KM = 6

/** The run: on a treadmill when that's the running they do (they like the treadmill, not running outside). */
function hyroxRun(): string {
  const liked = (likedCardio() ?? []).map((e) => e.id)
  return liked.includes('Running_Treadmill') && !liked.includes(RUN) ? 'Running_Treadmill' : RUN
}

/**
 * A Hyrox simulation sized to the time: run + station pairs in race order. Shorter sessions keep fewer stations,
 * chosen at random (still in race order) so every station comes up over time and a reroll gives a different one.
 */
export function generateHyrox(minutes: number, rng: Rng = Math.random): PlannedExercise[] {
  const avgStation = HYROX_STATIONS.reduce((a, s) => a + s[3], 0) / HYROX_STATIONS.length
  const fullSize = (pairs: number) => pairs * (FULL_RUN_KM * MIN_PER_KM + avgStation)
  let pairs = HYROX_STATIONS.length
  while (pairs > 3 && minutes / fullSize(pairs) < 0.5) pairs--
  const keep = new Set(shuffleIdx(HYROX_STATIONS.length, rng).slice(0, pairs))
  const stations = HYROX_STATIONS.filter((_, i) => keep.has(i))
  const size = pairs * FULL_RUN_KM * MIN_PER_KM + stations.reduce((a, s) => a + s[3], 0)
  const scale = Math.min(1, Math.max(0.35, minutes / size))

  const runM = Math.max(200, roundTo(FULL_RUN_KM * 1000 * scale, 50))
  const block = 'hyrox'
  const blockLabel = `Hyrox-style · ${pairs} × (${runM} m run + station)`
  const items: PlannedExercise[] = [
    {
      exerciseId: hyroxRun(),
      sets: 1,
      minutes: roundTo5((pairs * runM * MIN_PER_KM) / 1000),
      note: `${runM} m run before each of the ${pairs} stations`,
      est: minutesOf((pairs * runM * MIN_PER_KM) / 1000),
      block,
      blockLabel,
    },
  ]
  for (const station of stations) {
    const est = station[3]
    // Swap in a bodyweight stand-in when the station's equipment isn't available (e.g. no sled at home).
    // A sled counts as "Other" gear, but home gyms rarely have one.
    const sled = station[0] === 'x-sled-push' || station[0] === 'x-sled-pull'
    const sub = !hasGear(BY_ID.get(station[0])!) || (sled && isHomeSetup()) ? HYROX_SUBS[station[0]] : undefined
    const [id, full, unit] = sub ?? station
    const amount = unit === 'm' ? Math.max(10, roundTo(full * scale, full >= 200 ? 25 : 5)) : Math.max(10, roundTo(full * scale, 5))
    items.push({ exerciseId: id, sets: 1, note: `${amount} ${unit}`, est: minutesOf(est * scale), block, blockLabel })
  }
  return items
}

const shuffleIdx = (n: number, rng: Rng) => {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// ---------------------------------------------------------------------------------------------
// CrossFit-style: optional strength primer, then a timed WOD (AMRAP, EMOM, or rounds for time).
// ---------------------------------------------------------------------------------------------

const PRIMER_MIN = 15
const PRIMER_MOVES = /squat|deadlift|press|bench/i
/** Jump rope and double unders are the same skill: never both in one workout. */
const ROPE = /rope|double under/i

const crossfitPool = () => {
  const named = ['Pushups', 'Pullups', 'Bodyweight Squat', 'Sit-Up'].map(byName).filter((e): e is Exercise => !!e)
  // Machines come in separately (see machineFor), so the mix always has room for exactly one.
  const tagged = EXERCISES.filter((e) => e.tags?.includes('crossfit') && e.kind !== 'cardio')
  return [...new Map([...tagged, ...named].map((e) => [e.id, e])).values()].filter(hasGear)
}

/** Reps per round for a WOD movement, by feel. */
function wodReps(e: Exercise, rng: Rng, hard: boolean): number {
  const table: Record<string, [number, number]> = {
    'x-burpee': [8, 12], 'x-air-squat': [15, 20], Pushups: [10, 15], Pullups: [5, 8], 'x-toes-to-bar': [6, 10],
    'x-kb-swing': [15, 20], 'x-thruster': [8, 12], 'x-db-snatch': [8, 12], 'x-box-jump': [10, 12],
    'x-wall-balls': [12, 15], 'x-double-unders': [30, 50], 'Sit-Up': [15, 20], Bodyweight_Squat: [15, 20],
  }
  const [lo, hi] = table[e.id] ?? [10, 15]
  const n = lo + Math.floor(rng() * (hi - lo + 1))
  return roundTo(hard ? n * 0.8 : n, n > 25 ? 5 : 1) || lo
}

type WodFormat = 'AMRAP' | 'EMOM' | 'FT'

/**
 * Movements for one timed piece, picked in pool order: `start` (e.g. a cardio machine) plus whatever `fits`, until there
 * are `count`. The piece stays in one area of the gym, like circuits: portable gear and floor moves plus at most one fixed
 * station (the cardio machine doesn't count). If that leaves it short, any mix is allowed rather than a thin workout.
 */
function pickMoves(pool: Exercise[], start: Exercise[], count: number, fits: (e: Exercise, moves: Exercise[]) => boolean): Exercise[] {
  const run = (stay: boolean) => {
    const moves = [...start]
    for (const e of pool) {
      if (moves.length >= count) break
      // Never the same movement twice in one piece (air squats and bodyweight squats).
      if (moves.includes(e) || !fits(e, moves) || (familyOf(e) && moves.some((x) => familyOf(x) === familyOf(e)))) continue
      if (stay && e.kind !== 'cardio' && !staysPut(moves.filter((x) => x.kind !== 'cardio'), e)) continue
      moves.push(e)
    }
    return moves
  }
  const near = run(true)
  if (near.length >= Math.min(count, start.length + 3)) return near
  const any = run(false)
  return any.length > near.length ? any : near
}

/**
 * A cardio station for a timed piece (rower, SkiErg, air bike, run…): one they like whenever they've said, otherwise
 * most of the time from the classic machines. Each machine once per workout.
 */
function machineFor(rng: Rng, used: Set<string>, avoid: Set<string>, always = false): Exercise | undefined {
  const all = wodCardio().filter((e) => !used.has(e.id))
  const list = all.filter((e) => !avoid.has(e.id))
  if (!all.length || (!always && !likedCardio() && rng() >= 0.7)) return undefined
  return pick(list.length ? list : all, rng)
}

function buildWod(minutes: number, moves: Exercise[], rng: Rng, part: string, forced?: WodFormat): PlannedExercise[] {
  const format: WodFormat = forced ?? pick(['AMRAP', 'EMOM', 'FT'], rng)
  const n = moves.length
  const per = minutesOf(minutes / n)
  let label: string
  let rounds: number
  if (format === 'AMRAP') {
    rounds = Math.min(6, Math.max(3, Math.round(minutes / (n * 0.9))))
    label = `${part} · AMRAP ${minutes} min · cycle through, log rounds as sets`
  } else if (format === 'EMOM') {
    rounds = Math.max(2, Math.round(minutes / n))
    label = `${part} · EMOM ${rounds * n} min · one movement per minute, ${n}-minute cycle × ${rounds}`
  } else {
    rounds = Math.min(5, Math.max(3, Math.round(minutes / (n * 1.3))))
    label = `${part} · ${rounds} rounds for time`
  }
  const wod: Wod = format === 'AMRAP' ? { kind: 'amrap', minutes } : format === 'EMOM' ? { kind: 'emom', minutes: rounds * n, interval: 1 } : { kind: 'fortime', minutes, rounds }
  return moves.map((e, i) => {
    const item: PlannedExercise = { exerciseId: e.id, sets: rounds, est: per, block: part.toLowerCase().replace(/\s+/g, '-'), blockLabel: label, wod }
    if (e.kind === 'cardio') item.note = wodAmount(e.id, format === 'FT' ? 1.25 : 1)
    else if (e.mode === 'time') item.note = '30s'
    else item.reps = wodReps(e, rng, format === 'EMOM')
    if (format === 'EMOM') item.note = `${item.note ? item.note + ' · ' : ''}minute ${i + 1} of ${n}`
    return item
  })
}

export function generateCrossfit(minutes: number, rng: Rng, avoid: Set<string>): PlannedExercise[] {
  const out: PlannedExercise[] = []
  const used = new Set<string>()

  // A strength primer when there's time: a barbell lift, or with dumbbells / kettlebells at home.
  const BIG = ['Quads', 'Hamstrings', 'Back', 'Chest', 'Shoulders']
  const primerFrom = (equipment: string[]) => softShuffle(
    EXERCISES.filter((e) => e.suggest && e.kind === 'strength' && e.mode === 'weight' && equipment.includes(e.equipment ?? '') && (isMainLift(e) || isStaple(e)) && !isIsolation(e) && !isQuirky(e) && !isTechnical(e) && BIG.includes(e.group) && hasGear(e)),
    avoid,
    rng,
  )
  let primed = false
  if (minutes >= 35) {
    // Squats, deadlifts and presses, like a box would program (not rows or lunges).
    const barbell = primerFrom(['Barbell']).filter((e) => isMainLift(e) && PRIMER_MOVES.test(e.name))
    const lifts = barbell.length ? barbell : primerFrom(['Dumbbell', 'Kettlebell']).filter((e) => PRIMER_MOVES.test(e.name))
    // An everyday lift (Back Squat, Deadlift, Overhead Press…) rather than an odd variation.
    const lift = lifts.find((e) => e.fullName && !avoid.has(e.id)) ?? lifts.find((e) => isStaple(e)) ?? lifts[0]
    if (lift) {
      used.add(lift.id)
      primed = true
      const heavy = barbell.length > 0
      out.push({ exerciseId: lift.id, sets: 4, reps: heavy ? 5 : 8, est: PRIMER_MIN - 1, block: 'primer', blockLabel: heavy ? 'Strength primer · 4 × 5, build to a heavy set' : 'Strength primer · 4 × 8, heavy as good form allows' })
    }
  }

  // The rest of the time goes to the WOD, plus a Part B when there's 8+ minutes left over.
  const spent = primed ? PRIMER_MIN : 0
  const maxWod = minutes >= 75 ? 25 : 20
  const wodMin = Math.max(8, Math.min(maxWod, minutes - spent))
  const parts: [string, number][] = [['WOD', wodMin]]
  let left = minutes - spent - wodMin
  while (left >= 8 && parts.length < 3) {
    const m = Math.min(left >= 20 ? 20 : 15, left)
    parts.push([`Part ${String.fromCharCode(64 + parts.length + 1)}`, m])
    left -= m
  }

  const pool = softShuffle(crossfitPool(), avoid, rng)
  for (const [part, m] of parts) {
    const count = m <= 12 ? 3 : 4
    const machine = machineFor(rng, used, avoid)
    if (machine) used.add(machine.id)
    // Keep the mix varied: at most one core move and one erg per WOD.
    const fits = () => (e: Exercise, ms: Exercise[]) =>
      !used.has(e.id) && !(e.group === 'Core' && ms.some((x) => x.group === 'Core')) && !(e.mode === 'time' && ms.some((x) => x.mode === 'time'))
      && !(ROPE.test(e.name) && ms.some((x) => ROPE.test(x.name)))
    // New moves for each part (a day holds each exercise once, so its log stays its own). With little equipment the
    // usual list runs out: then any simple, compound move they can do.
    let moves = pickMoves(pool, machine ? [machine] : [], count, fits())
    if (moves.length < Math.min(3, count)) moves = pickMoves([...pool, ...softShuffle(widerPool([]), avoid, rng)], machine ? [machine] : [], count, fits())
    moves.forEach((e) => used.add(e.id))
    if (moves.length >= 2) out.push(...buildWod(m, moves, rng, part))
  }
  return out
}


// ---------------------------------------------------------------------------------------------
// Timed formats on their own: AMRAP, EMOM, or rounds for time, optionally aimed at body parts.
// ---------------------------------------------------------------------------------------------

const KIND_TO_FORMAT: Record<Exclude<WodKind, 'tabata'>, WodFormat> = { amrap: 'AMRAP', emom: 'EMOM', fortime: 'FT' }
const HOME_GEAR = ['Bodyweight', 'Dumbbell', 'Kettlebell']

/** Any simple, everyday compound move someone can do (for the chosen parts, if any): the fallback when the usual list runs out. */
const widerPool = (focus: string[]) =>
  EXERCISES.filter((e) => e.suggest && e.kind === 'strength' && (focus.length === 0 || focus.includes(e.group)) && isStaple(e) && !isIsolation(e) && !isTechnical(e) && !isQuirky(e) && !isAdvanced(e) && hasGear(e))

/** Movements that suit a timed piece, limited to the chosen body parts when there are any. */
function timedPool(focus: string[]): Exercise[] {
  const base = crossfitPool()
  if (focus.length === 0) return base
  const inFocus = (e: Exercise) => focus.includes(e.group)
  // Simple, quick moves for the clock: no Olympic lifts, gimmicks or advanced skills.
  // Single-joint moves (flyes, curls) only when the focus is a small muscle; a chest AMRAP is presses and push-ups.
  const small = focus.some((g) => ['Biceps', 'Triceps', 'Calves', 'Core', 'Shoulders'].includes(g))
  const extra = EXERCISES.filter((e) => e.suggest && e.kind === 'strength' && (e.mode !== 'time' || focus.includes('Core')) && inFocus(e) && HOME_GEAR.includes(e.equipment ?? '') && !isTechnical(e) && !isQuirky(e) && !isAdvanced(e) && (small || !isIsolation(e)) && hasGear(e))
  return [...new Map([...base.filter(inFocus), ...extra].map((e) => [e.id, e])).values()]
}

/** An AMRAP, EMOM or for-time workout that fits about `minutes`. Long sessions get a second and third part. */
export function generateTimed(kind: WodKind, focus: string[], minutes: number, rng: Rng, avoid: Set<string>, cardio = false): PlannedExercise[] {
  // Everyday moves first (push-ups, goblet squats, swings…), the rest of the library only to fill gaps.
  const shuffled = softShuffle(timedPool(focus), avoid, rng)
  const pool = [...shuffled.filter((e) => e.tags?.includes('crossfit') || isStaple(e)), ...shuffled.filter((e) => !e.tags?.includes('crossfit') && !isStaple(e))]
  // A cardio machine joins full-body pieces, and any piece when Cardio was picked as a focus.
  const wantMachine = (used: Set<string>) => (cardio || focus.length === 0 ? machineFor(rng, used, avoid, cardio) : undefined)
  // At most one core move per piece, unless core is all they asked for.
  const coreOnly = focus.length > 0 && focus.every((g) => g === 'Core')
  const oneCore = (e: Exercise, ms: Exercise[]) => coreOnly || !(e.group === 'Core' && ms.some((x) => x.group === 'Core'))
  if (kind === 'tabata') {
    // Each movement gets a classic 4-minute Tabata (20s on / 10s off x 8) with a minute's rest before the next.
    // Up to ten 4-minute Tabatas (about 49 minutes): more than that isn't a Tabata session any more.
    const want = Math.min(10, Math.max(2, Math.round(minutes / 5)))
    const machine = wantMachine(new Set())
    let moves = pickMoves(pool, machine ? [machine] : [], want, (e, ms) => e.kind !== 'cardio' && oneCore(e, ms))
    if (moves.length < want) moves = pickMoves([...pool, ...softShuffle(widerPool(focus), avoid, rng)], machine ? [machine] : [], want, (e, ms) => e.kind !== 'cardio' && oneCore(e, ms))
    if (moves.length < 2) return []
    const wod = makeTabata(moves.length)
    return buildWodItems({ wod, moves: moves.map((e) => ({ exerciseId: e.id })), block: 'tabata', label: `Tabata · ${moves.length} movements · 20s on / 10s off × 8 each, 1 min rest between` })
  }
  const used = new Set<string>()
  const out: PlannedExercise[] = []
  let left = minutes
  const cap = kind === 'emom' ? 24 : 20
  // Up to four parts with a 2-minute break between, so long sessions fill their time (a short finisher when 7-9
  // minutes are left, e.g. a 40-minute session: a 30-minute piece, then 6 more).
  for (let part = 0; part < 4 && left >= (part === 0 ? 5 : 7); part++) {
    const m = part === 0 ? Math.min(left, minutes > 45 ? cap : Math.max(cap, 30)) : Math.min(cap, left - 2)
    const count = m <= 10 ? 3 : 4
    const machine = wantMachine(used)
    const fits = () => (e: Exercise, ms: Exercise[]) =>
      !used.has(e.id) && oneCore(e, ms) && !(e.mode === 'time' && ms.some((x) => x.mode === 'time'))
    // New moves for each part (a day holds each exercise once). With a small pool (bodyweight, one muscle), the
    // part draws on any simple move for those body parts they can do.
    let moves = pickMoves(pool, machine ? [machine] : [], count, fits())
    if (moves.length < Math.min(3, count)) moves = pickMoves([...pool, ...softShuffle(widerPool(focus), avoid, rng)], machine ? [machine] : [], count, fits())
    if (moves.length < 2) break
    moves.forEach((e) => used.add(e.id))
    out.push(...buildWod(m, moves, rng, part === 0 ? 'WOD' : `Part ${String.fromCharCode(65 + part)}`, KIND_TO_FORMAT[kind as Exclude<WodKind, 'tabata'>]))
    left -= m + 2
  }
  return out
}
