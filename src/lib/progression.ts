import type { Exercise, ExerciseLog, StrengthSet, Units } from '../types'
import { epley } from './stats'
import { familyOf } from './randomUtil'
import { formatSeconds, showWeight } from './units'

/** Working sets with data (warm-ups and drop sets left out). */
export const workSets = (l?: ExerciseLog): StrengthSet[] => (l?.sets ?? []).filter((s) => !s.warmup && !s.drop && (s.weight || s.reps || s.seconds))
/** A set with added weight. Reps with no weight (blank or 0) on a weighted lift is a bodyweight set: dips, pull-ups, an ab roller. */
const loaded = (s: StrengthSet) => !!s.weight && s.weight > 0 && !!s.reps

/**
 * How a session of a lift is measured. With any weighted working set: by load (estimated max). With only bodyweight
 * sets: by reps. Sessions measured differently aren't compared with each other.
 */
export function sessionBasis(l: ExerciseLog | undefined, mode: Exercise['mode'], kind: Exercise['kind']): 'load' | 'reps' | 'time' | 'cardio' | null {
  if (!l) return null
  if (kind === 'cardio') return l.cardio?.distance || l.cardio?.minutes ? 'cardio' : null
  const sets = workSets(l)
  if (mode === 'time') return sets.some((s) => s.seconds) ? 'time' : null
  if (mode !== 'reps' && sets.some(loaded)) return 'load'
  return sets.some((s) => s.reps) ? 'reps' : null
}

/** Drop sets with data. */
export const dropSetsOf = (l?: ExerciseLog): StrengthSet[] => (l?.sets ?? []).filter((s) => s.drop && (s.weight || s.reps))

const LOWER = ['Quads', 'Hamstrings', 'Glutes', 'Legs']

/** The weight step for a lift, in pounds: bigger jumps for heavy lower-body barbell work, small ones for dumbbells. */
export function weightStep(ex: Exercise, units: Units): number {
  const kg = units.weight === 'kg'
  const big = ex.equipment === 'Barbell' && LOWER.includes(ex.group)
  return kg ? (big ? 5 : 2.5) * 2.20462262 : big ? 10 : 5
}

/** The smallest sensible jump for a lift, in pounds: 5 lb (2.5 kg) for most things; 10 lb (5 kg) only for heavy lower-body barbell work, where 5 lb is under 2.5%. */
export function progressStep(ex: Exercise, top: number, units: Units): number {
  const kg = units.weight === 'kg'
  const heavyLegs = ex.equipment === 'Barbell' && LOWER.includes(ex.group) && top >= (kg ? 90 * 2.20462262 : 200)
  return kg ? (heavyLegs ? 5 : 2.5) * 2.20462262 : heavyLegs ? 10 : 5
}

/** What to aim for on one working set. Weight in pounds. */
export interface SetTarget { weight?: number | null; reps?: number | null; seconds?: number | null }

export interface Suggestion {
  /** The headline target (the set or sets that change). Weight in pounds. */
  weight?: number | null
  reps?: number | null
  seconds?: number | null
  /** One-line reason, e.g. "You did 135 lb × 8 on all 3 sets. Add a rep to 2 of them". */
  why: string
  kind: 'add-weight' | 'add-reps' | 'add-time' | 'add-sets' | 'repeat' | 'first' | 'deload' | 'estimate'
  /** Every working set, in order: the one or two that change, and the rest as last time. */
  sets?: SetTarget[]
  /** How many sets carry the change. */
  changed?: number
}

/** Progress a little at a time: one or two sets per session, the rest repeat last time. */
const PER_SESSION = 2

/** What to aim for the first time, by how the exercise is logged. */
const FIRST: Record<NonNullable<Exercise['mode']>, string> = {
  weight: 'First time: pick a weight you could lift a couple more times, and log it.',
  reps: 'First time: stop a couple of reps short of failure, and log it.',
  time: 'First time: hold until your form starts to slip, and log it.',
}

