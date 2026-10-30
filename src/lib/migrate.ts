import { expandParts, partFromName } from './bodyParts'
import { cleanAcceptance } from './legal'
import { WEIGHT_GEAR } from './exerciseModes'

/**
 * Saved data is read back on every launch. Older versions of the app saved fewer fields, and a crash mid-save or a
 * hand-edited backup can leave odd values, so everything is checked here and repaired instead of crashing the app.
 */
export const SCHEMA_VERSION = 3

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x)
const arr = <T,>(x: unknown, keep: (v: unknown) => v is T): T[] => (Array.isArray(x) ? x.filter(keep) : [])
const ISO = /^\d{4}-\d{2}-\d{2}$/

const isLog = (l: unknown): l is Obj =>
  isObj(l) && typeof l.exerciseId === 'string' && typeof l.date === 'string' && ISO.test(l.date) && (Array.isArray(l.sets) || isObj(l.cardio))
/** A number that can be shown and added up (not NaN, Infinity, a string or negative), else null. */
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)
/** Keys that would change an object's prototype if copied: never taken from saved or imported data. */
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype'])
/** A logged set or cardio entry with its numbers checked: damaged or hand-edited values become empty, not NaN. */
function cleanLog(l: Obj): Obj {
  const out: Obj = { ...l }
  if (Array.isArray(l.sets)) {
    out.sets = l.sets.filter(isObj).map((x) => ({
      ...x,
      weight: num(x.weight), reps: num(x.reps),
      ...('seconds' in x ? { seconds: num(x.seconds) } : {}),
      ...('rpe' in x ? { rpe: num(x.rpe) } : {}),
    }))
  }
  if (isObj(l.cardio)) {
    const c = l.cardio
    out.cardio = { ...c, distance: num(c.distance), minutes: num(c.minutes), ...('calories' in c ? { calories: num(c.calories) } : {}), ...('incline' in c ? { incline: num(c.incline) } : {}) }
  }
  return out
}
const isPlanned = (p: unknown): p is Obj => isObj(p) && typeof p.exerciseId === 'string'
const hasId = (x: unknown): x is Obj => isObj(x) && typeof x.id === 'string'

// Exercises that were logged as timed sets in older versions and are cardio (time and distance) now.
const NOW_CARDIO = new Set(['x-skierg', 'x-row-erg'])
function toCardioLog(l: Obj): Obj {
  if (!NOW_CARDIO.has(l.exerciseId as string) || isObj(l.cardio) || !Array.isArray(l.sets)) return l
  const secs = l.sets.reduce((a: number, x: unknown) => a + (isObj(x) && typeof x.seconds === 'number' ? x.seconds : 0), 0)
  const { sets: _sets, ...rest } = l
  void _sets
  return { ...rest, cardio: { distance: null, minutes: secs > 0 ? Math.max(1, Math.round(secs / 60)) : null } }
}

/** Repair a saved state object: wrong-typed fields fall back to `defaults`, bad entries are dropped. */
export function repairState<T extends Obj>(saved: unknown, defaults: T): T {
  if (!isObj(saved)) return defaults
  const out: Obj = { ...defaults }
  for (const [k, dv] of Object.entries(defaults)) {
    if (UNSAFE.has(k)) continue
    const v = saved[k]
    if (v === undefined || v === null) continue
    // A null default (e.g. backendKind, session) takes any plain value; before, a saved string was dropped here.
    if (dv === null) { if (typeof v !== 'function') out[k] = v }
    else if (Array.isArray(dv)) { if (Array.isArray(v)) out[k] = v }
    else if (isObj(dv)) { if (isObj(v)) out[k] = { ...dv, ...Object.fromEntries(Object.entries(v).filter(([kk]) => !UNSAFE.has(kk))) } }
    else if (typeof dv === typeof v) out[k] = v
  }
  // Field-specific checks.
  const plan = Array.isArray(saved.plan) && saved.plan.length === 7 ? saved.plan : null
  out.plan = plan ? plan.map((d) => arr(d, isPlanned)) : defaults.plan
  const overrides: Obj = {}
  if (isObj(saved.overrides)) for (const [d, items] of Object.entries(saved.overrides)) if (ISO.test(d) && Array.isArray(items)) overrides[d] = items.filter(isPlanned)
  out.overrides = overrides
  out.logs = arr(saved.logs, isLog).map(toCardioLog).map(cleanLog)
  for (const k of ['custom', 'routines', 'goals', 'notifications', 'programs', 'timedLogs', 'measurements', 'benchmarks']) if (k in defaults) out[k] = arr(saved[k], hasId)
  // Legs and Arms became body parts (Quads, Hamstrings, Calves; Biceps, Triceps): file older exercises and choices.
  if (Array.isArray(out.custom)) out.custom = (out.custom as Obj[]).map((e) => (typeof e.group === 'string' && typeof e.name === 'string' ? { ...e, group: partFromName(e.group, e.name) } : e))
  if (isObj(out.genPrefs) && Array.isArray(out.genPrefs.focus)) out.genPrefs = { ...out.genPrefs, focus: expandParts(out.genPrefs.focus.filter((f): f is string => typeof f === 'string')) }
  out.bodyweight = arr(saved.bodyweight, (b): b is Obj => isObj(b) && typeof b.date === 'string' && ISO.test(b.date) && num(b.lb) != null && (b.lb as number) > 0)
    // In date order (goals and charts read the latest as the last), as logging keeps them.
    .sort((a, b) => (a.date as string).localeCompare(b.date as string))
  // How the person tracks particular exercises (with weight, or bodyweight reps only): only known modes are kept.
  if ('exerciseModes' in defaults) {
    const modes: Obj = {}
    if (isObj(saved.exerciseModes)) for (const [id, m] of Object.entries(saved.exerciseModes)) if (m === 'weight' || m === 'reps' || m === 'time') modes[id] = m
    out.exerciseModes = modes
  }
  if ('legalAccepted' in defaults) out.legalAccepted = cleanAcceptance(saved.legalAccepted)
  if ('warmupsDone' in defaults) out.warmupsDone = [...new Set(arr(saved.warmupsDone, (d): d is string => typeof d === 'string' && ISO.test(d)))]
  if ('exerciseGear' in defaults) {
    const gear: Obj = {}
    if (isObj(saved.exerciseGear)) for (const [id, g] of Object.entries(saved.exerciseGear)) if (!UNSAFE.has(id) && (WEIGHT_GEAR as readonly unknown[]).includes(g)) gear[id] = g
    out.exerciseGear = gear
  }
  if ('favorites' in defaults) out.favorites = [...new Set(arr(saved.favorites, (f): f is string => typeof f === 'string'))]
  // Keep anything the app no longer knows about (e.g. from a newer version) so it isn't lost.
  for (const [k, v] of Object.entries(saved)) if (!UNSAFE.has(k) && !(k in out) && typeof v !== 'function') out[k] = v
  return out as T
}
