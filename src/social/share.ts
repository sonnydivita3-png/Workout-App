import { BUILTIN_BY_ID } from '../data/exercises'
import { partFromName } from '../lib/bodyParts'
import type { Exercise, ExerciseLog, PlanOverrides, PlannedExercise, WeekPlan } from '../types'
import { addDays, mondayOf, parseISO, toISO } from '../lib/dates'
import { dayPlanOf } from '../lib/plan'
import { formatSeconds } from '../lib/units'
import type { Scope, SharedPayload } from './types'

const SCOPE_DAYS: Record<Scope, number> = { day: 1, week: 7, month: 28 }

/** The dates a share covers: that day, that week (Mon–Sun), or four weeks starting with that week. */
export function datesFor(scope: Scope, anchor: string): string[] {
  const start = scope === 'day' ? parseISO(anchor) : mondayOf(parseISO(anchor))
  return Array.from({ length: SCOPE_DAYS[scope] }, (_, i) => toISO(addDays(start, i)))
}

/** The Monday to start a shared week/month on, or the day itself for a single day. */
export const startFor = (scope: Scope, chosen: string) => (scope === 'day' ? chosen : toISO(mondayOf(parseISO(chosen))))

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T

/** Snapshot a plan for sharing. Only the plan travels: never logged results, weights, or anything private. */
export function buildPayload(p: { scope: Scope; dates: string[]; plan: WeekPlan; overrides: PlanOverrides; custom: Exercise[]; results?: string[] }): SharedPayload {
  const days = p.dates.map((date, offset) => {
    const items = dayPlanOf(p.plan, p.overrides, date).map((i) => clone(i))
    return { offset, rest: items.length === 0, items }
  })
  const used = new Set(days.flatMap((d) => d.items.map((i) => i.exerciseId)))
  const custom = p.custom.filter((c) => used.has(c.id)).map((c) => clone(c))
  return { version: 1, scope: p.scope, days, custom, ...(p.results?.length ? { results: p.results } : {}) }
}

export function defaultTitle(payload: SharedPayload, name: (id: string) => string | undefined): string {
  const first = payload.days.find((d) => d.items.length)?.items[0]
  const firstName = first ? name(first.exerciseId) : undefined
  const workouts = payload.days.filter((d) => d.items.length).length
  if (payload.scope === 'day') return firstName ? `${firstName}${(payload.days[0]?.items.length ?? 0) > 1 ? ' & more' : ''}` : 'Workout'
  return payload.scope === 'week' ? `${workouts}-workout week` : `${workouts}-workout month`
}

export function describePayload(payload: SharedPayload): string {
  const workouts = payload.days.filter((d) => d.items.length)
  const exercises = workouts.reduce((a, d) => a + d.items.length, 0)
  const rest = payload.days.length - workouts.length
  if (payload.scope === 'day') return `${exercises} exercise${exercises === 1 ? '' : 's'}`
  return `${workouts.length} workouts · ${exercises} exercises${rest ? ` · ${rest} rest days` : ''}`
}

// ---------------------------------------------------------------------------------------------
// Anything received from a friend is untrusted. It is validated and clamped before it goes near the calendar.
// ---------------------------------------------------------------------------------------------

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const num = (x: unknown, lo: number, hi: number): number | undefined => (typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi ? x : undefined)
const str = (x: unknown, max: number): string | undefined => (typeof x === 'string' && x.length > 0 && x.length <= max ? x : undefined)