/**
 * "Try this next", the slow way that holds up: double progression a set or two at a time.
 *
 * - A rep range: reps go up first (one rep on one or two sets per session), weight only once every working set has hit
 *   the target and it's held (2 reps over on a set, or the target two sessions running: the NSCA "2-for-2" rule).
 * - When weight goes up it's the smallest practical jump (5 lb / 2.5 kg, 10 lb / 5 kg on heavy squats and deadlifts;
 *   ACSM suggests 2-10%) on one or two sets only; the next sessions bring the other sets up to it.
 * - A jump that's big for the load (over 7.5%, e.g. 35 to 40 lb dumbbells) waits until every set reaches target + 2.
 * - More sets planned than last time is progress enough for one session.
 * - Bodyweight moves add a rep, holds add 5 seconds, on one or two sets. Stuck 3 sessions: a ~10% deload.
 */
export function suggestNext(
  ex: Exercise,
  last: ExerciseLog | undefined,
  target: { reps?: number; seconds?: number; sets?: number },
  units: Units,
  /** Earlier sessions of this exercise, newest first, starting with `last`. Used to spot a plateau. */
  history: ExerciseLog[] = [],
): Suggestion {
  const done = workSets(last)
  const mode = ex.mode ?? 'weight'
  if (done.length === 0) return { kind: 'first', why: FIRST[mode], reps: target.reps ?? null, seconds: target.seconds ?? null }
  const n = Math.max(1, target.sets ?? done.length)
  const lb = (w: number) => `${showWeight(w, units)} ${units.weight}`
  const plural = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`
  // Last time's sets, set by set (more planned now: the extras repeat the last set).
  const base: SetTarget[] = Array.from({ length: n }, (_, i) => {
    const d = done[Math.min(i, done.length - 1)]
    return { weight: mode === 'weight' ? d.weight ?? null : null, reps: mode === 'time' ? null : d.reps ?? null, seconds: mode === 'time' ? d.seconds ?? null : null }
  })
  const out = (kind: Suggestion['kind'], sets: SetTarget[], idx: number[], why: string): Suggestion => {
    const head = sets[idx[0] ?? 0]
    return { kind, sets, changed: idx.length, weight: head.weight ?? null, reps: head.reps ?? null, seconds: head.seconds ?? null, why }
  }
  if (n > done.length) {
    const extra = Array.from({ length: n - done.length }, (_, i) => done.length + i)
    return out('add-sets', base, extra, `${plural(n - done.length, 'more set')} than last time: that's the step up. Keep last time's numbers.`)
  }
  // The sets to push: the lowest scoring ones (by `score`), up to two, earliest first on ties.
  const pick = (score: (t: SetTarget) => number, ok: (t: SetTarget) => boolean = () => true) =>
    base.map((t, i) => ({ i, v: score(t) })).filter(({ i }) => ok(base[i])).sort((a, b) => a.v - b.v || a.i - b.i).slice(0, PER_SESSION).map((x) => x.i).sort((a, b) => a - b)
  const bump = (idx: number[], f: (t: SetTarget) => SetTarget) => base.map((t, i) => (idx.includes(i) ? f(t) : t))

  if (mode === 'time') {
    const idx = pick((t) => t.seconds ?? 0)
    const low = base[idx[0]].seconds ?? 0
    return out('add-time', bump(idx, (t) => ({ ...t, seconds: (t.seconds ?? 0) + 5 })), idx, `Add 5 seconds to ${idx.length === n ? (n === 1 ? 'it' : 'each set') : plural(idx.length, 'set')} (${low}s last time); repeat the rest.`)
  }
  const top = mode === 'weight' ? Math.max(...done.map((s) => s.weight ?? 0)) : 0
  if (mode === 'reps' || top <= 0) {
    // Reps moves, and weighted lifts done with bodyweight last time: a rep more on one or two sets.
    const idx = pick((t) => t.reps ?? 0)
    const low = base[idx[0]].reps ?? 0
    return out('add-reps', bump(idx, (t) => ({ ...t, weight: null, reps: (t.reps ?? 0) + 1 })), idx,
      `${top <= 0 && mode === 'weight' ? 'Bodyweight: a' : 'A'}dd a rep to ${idx.length === n ? (n === 1 ? 'it' : 'each set') : `your ${idx.length === 1 ? 'lowest set' : `${idx.length} lowest sets`}`} (${low} last time); repeat the rest.`)
  }

  const atTop = base.filter((t) => t.weight === top)
  const goal = target.reps ?? Math.max(...atTop.map((t) => t.reps ?? 0))
  const topHit = atTop.every((t) => (t.reps ?? 0) >= goal)
  const tooHard = done.some((s) => s.weight === top && (s.rpe ?? 0) >= 10)

  // Some sets were lighter (working up, or partway through a jump): bring one or two more up to the top weight.
  const lighter = base.some((t) => (t.weight ?? 0) < top)
  if (lighter && topHit && !tooHard) {
    const idx = pick((t) => -(t.weight ?? 0), (t) => (t.weight ?? 0) < top)
    return out('add-weight', bump(idx, (t) => ({ ...t, weight: top, reps: goal })), idx,
      `You did ${lb(top)} × ${goal} on ${atTop.length} of ${n} sets. Bring ${idx.length === 1 ? 'one more' : `${idx.length} more`} up to ${lb(top)}.`)
  }

  if (!topHit) {
    const stalled = plateau(ex, history)
    if (stalled) {
      const step = weightStep(ex, units)
      const deload = Math.max(step, Math.round((top * 0.9) / step) * step)
      const sets = base.map(() => ({ weight: deload, reps: goal }))
      return { kind: 'deload', sets, changed: n, weight: deload, reps: goal, why: `No progress in your last ${stalled} sessions at ${lb(top)}. Drop to about 90% and build back up past it.` }
    }
    const idx = pick((t) => (t.weight === top ? t.reps ?? 0 : Infinity), (t) => t.weight === top && (t.reps ?? 0) < goal)
    const low = base[idx[0]].reps ?? 0
    return out('add-reps', bump(idx, (t) => ({ ...t, reps: Math.min(goal, (t.reps ?? 0) + 1) })), idx,
      `Same ${lb(top)}. Add a rep to your ${idx.length === 1 ? 'lowest set' : `${idx.length} lowest sets`} (${low} last time) on the way to ${goal}.`)
  }

  // Every set hit the target at the top weight.
  if (tooHard) return out('repeat', base, [], `That felt maxed out last time. Repeat ${lb(top)} × ${goal} and own every rep.`)
  const step = progressStep(ex, top, units)
  const big = step / top > 0.075
  const over = base.some((t) => (t.reps ?? 0) >= goal + 2)
  const prev = history[1] ? workSets(history[1]) : []
  const twice = prev.length >= n && prev.every((s) => s.weight === top && (s.reps ?? 0) >= goal)
  const ready = big ? base.every((t) => (t.reps ?? 0) >= goal + 2) : over || twice
  if (ready) {
    const idx = Array.from({ length: Math.min(PER_SESSION, n) }, (_, i) => i)
    return out('add-weight', bump(idx, () => ({ weight: top + step, reps: goal })), idx,
      `You've owned ${lb(top)} × ${goal}${twice && !over ? ' two sessions running' : ''}. Add ${lb(step)} to ${idx.length === n ? (n === 1 ? 'it' : 'each set') : `the first ${plural(idx.length, 'set')}`}; keep the rest at ${lb(top)}.`)
  }
  const cap = goal + 2
  const idx = pick((t) => t.reps ?? 0, (t) => (t.reps ?? 0) < cap)
  return out('add-reps', bump(idx, (t) => ({ ...t, reps: (t.reps ?? 0) + 1 })), idx,
    big
      ? `You hit ${goal} on every set. The next weight up (${lb(top + step)}) is a big jump, so build to ${cap} reps first: add a rep to ${plural(idx.length, 'set')}.`
      : `You hit ${goal} on every set at ${lb(top)}. Add a rep to ${plural(idx.length, 'set')}; add weight once it holds.`)
}

