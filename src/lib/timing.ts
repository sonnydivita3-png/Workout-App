import type { Exercise, PlannedExercise } from '../types'

/**
 * How long lifting actually takes. A set is the work (about 3.5 s per rep plus ~15 s to get set, or the hold time)
 * followed by rest, except after the last set. Rest depends on how heavy the set is, following common guidance
 * (NSCA and others): 2-3 min for heavy sets of 1-5 reps, about 2 min for 6-8, 90 s for 9-12, 60 s for lighter or
 * bodyweight work. Moving between exercises (loading a bar, finding a bench) takes another minute or so.
 */
export type RestPref = 'short' | 'normal' | 'long'
export const REST_SCALE: Record<RestPref, number> = { short: 0.6, normal: 1, long: 1.35 }

const SEC_PER_REP = 3.5
const SET_SETUP = 15
/** Warm-up sets are light, with short rests. */
export const WARMUP_SET_MIN = 1.25

/** Seconds of rest after a set of this exercise, before scaling by preference. */
export function baseRest(ex: Exercise | undefined, reps?: number, seconds?: number): number {
  if (!ex || ex.kind === 'cardio') return 0
  if (ex.mode === 'time' || seconds) return 45
  if (ex.group === 'Core') return 45
  if (ex.mode === 'reps' || ex.equipment === 'Bodyweight') return 60
  const r = reps ?? 10
  const rest = r <= 5 ? 150 : r <= 8 ? 120 : r <= 12 ? 90 : 60
  // Small isolation moves recover faster even at low reps.
  return /curl|raise|fly|flye|extension|kickback|crossover|shrug|pushdown|lateral|wrist|calf/i.test(ex.name) ? Math.min(rest, 75) : rest
}

export const restFor = (ex: Exercise | undefined, reps?: number, seconds?: number, pref: RestPref = 'normal') =>
  Math.round((baseRest(ex, reps, seconds) * REST_SCALE[pref]) / 15) * 15

/** Seconds of work in one set. */
export const workSeconds = (p: Pick<PlannedExercise, 'reps' | 'seconds'>) => (p.seconds ? p.seconds + 10 : (p.reps ?? 10) * SEC_PER_REP + SET_SETUP)

/** Minutes to move to an exercise and get it ready. */
export const transitionMin = (ex: Exercise | undefined) => (ex?.equipment === 'Barbell' ? 1.5 : ex?.equipment === 'Bodyweight' ? 0.5 : 1)

/** Realistic minutes for one planned lift: warm-up sets, working sets, rests between them, and getting set up. */
export function liftMinutes(p: PlannedExercise, ex: Exercise | undefined, pref: RestPref = 'normal'): number {
  if (!ex) return 0
  if (ex.kind === 'cardio') return p.minutes ?? 0
  const rest = p.rest ?? restFor(ex, p.reps, p.seconds, pref)
  const sets = Math.max(1, p.sets)
  const secs = sets * workSeconds(p) + (sets - 1) * rest
  return Math.round((secs / 60 + (p.warmupSets ?? 0) * WARMUP_SET_MIN + transitionMin(ex)) * 10) / 10
}

/** Minutes one more working set adds. */
export const extraSetMinutes = (p: PlannedExercise, ex: Exercise | undefined, pref: RestPref = 'normal') =>
  (workSeconds(p) + (p.rest ?? restFor(ex, p.reps, p.seconds, pref))) / 60

/** Warm-up ramp for a working weight: lighter sets with fewer reps as the weight goes up. */
export function warmupRamp(count: number): { pct: number; reps: number }[] {
  if (count <= 0) return []
  if (count === 1) return [{ pct: 0.6, reps: 5 }]
  if (count === 2) return [{ pct: 0.5, reps: 8 }, { pct: 0.75, reps: 3 }]
  return [{ pct: 0.4, reps: 8 }, { pct: 0.6, reps: 5 }, { pct: 0.8, reps: 2 }].slice(0, count)
}
