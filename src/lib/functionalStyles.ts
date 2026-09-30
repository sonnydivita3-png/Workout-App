import { EXERCISES } from '../data/exercises'
import { hasGear } from './equipment'
import { likedCardio, wodAmount, wodCardio } from './cardioPrefs'
import type { Exercise, PlannedExercise, Wod, WodKind } from '../types'
import { buildWodItems, makeTabata } from './wod'
import { BY_ID, byName, isMainLift, pick, roundTo, roundTo5, softShuffle, type Rng } from './randomUtil'

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

export function generateHyrox(minutes: number): PlannedExercise[] {
  const fullSize = (pairs: number) =>
    pairs * FULL_RUN_KM * MIN_PER_KM + HYROX_STATIONS.slice(0, pairs).reduce((a, s) => a + s[3], 0)
  let pairs = HYROX_STATIONS.length
  while (pairs > 3 && minutes / fullSize(pairs) < 0.5) pairs--
  const scale = Math.min(1, Math.max(0.35, minutes / fullSize(pairs)))

  const runM = Math.max(200, roundTo(FULL_RUN_KM * 1000 * scale, 50))
  const block = 'hyrox'
  const blockLabel = `Hyrox-style · ${pairs} × (${runM} m run + station)`
  const items: PlannedExercise[] = [
    {
      exerciseId: RUN,
      sets: 1,
      minutes: roundTo5((pairs * runM * MIN_PER_KM) / 1000),
      note: `${runM} m run before each of the ${pairs} stations`,
      est: minutesOf((pairs * runM * MIN_PER_KM) / 1000),
      block,
      blockLabel,
    },
  ]
  for (const station of HYROX_STATIONS.slice(0, pairs)) {
    const est = station[3]
    // Swap in a bodyweight stand-in when the station's equipment isn't available (e.g. no sled at home).
    const sub = !hasGear(BY_ID.get(station[0])!) ? HYROX_SUBS[station[0]] : undefined
    const [id, full, unit] = sub ?? station
    const amount = unit === 'm' ? Math.max(10, roundTo(full * scale, full >= 200 ? 25 : 5)) : Math.max(10, roundTo(full * scale, 5))
    const item: PlannedExercise = {
      exerciseId: id,
      sets: 1,
      note: `${amount} ${unit}`,
      est: minutesOf(est * scale),
      block,
      blockLabel,
    }
    items.push(item)
  }
  return items
}

// ---------------------------------------------------------------------------------------------
// CrossFit-style: optional strength primer, then a timed WOD (AMRAP, EMOM, or rounds for time).
// ---------------------------------------------------------------------------------------------

const WARMUP_MIN = 8
const PRIMER_MIN = 15

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

  const wantPrimer = minutes >= 45
  if (wantPrimer) {
    const lifts = softShuffle(
      EXERCISES.filter((e) => e.suggest && e.kind === 'strength' && e.mode === 'weight' && e.equipment === 'Barbell' && isMainLift(e) && ['Legs', 'Back', 'Chest', 'Shoulders'].includes(e.group) && hasGear(e)),
      avoid,
      rng,
    )
    if (lifts[0]) {
      used.add(lifts[0].id)
      out.push({ exerciseId: lifts[0].id, sets: 4, reps: 5, est: PRIMER_MIN - 1, block: 'primer', blockLabel: 'Strength primer · 4 × 5, build to a heavy set' })
    }
  }

  const spent = (wantPrimer ? PRIMER_MIN : 0) + WARMUP_MIN
  const maxWod = minutes >= 75 ? 25 : 20
  const wodMin = Math.max(8, Math.min(maxWod, minutes - spent))
  const parts: [string, number][] = [['WOD', wodMin]]
  const left = minutes - spent - wodMin
  if (minutes >= 75 && left >= 8) parts.push(['Part B', Math.min(15, left)])

  const pool = softShuffle(crossfitPool(), avoid, rng)
  for (const [part, m] of parts) {
    const count = m <= 12 ? 3 : 4
    const machine = machineFor(rng, used, avoid)
    const moves: Exercise[] = machine ? [machine] : []
    if (machine) used.add(machine.id)
    for (const e of pool) {
      if (used.has(e.id)) continue
      // Keep the mix varied: at most one core move and one erg per WOD.
      if (e.group === 'Core' && moves.some((x) => x.group === 'Core')) continue
      if (e.mode === 'time' && moves.some((x) => x.mode === 'time')) continue
      moves.push(e)
      used.add(e.id)
      if (moves.length === count) break
    }
    if (moves.length >= 2) out.push(...buildWod(m, moves, rng, part))
  }
  return out
}