/**
 * Rough load per piece of kit compared with a barbell, for the same movement: each dumbbell is about 40% of the bar
 * (a 185 bench ≈ 70s), cables a bit over half. Rough on purpose; the estimate is then trimmed to stay on the safe side.
 */
const LOAD: Record<string, number> = { Barbell: 1, 'EZ bar': 0.9, Machine: 1, Cable: 0.6, Dumbbell: 0.4, Kettlebell: 0.4 }
/** Close movements in different families (incline pressing is about 80% of flat). */
const NEAR: Record<string, [string, number][]> = { incline: [['bench', 0.8]], bench: [['incline', 1.2]] }

/**
 * A starting weight for a lift they've never logged, from the most recent similar lift they have (same movement, same
 * muscle): its best set's estimated max, scaled for the equipment, cut 10% to be safe, then worked back to `reps`.
 * Null when there's nothing close enough to go on.
 */
export function estimateStart(
  ex: Exercise,
  logs: ExerciseLog[],
  reps: number | undefined,
  units: Units,
  lookup: (id: string) => Exercise | undefined,
): Suggestion | null {
  if ((ex.mode ?? 'weight') !== 'weight' || !LOAD[ex.equipment ?? '']) return null
  const fam = familyOf(ex)
  if (!fam) return null
  const near = new Map<string, number>([[fam, 1], ...(NEAR[fam] ?? [])])
  const goal = reps ?? 10
  const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date))
  for (const l of recent) {
    if (l.exerciseId === ex.id) continue
    const src = lookup(l.exerciseId)
    const f = src && familyOf(src)
    if (!src || !f || !near.has(f) || src.group !== ex.group || (src.mode ?? 'weight') !== 'weight' || !LOAD[src.equipment ?? '']) continue
    const sets = workSets(l).filter((s) => s.weight && s.reps)
    if (sets.length === 0) continue
    const best = sets.reduce((a, s) => (epley(s.weight!, s.reps!) > epley(a.weight!, a.reps!) ? s : a))
    const max = epley(best.weight!, best.reps!) * near.get(f)! * (LOAD[ex.equipment!] / LOAD[src.equipment!]) * 0.9
    const step = weightStep(ex, units)
    const weight = Math.floor(max / (1 + goal / 30) / step) * step
    if (weight <= 0) return null
    return {
      kind: 'estimate', weight, reps: goal,
      why: `New lift: estimated from your ${src.name} (${showWeight(best.weight!, units)}×${best.reps}). Go lighter if it feels heavy.`,
    }
  }
  return null
}

