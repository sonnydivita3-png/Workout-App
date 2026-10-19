import type { ExerciseLog, PlanOverrides, PlannedExercise, Program } from '../types'
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

/** What other plans put on a date by exercise id (older plans, before items were tagged), or null if no other plan has that date. */
function othersOn(programs: Program[], date: string, not?: Program): Set<string> | null {
  let ids: Set<string> | null = null
  for (const q of programs) {
    if (q.id === not?.id) continue
    for (const e of q.entries) if (e.date === date) for (const id of ownIds(e) ?? []) (ids ??= new Set()).add(id)
    if (!ids && q.entries.some((e) => e.date === date)) ids = new Set()
  }
  return ids
}

/** Whether another of `programs` put this item on `date`: by its tag, or for an untagged (older) item, by exercise id. */
const fromOther = (x: PlannedExercise, programs: Program[], others: Set<string> | null, self?: Program) =>
  x.plan ? x.plan !== self?.id && programs.some((q) => q.id === x.plan) : !!others?.has(x.exerciseId)

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
    // Tagged items go by their tag. An untagged one is this plan's if it's one of the exercises it put there (an older
    // whole-day entry: anything) and no other plan claims that exercise on that day.
    const mine = (x: PlannedExercise) => (x.plan ? x.plan === p.id : (!own || own.includes(x.exerciseId)) && !others?.has(x.exerciseId))
    const rest = day.filter((x) => !mine(x))
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
  return (overrides[date] ?? []).filter((x) => fromOther(x, programs, others, self))
}

/**
 * Put a week/month plan's days on the calendar on top of the other plans: each date gets the new plan's exercises
 * (tagged with its id), then keeps everything another plan (a run plan) put there. A rest day keeps those too.
 */
export function layerDays(days: PlanOverrides, overrides: PlanOverrides, programs: Program[], self: Program): PlanOverrides {
  const next = { ...overrides }
  for (const [date, items] of Object.entries(days)) next[date] = [...items.map((x) => ({ ...x, plan: self.id })), ...keptItems(overrides, programs, date, self)]
  return next
}

/**
 * A run or ride from a run/bike plan going on a day: it replaces any run or ride already planned there (a run you added
 * by hand) and a lifting plan's own cardio (its finisher or cardio-day session: the run plan is the cardio now), and
 * keeps everything else. `isCardio` says whether an exercise is cardio.
 */
export function addSession(day: PlannedExercise[], item: PlannedExercise, programs: Program[], isCardio: (id: string) => boolean): PlannedExercise[] {
  const lifting = new Set(programs.filter((q) => q.kind === 'program').map((q) => q.id))
  const replaced = (x: PlannedExercise) =>
    x.plan && lifting.has(x.plan) ? !x.warmup && !x.block && isCardio(x.exerciseId) : x.exerciseId === item.exerciseId
  return [...day.filter((x) => !replaced(x)), item]
}

/** On days with both: the run or ride from a run/bike plan first, or the lifting first. */
export type StackOrder = 'lift' | 'cardio'

/** Whether an item on `date` is a run/bike plan's session: by its tag, or for an untagged (older) one, by the plan's entry. */
const isPlanSession = (x: PlannedExercise, date: string, cardio: Program[]) =>
  x.plan ? cardio.some((q) => q.id === x.plan) : cardio.some((q) => q.entries.some((e) => e.date === date && e.exerciseId === x.exerciseId))

/** A day with a run/bike plan's session and other exercises, in the order picked; anything else stays as it is. */
export function orderDay(day: PlannedExercise[], date: string, programs: Program[], order: StackOrder): PlannedExercise[] {
  const cardio = programs.filter((q) => q.kind === 'cardio')
  const runs = day.filter((x) => isPlanSession(x, date, cardio))
  if (runs.length === 0 || runs.length === day.length) return day
  const rest = day.filter((x) => !runs.includes(x))
  return order === 'cardio' ? [...runs, ...rest] : [...rest, ...runs]
}

/** Every day from `from` on, put in the order picked (see orderDay). */
export function orderDays(overrides: PlanOverrides, programs: Program[], order: StackOrder, from: string): PlanOverrides {
  const next = { ...overrides }
  for (const [date, day] of Object.entries(overrides)) if (date >= from) next[date] = orderDay(day, date, programs, order)
  return next
}

/**
 * Upcoming dates where a run/bike plan and a lifting plan both have a session (not a lifting rest day): the days the
 * lift-or-run-first question is about. `dates` narrows it to a plan about to be added.
 */
export function sharedDays(programs: Program[], from: string, extra: { kind: Program['kind']; dates: string[] } | null = null): string[] {
  const days = (kind: Program['kind']) => {
    const out = new Set(programs.filter((q) => q.kind === kind).flatMap((q) => q.entries.filter((e) => e.date >= from && (e.exerciseIds?.length ?? 1) > 0).map((e) => e.date)))
    if (extra?.kind === kind) return new Set(extra.dates.filter((d) => d >= from))
    return out
  }
  const lift = days('program')
  return [...days('cardio')].filter((d) => lift.has(d)).sort()
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