// ---------------------------------------------------------------------------------------------
// Timed formats on their own: AMRAP, EMOM, or rounds for time, optionally aimed at body parts.
// ---------------------------------------------------------------------------------------------

const KIND_TO_FORMAT: Record<Exclude<WodKind, 'tabata'>, WodFormat> = { amrap: 'AMRAP', emom: 'EMOM', fortime: 'FT' }
const HOME_GEAR = ['Bodyweight', 'Dumbbell', 'Kettlebell']

/** Movements that suit a timed piece, limited to the chosen body parts when there are any. */
function timedPool(focus: string[]): Exercise[] {
  const base = crossfitPool()
  if (focus.length === 0) return base
  const inFocus = (e: Exercise) => focus.includes(e.group)
  const extra = EXERCISES.filter((e) => e.suggest && e.kind === 'strength' && e.mode !== 'time' && inFocus(e) && HOME_GEAR.includes(e.equipment ?? '') && hasGear(e))
  return [...new Map([...base.filter(inFocus), ...extra].map((e) => [e.id, e])).values()]
}

/** An AMRAP, EMOM or for-time workout that fits about `minutes`. Long sessions get a second and third part. */
export function generateTimed(kind: WodKind, focus: string[], minutes: number, rng: Rng, avoid: Set<string>, cardio = false): PlannedExercise[] {
  const pool = softShuffle(timedPool(focus), avoid, rng)
  // A cardio machine joins full-body pieces, and any piece when Cardio was picked as a focus.
  const wantMachine = (used: Set<string>) => (cardio || focus.length === 0 ? machineFor(rng, used, avoid, cardio) : undefined)
  if (kind === 'tabata') {
    // Each movement gets a classic 4-minute Tabata (20s on / 10s off x 8) with a minute's rest before the next.
    const want = Math.min(6, Math.max(2, Math.round(minutes / 5)))
    const machine = wantMachine(new Set())
    const moves: Exercise[] = machine ? [machine] : []
    for (const e of pool) {
      if (e.kind === 'cardio' || (e.group === 'Core' && moves.some((x) => x.group === 'Core'))) continue
      moves.push(e)
      if (moves.length === want) break
    }
    if (moves.length < 2) return []
    const wod = makeTabata(moves.length)
    return buildWodItems({ wod, moves: moves.map((e) => ({ exerciseId: e.id })), block: 'tabata', label: `Tabata · ${moves.length} movements · 20s on / 10s off × 8 each, 1 min rest between` })
  }
  const used = new Set<string>()
  const out: PlannedExercise[] = []
  let left = minutes
  const cap = kind === 'emom' ? 24 : 20
  for (let part = 0; part < 3 && left >= (part === 0 ? 5 : 12); part++) {
    const m = part === 0 ? Math.min(left, minutes > 45 ? cap : Math.max(cap, 30)) : Math.min(cap, left - 2)
    const count = m <= 10 ? 3 : 4
    const machine = wantMachine(used)
    const moves: Exercise[] = machine ? [machine] : []
    for (const e of pool) {
      if (used.has(e.id)) continue
      if (e.group === 'Core' && moves.some((x) => x.group === 'Core')) continue
      if (e.mode === 'time' && moves.some((x) => x.mode === 'time')) continue
      moves.push(e)
      if (moves.length === count) break
    }
    if (moves.length < 2) break
    moves.forEach((e) => used.add(e.id))
    out.push(...buildWod(m, moves, rng, part === 0 ? 'WOD' : `Part ${String.fromCharCode(65 + part)}`, KIND_TO_FORMAT[kind as Exclude<WodKind, 'tabata'>]))
    left -= m + 2
  }
  return out
}
