import { EXERCISES } from '../data/exercises'
import type { Exercise, PlannedExercise } from '../types'

export const FOCUS_OPTIONS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core', 'Cardio'] as const
export const LIFT_GROUPS = FOCUS_OPTIONS.filter((g) => g !== 'Cardio')

const MIN_SETS = 2
const MAX_SETS = 4
const MIN_PER_SET = 2.5 // work + rest
const SETUP_MIN = 1 // per exercise

type Rng = () => number

const POOL = EXERCISES.filter((e) => e.suggest)
const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Lower = more "main lift" (done earlier in a workout). */
const equipmentRank = (e: Exercise) =>
  ({ Barbell: 0, Dumbbell: 1, Kettlebell: 1, Machine: 2, Cable: 2, 'EZ bar': 2, Bodyweight: 3 })[e.equipment ?? ''] ?? 4

/** Rep target by exercise style: heavy barbell work low, accessories higher. */
export function repsFor(e: Exercise, rng: Rng = Math.random): number {
  if (e.group === 'Core') return 15
  const r = equipmentRank(e)
  if (r === 0) return rng() < 0.5 ? 6 : 8
  if (r <= 2) return rng() < 0.5 ? 10 : 12
  return 12
}

export const minutesFor = (items: PlannedExercise[]) =>
  items.reduce((sum, p) => {
    const e = BY_ID.get(p.exerciseId)
    if (!e) return sum
    return sum + (e.kind === 'cardio' ? (p.minutes ?? 0) : p.sets * MIN_PER_SET + SETUP_MIN)
  }, 0)

const roundTo5 = (n: number) => Math.max(5, Math.round(n / 5) * 5)

function pickCardio(minutes: number, rng: Rng, avoid: Set<string> = new Set()): PlannedExercise[] {
  const pool = shuffle(POOL.filter((e) => e.kind === 'cardio' && !avoid.has(e.id)), rng)
  if (pool.length === 0) return []
  if (minutes <= 45) return [{ exerciseId: pool[0].id, sets: 1, minutes: roundTo5(minutes) }]
  const half = roundTo5(minutes / 2)
  return pool.slice(0, 2).map((e, i) => ({ exerciseId: e.id, sets: 1, minutes: i === 0 ? half : roundTo5(minutes - half) }))
}

function pickLifts(groups: string[], minutes: number, rng: Rng, avoid: Set<string>): PlannedExercise[] {
  if (groups.length === 0 || minutes < 5) return []
  let sets = 3
  let count = Math.floor(minutes / (sets * MIN_PER_SET + SETUP_MIN))
  if (count < groups.length) {
    sets = MIN_SETS
    count = Math.floor(minutes / (sets * MIN_PER_SET + SETUP_MIN))
  }
  count = Math.max(1, Math.min(count, 12))

  const order = shuffle(groups, rng).slice(0, count)
  // Round-robin exercises over the chosen groups, never repeating one.
  const queues = new Map(
    order.map((g) => [g, shuffle(POOL.filter((e) => e.kind === 'strength' && e.group === g && !avoid.has(e.id)), rng)]),
  )
  const picked = new Map<string, Exercise[]>(order.map((g) => [g, []]))
  for (let n = 0; n < count; ) {
    let progressed = false
    for (const g of order) {
      const next = queues.get(g)!.shift()
      if (next && n < count) {
        picked.get(g)!.push(next)
        n++
        progressed = true
      }
    }
    if (!progressed) break
  }

  const items: PlannedExercise[] = []
  for (const g of order) {
    const exs = picked.get(g)!.sort((a, b) => equipmentRank(a) - equipmentRank(b))
    for (const e of exs) items.push({ exerciseId: e.id, sets, reps: repsFor(e, rng) })
  }

  // Use leftover time by adding sets, one exercise at a time, up to MAX_SETS.
  let i = 0
  while (items.length && i < items.length * MAX_SETS) {
    const p = items[i % items.length]
    if (p.sets < MAX_SETS && minutesFor(items) + MIN_PER_SET <= minutes) p.sets++
    i++
  }
  return items
}

/**
 * Build a workout for the chosen focus areas that fits roughly `minutes`.
 * Cardio takes ~25% of the time when mixed with lifting, all of it when alone.
 */
export function generateWorkout(focus: string[], minutes: number, rng: Rng = Math.random, avoid: Set<string> = new Set()): PlannedExercise[] {
  const lift = focus.filter((g) => g !== 'Cardio')
  const cardio = focus.includes('Cardio')
  if (lift.length === 0) return cardio ? pickCardio(minutes, rng, avoid) : []
  if (!cardio) return pickLifts(lift, minutes, rng, avoid)
  const cardioMin = Math.min(30, Math.max(10, roundTo5(minutes * 0.25)))
  return [...pickLifts(lift, minutes - cardioMin, rng, avoid), ...pickCardio(cardioMin, rng, avoid)]
}

/** Swap one item for a different exercise from the same group (keeps sets/minutes). */
export function swapExercise(items: PlannedExercise[], index: number, rng: Rng = Math.random): PlannedExercise[] {
  const cur = BY_ID.get(items[index].exerciseId)
  if (!cur) return items
  const used = new Set(items.map((p) => p.exerciseId))
  const options = POOL.filter((e) => e.kind === cur.kind && e.group === cur.group && !used.has(e.id))
  if (options.length === 0) return items
  const next = options[Math.floor(rng() * options.length)]
  return items.map((p, i) =>
    i !== index ? p : cur.kind === 'cardio' ? { ...p, exerciseId: next.id } : { ...p, exerciseId: next.id, reps: repsFor(next, rng) },
  )
}
