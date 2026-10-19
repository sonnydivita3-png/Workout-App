import type { ExerciseLog, PlanOverrides, Program } from '../types'
import { hasData } from './stats'

/** A program is active while any of its days is today or later. */
export const isActive = (p: Program, today: string) => p.entries.some((e) => e.date >= today)

export const activePrograms = (programs: Program[], today: string) => programs.filter((p) => isActive(p, today))

type Entry = Program['entries'][number]

/** The exercises an entry put on its day, or null for an older entry that owned the whole day. */
const ownIds = (e: Entry): string[] | null => (e.exerciseId ? [e.exerciseId] : e.exerciseIds ?? null)

const logged = (logs: ExerciseLog[], date: string, ids?: string[] | null) =>
  logs.some((l) => l.date === date && hasData(l) && (!ids || ids.includes(l.exerciseId)))

/** Days a stop would change: today or later, and none of its exercises logged on them yet. */
export function stoppableEntries(p: Program, logs: ExerciseLog[], from: string) {
  return p.entries.filter((e) => e.date >= from && !logged(logs, e.date, ownIds(e)))
}

/** What other plans put on a date (a run plan's run), by exercise id, or null if no other plan has that date. */
function othersOn(programs: Program[], date: string, not?: Program): Set<string> | null {
  let ids: Set<string> | null = null
  for (const q of programs) {
    if (q.id === not?.id) continue
    for (const e of q.entries) if (e.date === date) for (const id of ownIds(e) ?? []) (ids ??= new Set()).add(id)
    if (!ids && q.entries.some((e) => e.date === date)) ids = new Set()
  }
  return ids
}

/**
 * Remove a program's upcoming days from the calendar: only what it put there, so anything else planned that day (a run
 * from a run plan, an exercise you added) stays. A day left empty goes back to the weekly plan, or stays a rest day if
 * another plan has it as one. Anything already logged stays. `programs` are the other plans.
 */
export function removeProgramDays(p: Program, overrides: PlanOverrides, logs: ExerciseLog[], from: string, programs: Program[] = []): { overrides: PlanOverrides; count: number } {
  const next = { ...overrides }
  let count = 0
  for (const e of stoppableEntries(p, logs, from)) {
    const day = next[e.date]
    if (!day) continue
    const own = ownIds(e)
    const others = othersOn(programs, e.date, p)
    // An older whole-day entry keeps only what another plan put there.
    const rest = day.filter((x) => (own ? !own.includes(x.exerciseId) : others?.has(x.exerciseId)))
    if (rest.length === day.length && (rest.length > 0 || others)) continue
    if (rest.length === 0 && !others) delete next[e.date]
    else next[e.date] = rest
    count++
  }
  return { overrides: next, count }
}

/** What another plan (a run plan's run) has on a date, which a new week/month plan keeps there. */
export const keptItems = (overrides: PlanOverrides, programs: Program[], date: string, self?: Program) => {
  const others = othersOn(programs, date, self)
  return (overrides[date] ?? []).filter((x) => others?.has(x.exerciseId))
}

/**
 * Put a week/month plan's days on the calendar on top of the other plans: each date gets the new plan's exercises,
 * then keeps what another plan (a run plan) put there. A rest day in the new plan keeps those too.
 */
export function layerDays(days: PlanOverrides, overrides: PlanOverrides, programs: Program[], self: Program): PlanOverrides {
  const next = { ...overrides }
  for (const [date, items] of Object.entries(days)) {
    const mine = new Set(items.map((x) => x.exerciseId))
    next[date] = [...items, ...keptItems(overrides, programs, date, self).filter((x) => !mine.has(x.exerciseId))]
  }
  return next
}

/** Clear planned days in a date range back to the weekly plan, keeping any day with something logged. */
export function clearRange(overrides: PlanOverrides, logs: ExerciseLog[], from: string, to: string): { overrides: PlanOverrides; count: number } {
  const next = { ...overrides }
  let count = 0
  for (const date of Object.keys(next)) {
    if (date < from || date > to || logged(logs, date)) continue
    delete next[date]
    count++
  }
  return { overrides: next, count }
}