/**
 * Stuck at the same weight for 3+ sessions without beating your best set there: returns how many sessions, else 0.
 * A short step back (a deload) is the standard fix for a plateau.
 */
export function plateau(ex: Exercise, history: ExerciseLog[]): number {
  if ((ex.mode ?? 'weight') !== 'weight') return 0
  const recent = history.filter((l) => workSets(l).length > 0).slice(0, 4)
  if (recent.length < 3) return 0
  const tops = recent.map((l) => Math.max(...workSets(l).map((s) => s.weight ?? 0)))
  // Bodyweight sets have no weight to drop: no deload.
  if (tops[0] <= 0) return 0
  const same = tops.findIndex((t) => t !== tops[0])
  const run = same === -1 ? tops.length : same
  if (run < 3) return 0
  // Total reps at that weight: a rep gained on any set is progress (progress comes a set or two at a time).
  const best = (l: ExerciseLog) => workSets(l).filter((s) => s.weight === tops[0]).reduce((a, s) => a + (s.reps ?? 0), 0)
  const scores = recent.slice(0, run).map(best) // newest first
  // No improvement: the newest session is no better than the oldest in the run.
  return scores[0] <= scores[run - 1] ? run : 0
}

/** How a set compares with the same set last time: better, same, or worse (null if nothing to compare). */
export function compareSet(now: StrengthSet, then: StrengthSet | undefined, mode: Exercise['mode']): 'up' | 'same' | 'down' | null {
  if (!then || now.warmup || then.warmup) return null
  // A weighted lift done with bodyweight both times compares reps; weighted against bodyweight doesn't compare.
  const byReps = mode === 'reps' || (mode !== 'time' && !loaded(now) && !loaded(then))
  if (mode !== 'time' && !byReps && !(loaded(now) && loaded(then))) return null
  const score = (s: StrengthSet) => (mode === 'time' ? s.seconds ?? 0 : byReps ? s.reps ?? 0 : epley(s.weight!, s.reps!))
  const a = score(now)
  const b = score(then)
  if (!a || !b) return null
  return a > b + 0.01 ? 'up' : a < b - 0.01 ? 'down' : 'same'
}

