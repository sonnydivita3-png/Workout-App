import { checkPlan, type Plan } from './plan'
import type { DayLog, ExerciseLog, ItemLog, SetLog } from './store'

/** A backup file: the plan, the log and the weigh-ins. */
export interface Backup {
  format: 'durata-backup'
  version: 1
  exportedAt: string
  plan: Plan | null
  logs: Record<string, DayLog>
  weights: Record<string, number>
}

export function makeBackup(plan: Plan | null, logs: Record<string, DayLog>, weights: Record<string, number>, now = new Date()): Backup {
  return { format: 'durata-backup', version: 1, exportedAt: now.toISOString(), plan, logs, weights }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : undefined)
const SAFE = (k: string) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype'
const DATE = /^\d{4}-\d{2}-\d{2}$/

function cleanSets(v: unknown): SetLog[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v.slice(0, 20).map((s) => (isObj(s) ? { lb: num(s.lb, 2000), reps: num(s.reps, 1000) } : {}))
}
function cleanItem(v: unknown): ItemLog {
  if (!isObj(v)) return {}
  const ex: Record<number, ExerciseLog> = {}
  if (isObj(v.ex)) for (const [k, e] of Object.entries(v.ex)) if (/^\d{1,2}$/.test(k) && isObj(e)) ex[Number(k)] = { done: e.done === true || undefined, sets: cleanSets(e.sets) }
  return {
    status: v.status === 'done' || v.status === 'skipped' ? v.status : undefined,
    miles: num(v.miles, 200),
    minutes: num(v.minutes, 3000),
    ...(Object.keys(ex).length ? { ex } : {}),
  }
}

/**
 * Read a backup file. Every field is checked (numbers, dates, the plan itself), so a damaged or hand-edited file can't
 * put anything strange in the log.
 */
export function readBackup(raw: unknown): { backup: Backup } | { error: string } {
  if (!isObj(raw) || raw.format !== 'durata-backup') return { error: 'This isn’t a Durata backup file.' }
  let plan: Plan | null = null
  if (raw.plan != null) {
    const r = checkPlan(raw.plan)
    if ('errors' in r) return { error: `The plan in this backup has problems: ${r.errors[0]}` }
    plan = r.plan
  }
  const logs: Record<string, DayLog> = {}
  if (isObj(raw.logs)) for (const [k, d] of Object.entries(raw.logs)) {
    const date = k.split('|')[1]
    if (!SAFE(k) || !date || !DATE.test(date) || !isObj(d)) continue
    const items: Record<number, ItemLog> = {}
    if (isObj(d.items)) for (const [i, it] of Object.entries(d.items)) if (/^\d{1,2}$/.test(i)) items[Number(i)] = cleanItem(it)
    logs[k] = { items, spine: d.spine === true || undefined, note: typeof d.note === 'string' ? d.note.slice(0, 5000) : undefined }
  }
  const weights: Record<string, number> = {}
  if (isObj(raw.weights)) for (const [k, w] of Object.entries(raw.weights)) {
    const lb = num(w, 1000)
    if (DATE.test(k) && lb) weights[k] = lb
  }
  return { backup: { format: 'durata-backup', version: 1, exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '', plan, logs, weights } }
}