function cleanItem(x: unknown): PlannedExercise | null {
  if (!isObj(x)) return null
  const exerciseId = str(x.exerciseId, 100)
  const sets = num(x.sets, 1, 30)
  if (!exerciseId || sets === undefined) return null
  const out: PlannedExercise = { exerciseId, sets: Math.round(sets) }
  const reps = num(x.reps, 1, 1000); if (reps !== undefined) out.reps = Math.round(reps)
  const seconds = num(x.seconds, 1, 7200); if (seconds !== undefined) out.seconds = Math.round(seconds)
  const minutes = num(x.minutes, 1, 1440); if (minutes !== undefined) out.minutes = Math.round(minutes)
  const distance = num(x.distance, 0.01, 500); if (distance !== undefined) out.distance = distance
  const est = num(x.est, 0, 1440); if (est !== undefined) out.est = est
  const block = str(x.block, 40); if (block) out.block = block
  const blockLabel = str(x.blockLabel, 200); if (blockLabel) out.blockLabel = blockLabel
  const note = str(x.note, 600); if (note) out.note = note
  const rest = num(x.rest, 0, 600); if (rest !== undefined) out.rest = Math.round(rest)
  const warmupSets = num(x.warmupSets, 0, 5); if (warmupSets) out.warmupSets = Math.round(warmupSets)
  if (x.warmup === true) out.warmup = true
  if (isObj(x.wod) && (x.wod.kind === 'amrap' || x.wod.kind === 'emom' || x.wod.kind === 'fortime' || x.wod.kind === 'tabata')) {
    const m = num(x.wod.minutes, 1, 180)
    if (m !== undefined) {
      const interval = num(x.wod.interval, 1, 10)
      const rounds = num(x.wod.rounds, 1, 50)
      const work = num(x.wod.work, 5, 300)
      const rest = num(x.wod.rest, 0, 300)
      const gap = num(x.wod.gap, 0, 600)
      const intervals = num(x.wod.intervals, 1, 500)
      out.wod = {
        kind: x.wod.kind, minutes: Math.round(m),
        ...(interval !== undefined ? { interval: Math.round(interval) } : {}), ...(rounds !== undefined ? { rounds: Math.round(rounds) } : {}),
        ...(work !== undefined ? { work: Math.round(work) } : {}), ...(rest !== undefined ? { rest: Math.round(rest) } : {}),
        ...(gap !== undefined ? { gap: Math.round(gap) } : {}), ...(intervals !== undefined ? { intervals: Math.round(intervals) } : {}),
      }
    }
  }
  return out
}

function cleanCustom(x: unknown): Exercise | null {
  if (!isObj(x)) return null
  const id = str(x.id, 100)
  const name = str(x.name, 60)
  if (!id || !name || (x.kind !== 'strength' && x.kind !== 'cardio')) return null
  // Friends on older versions send Legs or Arms: file those under the right part.
  const ex: Exercise = { id, name, kind: x.kind, group: partFromName(str(x.group, 30) ?? (x.kind === 'cardio' ? 'Cardio' : 'Other'), name), custom: true }
  if (x.mode === 'weight' || x.mode === 'reps' || x.mode === 'time') ex.mode = x.mode
  const eq = str(x.equipment, 30); if (eq) ex.equipment = eq
  return ex
}

/** Returns a clean payload, or null if it isn't a plan we can safely use. */
export function sanitizePayload(raw: unknown): SharedPayload | null {
  if (!isObj(raw) || raw.version !== 1) return null
  const scope = raw.scope
  if (scope !== 'day' && scope !== 'week' && scope !== 'month') return null
  if (!Array.isArray(raw.days) || raw.days.length === 0 || raw.days.length > 28) return null
  const seen = new Set<number>()
  const days: SharedPayload['days'] = []
  for (const d of raw.days) {
    if (!isObj(d) || !Array.isArray(d.items)) return null
    const offset = num(d.offset, 0, 27)
    if (offset === undefined || !Number.isInteger(offset) || seen.has(offset) || d.items.length > 40) return null
    seen.add(offset)
    const items = d.items.map(cleanItem).filter((i): i is PlannedExercise => !!i)
    const unique = items.filter((i, idx) => items.findIndex((j) => j.exerciseId === i.exerciseId) === idx) // one entry per exercise per day
    days.push({ offset, rest: unique.length === 0, items: unique })
  }
  const custom = (Array.isArray(raw.custom) ? raw.custom : []).slice(0, 60).map(cleanCustom).filter((c): c is Exercise => !!c)
  const results = Array.isArray(raw.results) ? raw.results.filter((r): r is string => typeof r === 'string' && r.length <= 120).slice(0, 20) : undefined
  return { version: 1, scope, days: days.sort((a, b) => a.offset - b.offset), custom, ...(results?.length ? { results } : {}) }
}

