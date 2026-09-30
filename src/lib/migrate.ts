/**
 * Saved data is read back on every launch. Older versions of the app saved fewer fields, and a crash mid-save or a
 * hand-edited backup can leave odd values, so everything is checked here and repaired instead of crashing the app.
 */
export const SCHEMA_VERSION = 2

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x)
const arr = <T,>(x: unknown, keep: (v: unknown) => v is T): T[] => (Array.isArray(x) ? x.filter(keep) : [])
const ISO = /^\d{4}-\d{2}-\d{2}$/

const isLog = (l: unknown): l is Obj =>
  isObj(l) && typeof l.exerciseId === 'string' && typeof l.date === 'string' && ISO.test(l.date) && (Array.isArray(l.sets) || isObj(l.cardio))
const isPlanned = (p: unknown): p is Obj => isObj(p) && typeof p.exerciseId === 'string'
const hasId = (x: unknown): x is Obj => isObj(x) && typeof x.id === 'string'

/** Repair a saved state object: wrong-typed fields fall back to `defaults`, bad entries are dropped. */
export function repairState<T extends Obj>(saved: unknown, defaults: T): T {
  if (!isObj(saved)) return defaults
  const out: Obj = { ...defaults }
  for (const [k, dv] of Object.entries(defaults)) {
    const v = saved[k]
    if (v === undefined || v === null) continue
    if (Array.isArray(dv)) { if (Array.isArray(v)) out[k] = v }
    else if (isObj(dv)) { if (isObj(v)) out[k] = { ...dv, ...v } }
    else if (typeof dv === typeof v) out[k] = v
  }
  // Field-specific checks.
  const plan = Array.isArray(saved.plan) && saved.plan.length === 7 ? saved.plan : null
  out.plan = plan ? plan.map((d) => arr(d, isPlanned)) : defaults.plan
  const overrides: Obj = {}
  if (isObj(saved.overrides)) for (const [d, items] of Object.entries(saved.overrides)) if (ISO.test(d) && Array.isArray(items)) overrides[d] = items.filter(isPlanned)
  out.overrides = overrides
  out.logs = arr(saved.logs, isLog)
  for (const k of ['custom', 'routines', 'goals', 'notifications', 'programs', 'timedLogs', 'measurements']) if (k in defaults) out[k] = arr(saved[k], hasId)
  out.bodyweight = arr(saved.bodyweight, (b): b is Obj => isObj(b) && typeof b.date === 'string' && typeof b.lb === 'number')
  // Keep anything the app no longer knows about (e.g. from a newer version) so it isn't lost.
  for (const [k, v] of Object.entries(saved)) if (!(k in out) && typeof v !== 'function') out[k] = v
  return out as T
}
