import type { Exercise, PlannedExercise } from '../types'
import { modeOf } from './exerciseModes'
import { isIsolation } from './randomUtil'

/** Warm-up sets (and drop sets) are for weight lifting: never bodyweight moves, core, cardio, holds or timed blocks. */
export const takesWarmup = (e?: Exercise) =>
  !!e && e.kind === 'strength' && (modeOf(e) ?? 'weight') === 'weight' && e.group !== 'Core' && e.equipment !== 'Bodyweight'

/**
 * Warm-up sets always sit on the first two weight-lifting exercises of the day, whatever the order: more before the
 * first (`first`, or the most the day already had), one fewer before the second. Days without warm-ups are untouched.
 */
export function placeWarmups(items: PlannedExercise[], lookup: (id: string) => Exercise | undefined, first?: number): PlannedExercise[] {
  const top = first ?? Math.max(0, ...items.map((p) => p.warmupSets ?? 0))
  if (!top) return items
  const counts = [Math.max(2, top), Math.max(2, top) - 1]
  let n = 0
  let changed = false
  const out = items.map((p) => {
    const want = n < 2 && !p.warmup && !p.wod && takesWarmup(lookup(p.exerciseId)) ? counts[n++] : undefined
    if (p.warmupSets === want) return p
    changed = true
    const { warmupSets: _old, ...rest } = p
    void _old
    return want ? { ...rest, warmupSets: want } : rest
  })
  return changed ? out : items
}

/** Lifts that need balance, speed or a spotter when you're near failure: never for drop sets unless a machine guides them. */
const RISKY = /clean|snatch|jerk|deadlift|good morning|lunge|step.?up|squat|swing|thruster|split|renegade|plank|bent.?over/i

/**
 * How safe a lift is to take to failure and strip weight from straight away (0 = not at all): a machine with a pin or
 * lever is the safest, then cables, a Smith machine, then dumbbells. Never a barbell, kettlebell or anything balanced.
 */
export function dropSafety(e?: Exercise): number {
  if (!takesWarmup(e)) return 0
  const smith = /smith/i.test(e!.name)
  if (e!.equipment === 'Machine' && !smith) return 4
  if (RISKY.test(e!.name)) return 0
  if (e!.equipment === 'Cable') return 3
  if (smith) return 2
  if (e!.equipment === 'Dumbbell') return 1
  return 0
}

/** Bigger muscles first: they get the most from extra sets. */
export const DROP_SIZE = ['Quads', 'Glutes', 'Back', 'Hamstrings', 'Chest', 'Shoulders', 'Triceps', 'Biceps', 'Calves']
/** Groups that work the same muscles hard (a chest press uses the shoulders and triceps; a row, the biceps). */
const OVERLAP = new Set(['Chest|Shoulders', 'Chest|Triceps', 'Shoulders|Triceps', 'Back|Biceps', 'Quads|Glutes', 'Glutes|Hamstrings'])
/** Different muscles, but both legs: fine on a leg day, second choice when the day has an upper-body group too. */
const bothLegs = (a: string, b: string) => ['Quads', 'Hamstrings', 'Calves'].includes(a) && ['Quads', 'Hamstrings', 'Calves'].includes(b)
const overlaps = (a: string, b: string) => a === b || OVERLAP.has(`${a}|${b}`) || OVERLAP.has(`${b}|${a}`)

/**
 * The two muscle groups that should get drop sets, from those given: always two different groups; then ones that
 * didn't get them last time (`recent`), so they move around day to day (just one if the only partner would be a
 * repeat); then two that don't overlap (chest and back, legs and shoulders, rather than chest and shoulders); then the
 * biggest. `first` fixes one of them.
 */
export function dropGroups(groups: readonly string[], recent: readonly string[] = [], first?: string): string[] {
  const all = [...new Set(groups)].filter((g) => DROP_SIZE.includes(g))
  const size = (g: string) => DROP_SIZE.indexOf(g)
  const order = (a: string, b: string) => (recent.includes(a) ? 1 : 0) - (recent.includes(b) ? 1 : 0) || size(a) - size(b)
  const firsts = first ? [first] : all
  let best: string[] = []
  let bestScore = Infinity
  for (const a of firsts) for (const b of all) {
    if (a === b) continue
    const score = (recent.includes(a) ? 1000 : 0) + (recent.includes(b) ? 1000 : 0) + (overlaps(a, b) ? 100 : 0) + (bothLegs(a, b) ? 4 : 0) + size(a) + size(b)
    if (score < bestScore) { bestScore = score; best = first ? [a, b] : [a, b].sort(order) }
  }
  // Rather than repeat a muscle from last time next to a fresh one, just the fresh one.
  const fresh = best.filter((g) => !recent.includes(g))
  if (best.length && fresh.length === 1 && (!first || fresh[0] === first)) return fresh
  if (best.length) return best
  const one = first ?? [...all].sort(order)[0]
  return one ? [one] : []
}

/** The muscle groups a day's drop sets went on. */
export const dropGroupsOf = (items: readonly PlannedExercise[], lookup: (id: string) => Exercise | undefined): string[] =>
  [...new Set(items.filter((p) => p.dropSets).map((p) => lookup(p.exerciseId)?.group).filter((g): g is string => !!g))]

/**
 * Drop sets for a generated workout: two drops on up to two lifts for the biggest muscles, never two for the same
 * muscle group, on the safest lifts the day has (machines and cables before dumbbells; never a barbell or balance
 * lift). E.g. leg press and machine shoulder press, or chest press and lat pulldown. Groups in `recent` (where the last
 * workout's drop sets went) come last, so they move around from day to day.
 */
export function addDropSets(items: PlannedExercise[], lookup: (id: string) => Exercise | undefined, drops = 2, recent: readonly string[] = []): PlannedExercise[] {
  const ok = (p: PlannedExercise) => !p.warmup && !p.wod && !(p.block && !p.block.includes('ss')) && dropSafety(lookup(p.exerciseId)) > 0 && DROP_SIZE.includes(lookup(p.exerciseId)!.group)
  const idx = items.map((p, i) => (ok(p) ? i : -1)).filter((i) => i >= 0)
  const groupOf = (i: number) => lookup(items[i].exerciseId)!.group
  const safety = (i: number) => dropSafety(lookup(items[i].exerciseId))
  // Machines and cables first (dumbbells only when a group has nothing safer), then the biggest muscles.
  const safe = idx.filter((i) => safety(i) >= 3)
  const groups = dropGroups((safe.length ? safe : idx).map(groupOf), recent)
  if (safe.length && groups.length < 2) {
    const others = idx.map(groupOf).filter((g) => !overlaps(groups[0], g))
    const more = dropGroups([groups[0], ...others], recent, groups[0])[1]
    if (more) groups.push(more)
  }
  // In each group, the safest lift, then a compound one (a chest press over a fly), then the later one.
  const compound = (i: number) => (isIsolation(lookup(items[i].exerciseId)!) ? 0 : 1)
  const pick = groups.map((g) => idx.filter((i) => groupOf(i) === g).sort((a, b) => safety(b) - safety(a) || compound(b) - compound(a) || b - a)[0])
  return items.map((p, i) => (pick.includes(i) ? { ...p, dropSets: drops } : p))
}