/**
 * Work out what adding a shared plan does: which dates get which exercises, and which custom exercises
 * come along. A friend's custom exercises are added under fresh ids so they can never overwrite yours.
 */
export function planFromPayload(
  payload: SharedPayload,
  startDate: string,
  existingCustom: Exercise[],
): { days: Record<string, PlannedExercise[]>; newCustom: Exercise[]; skipped: number } {
  const known = (id: string) => BUILTIN_BY_ID.has(id)
  const idMap = new Map<string, string>()
  const newCustom: Exercise[] = []
  for (const c of payload.custom) {
    const same = existingCustom.find((e) => e.name === c.name && e.kind === c.kind && e.mode === c.mode)
    if (same) { idMap.set(c.id, same.id); continue }
    const id = `custom-${Math.random().toString(36).slice(2, 10)}`
    idMap.set(c.id, id)
    newCustom.push({ ...c, id })
  }
  const days: Record<string, PlannedExercise[]> = {}
  let skipped = 0
  for (const d of payload.days) {
    const items: PlannedExercise[] = []
    for (const it of d.items) {
      const id = idMap.get(it.exerciseId) ?? (known(it.exerciseId) ? it.exerciseId : undefined)
      if (!id) { skipped++; continue }
      items.push({ ...it, exerciseId: id })
    }
    if (items.length) days[toISO(addDays(parseISO(startDate), d.offset))] = items // rest days never override your own plans
  }
  return { days, newCustom, skipped }
}

/** Turn what someone actually did on a date into a workout others can repeat, plus a short summary of their results. */
export function completedWorkout(date: string, logs: ExerciseLog[], lookup: (id: string) => Exercise | undefined, custom: Exercise[]): SharedPayload | null {
  const items: PlannedExercise[] = []
  const results: string[] = []
  for (const l of logs.filter((x) => x.date === date)) {
    const ex = lookup(l.exerciseId)
    if (!ex) continue
    if (l.cardio && (l.cardio.distance || l.cardio.minutes)) {
      const { distance, minutes } = l.cardio
      items.push({ exerciseId: ex.id, sets: 1, ...(minutes ? { minutes: Math.round(minutes) } : {}), ...(distance ? { distance } : {}) })
      results.push(`${ex.name} ${[distance ? `${Math.round(distance * 100) / 100} mi` : '', minutes ? `${Math.round(minutes)} min` : ''].filter(Boolean).join(' in ')}`)
    } else if (l.sets) {
      const done = l.sets.filter((s) => s.weight || s.reps || s.seconds)
      if (done.length === 0) continue
      const timed = ex.mode === 'time'
      const best = timed ? Math.max(...done.map((s) => s.seconds ?? 0)) : Math.max(...done.map((s) => s.reps ?? 0))
      items.push({ exerciseId: ex.id, sets: done.length, ...(timed ? { seconds: best || undefined } : best ? { reps: best } : {}) })
      const top = done.reduce((a, s) => ((s.weight ?? 0) > (a.weight ?? 0) ? s : a))
      results.push(timed ? `${ex.name} ${done.length} × ${formatSeconds(best)}` : ex.mode === 'weight' || top.weight ? `${ex.name} ${done.length} sets, top ${Math.round(top.weight ?? 0)} lb × ${top.reps ?? '–'}` : `${ex.name} ${done.length} × ${best}`)
    }
  }
  if (items.length === 0) return null
  const used = new Set(items.map((i) => i.exerciseId))
  return { version: 1, scope: 'day', days: [{ offset: 0, rest: false, items }], custom: custom.filter((c) => used.has(c.id)).map((c) => clone(c)), results }
}

/** A shareable plan built from days you made on the spot (a saved routine, a random workout, or one you built). */
export function payloadFromDays(days: { offset: number; items: PlannedExercise[] }[], scope: Scope, allCustom: Exercise[]): SharedPayload {
  const out = days.map((d) => ({ offset: d.offset, rest: d.items.length === 0, items: clone(d.items) }))
  const used = new Set(out.flatMap((d) => d.items.map((i) => i.exerciseId)))
  return { version: 1, scope, days: out, custom: allCustom.filter((c) => used.has(c.id)).map((c) => clone(c)) }
}
