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
const overlaps = (a: string, b: string) => a === b || OVERLAP.has(`${a}|${b}`) || OVERLAP.has(`${b}|${a}`)

/**
 * The muscle groups that should get drop sets, from those given (biggest first): the biggest, then the biggest that
 * doesn't overlap it (chest and back, legs and shoulders), else at least a different group (chest and shoulders on a
 * push day).
 */
export function dropGroups(groups: readonly string[]): string[] {
  const sorted = [...new Set(groups)].filter((g) => DROP_SIZE.includes(g)).sort((a, b) => DROP_SIZE.indexOf(a) - DROP_SIZE.indexOf(b))
  if (!sorted.length) return []
  const second = sorted.find((g) => !overlaps(sorted[0], g)) ?? sorted.find((g) => g !== sorted[0])
  return second ? [sorted[0], second] : [sorted[0]]
}

/**
 * Drop sets for a generated workout: two drops on up to two lifts for the biggest muscles, never two for the same
 * muscle group, on the safest lifts the day has (machines and cables before dumbbells; never a barbell or balance
 * lift). E.g. leg press and machine shoulder press, or chest press and lat pulldown.
 */
export function addDropSets(items: PlannedExercise[], lookup: (id: string) => Exercise | undefined, drops = 2): PlannedExercise[] {
  const ok = (p: PlannedExercise) => !p.warmup && !p.wod && !(p.block && !p.block.includes('ss')) && dropSafety(lookup(p.exerciseId)) > 0 && DROP_SIZE.includes(lookup(p.exerciseId)!.group)
  const idx = items.map((p, i) => (ok(p) ? i : -1)).filter((i) => i >= 0)
  const groupOf = (i: number) => lookup(items[i].exerciseId)!.group
  const safety = (i: number) => dropSafety(lookup(items[i].exerciseId))
  // Machines and cables first (dumbbells only when a group has nothing safer), then the biggest muscles.
  const safe = idx.filter((i) => safety(i) >= 3)
  const groups = dropGroups((safe.length ? safe : idx).map(groupOf))
  if (safe.length && groups.length < 2) {
    const more = dropGroups(idx.map(groupOf)).find((g) => !groups.includes(g) && !overlaps(groups[0], g))
    if (more) groups.push(more)
  }
  // In each group, the safest lift, then a compound one (a chest press over a fly), then the later one.
  const compound = (i: number) => (isIsolation(lookup(items[i].exerciseId)!) ? 0 : 1)
  const pick = groups.map((g) => idx.filter((i) => groupOf(i) === g).sort((a, b) => safety(b) - safety(a) || compound(b) - compound(a) || b - a)[0])
  return items.map((p, i) => (pick.includes(i) ? { ...p, dropSets: drops } : p))
}