/**
 * One number per session to compare against last time: best est. 1RM (weighted sets), best reps (bodyweight or reps
 * moves) or longest hold. Check `sessionBasis` before comparing two of them.
 */
export function sessionScore(l: ExerciseLog | undefined, mode: Exercise['mode'], kind: Exercise['kind']): number {
  if (!l) return 0
  if (kind === 'cardio') return l.cardio?.distance ?? l.cardio?.minutes ?? 0
  const sets = workSets(l)
  if (mode === 'time') return Math.max(0, ...sets.map((s) => s.seconds ?? 0))
  if (sessionBasis(l, mode, kind) === 'load') return Math.max(0, ...sets.filter(loaded).map((s) => epley(s.weight!, s.reps!)))
  return Math.max(0, ...sets.map((s) => s.reps ?? 0))
}

/** One set for display: "185×5", "12 reps" (bodyweight on a weighted lift), "12" (reps moves) or "0:45" (holds). */
export function formatSet(s: StrengthSet, mode: Exercise['mode'], units: Units): string {
  if (mode === 'time') return s.seconds ? formatSeconds(s.seconds) : '–'
  // Reps only, with any weight shown (sets logged before the exercise was switched to bodyweight keep their load).
  if (mode === 'reps') return s.reps ? (s.weight ? `${showWeight(s.weight, units)}×${s.reps}` : `${s.reps}`) : '–'
  if (!s.weight) return s.reps ? `${s.reps} reps` : '–'
  return `${showWeight(s.weight, units)}×${s.reps ?? '–'}`
}

/** Total work in a session: weight × reps, total reps, or total seconds. */
export function sessionVolume(l: ExerciseLog | undefined, mode: Exercise['mode']): number {
  const sets = workSets(l)
  if (mode === 'time') return sets.reduce((a, s) => a + (s.seconds ?? 0), 0)
  if (mode === 'reps') return sets.reduce((a, s) => a + (s.reps ?? 0), 0)
  return sets.reduce((a, s) => a + (s.weight ?? 0) * (s.reps ?? 0), 0)
}

/** Plates per side for a barbell load (in the person's units), greedy from the heaviest plate. */
export function platesFor(total: number, units: Units): { bar: number; perSide: number[]; left: number } {
  const kg = units.weight === 'kg'
  const bar = kg ? 20 : 45
  const plates = kg ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5]
  let side = Math.max(0, (total - bar) / 2)
  const perSide: number[] = []
  for (const p of plates) while (side >= p - 1e-9) { perSide.push(p); side -= p }
  return { bar, perSide, left: Math.round(side * 2 * 100) / 100 }
}
