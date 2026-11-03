import type { DaySession, PlannedExercise } from '../types'
import { groupByBlock } from './describe'

/**
 * Two-a-days: a day split into a morning and an evening session (a run before work, weights after), by hand. Each
 * planned exercise can say which session it's in. A day with none marked is one session, as before.
 */
export const SESSIONS: readonly DaySession[] = ['am', 'pm']
export const sessionLabel = (s: DaySession) => (s === 'am' ? 'Morning' : 'Evening')
export const isSession = (s: unknown): s is DaySession => s === 'am' || s === 'pm'

/** A run, ride or row of its own: not the warm-up, nor a station in a timed block or circuit. */
const isCardio = (p: PlannedExercise) => !p.warmup && !p.block && !p.wod && p.minutes != null

/** Whether the day is split into two sessions: any of its exercises says which one it's in. */
export const isSplit = (items: PlannedExercise[]) => items.some((p) => isSession(p.session))

/**
 * Each item's session on a split day, else null (one session). An item moved by hand has its own. One added since (an
 * exercise from + Add, a finisher, a plan's run) goes where its block is, else with what it's like: cardio with the
 * session that has the cardio, anything else with the one that has the rest, a warm-up with what comes after it. Failing
 * all that, the evening. A warm-up or block always stays together.
 */
export function sessionsOf(items: PlannedExercise[]): DaySession[] | null {
  if (!isSplit(items)) return null
  const units = groupByBlock(items)
  // Where a kind of thing is, when it's all in one session.
  const where = (pred: (p: PlannedExercise) => boolean) => {
    const at = new Set(items.filter((p) => isSession(p.session) && pred(p)).map((p) => p.session!))
    return at.size === 1 ? [...at][0] : undefined
  }
  const cardioAt = where(isCardio)
  const restAt = where((p) => !p.warmup && !isCardio(p))
  const per: (DaySession | undefined)[] = units.map((u) => {
    const own = u.items.map((x) => x.item.session).find(isSession)
    if (own) return own
    if (u.items[0].item.warmup) return undefined
    return u.items.some((x) => isCardio(x.item)) ? cardioAt ?? restAt : restAt ?? cardioAt
  })
  // A warm-up goes with what follows it (or, last in the day, what comes before it).
  let next: DaySession | undefined
  for (let i = units.length - 1; i >= 0; i--) {
    if (!per[i]) per[i] = next
    next = per[i] ?? next
  }
  let prev: DaySession | undefined
  for (let i = 0; i < units.length; i++) {
    if (!per[i]) per[i] = prev
    prev = per[i] ?? prev
  }
  const out: DaySession[] = new Array(items.length)
  units.forEach((u, i) => u.items.forEach((x) => (out[x.index] = per[i] ?? 'pm')))
  return out
}

/** The day's items by session, in their order (null for a one-session day). */
export function splitItems(items: PlannedExercise[]): Record<DaySession, PlannedExercise[]> | null {
  const of = sessionsOf(items)
  if (!of) return null
  return { am: items.filter((_, i) => of[i] === 'am'), pm: items.filter((_, i) => of[i] === 'pm') }
}

/**
 * Where each item would go when a one-session day is split: its cardio in the morning and everything else in the
 * evening (the warm-up with what it comes before). With nothing to tell apart (all lifting, or all cardio), it all
 * starts in the evening and they pick what moves to the morning.
 */
export function suggestSessions(items: PlannedExercise[]): DaySession[] {
  const now = sessionsOf(items)
  if (now) return now
  const hasCardio = items.some(isCardio)
  const hasRest = items.some((p) => !p.warmup && !isCardio(p))
  if (!(hasCardio && hasRest)) return items.map(() => 'pm')
  const units = groupByBlock(items)
  const per: (DaySession | undefined)[] = units.map((u) => (u.items[0].item.warmup ? undefined : u.items.some((x) => isCardio(x.item)) ? 'am' : 'pm'))
  let next: DaySession | undefined
  for (let i = units.length - 1; i >= 0; i--) {
    if (!per[i]) per[i] = next
    next = per[i] ?? next
  }
  const out: DaySession[] = new Array(items.length)
  units.forEach((u, i) => u.items.forEach((x) => (out[x.index] = per[i] ?? 'pm')))
  return out
}

/** Back to one session. */
export function joinSessions(items: PlannedExercise[]): PlannedExercise[] {
  if (!items.some((p) => 'session' in p)) return items
  return items.map((p) => {
    if (!('session' in p)) return p
    const { session: _s, ...rest } = p
    void _s
    return rest
  })
}

/**
 * The day with each item in the session given (a warm-up or block goes as one, by its first item). When everything but
 * a warm-up ends up in one session, it's one session again.
 */
export function withSessions(items: PlannedExercise[], sessions: readonly DaySession[]): PlannedExercise[] {
  const per: DaySession[] = new Array(items.length)
  for (const u of groupByBlock(items)) {
    const s = isSession(sessions[u.items[0].index]) ? sessions[u.items[0].index] : 'pm'
    for (const x of u.items) per[x.index] = s
  }
  const used = new Set(items.flatMap((p, i) => (p.warmup ? [] : [per[i]])))
  if (used.size < 2) return joinSessions(items)
  return items.map((p, i) => (p.session === per[i] ? p : { ...p, session: per[i] }))
}

/**
 * Finished workouts are kept by date; on a split day each session is finished on its own ("2026-11-03:am"), and the day
 * is finished once both are.
 */
export const finishedKey = (date: string, session?: DaySession) => (session ? `${date}:${session}` : date)

/** Whether the day (or one of its sessions) has been finished. Finishing the whole day covers both sessions. */
export const isFinished = (finished: readonly string[], date: string, session?: DaySession) =>
  finished.includes(date) || (!!session && finished.includes(finishedKey(date, session)))

/** Whether anything on the day has been finished yet: the whole day, or one of its sessions. */
export const anyFinished = (finished: readonly string[], date: string) => SESSIONS.some((s) => isFinished(finished, date, s))

/** The finished list with the day (or one of its sessions) finished: the second session finished finishes the day. */
export function finishIn(finished: readonly string[], date: string, session?: DaySession): string[] {
  if (isFinished(finished, date, session)) return [...finished]
  const both = session && isFinished(finished, date, session === 'am' ? 'pm' : 'am')
  return [...finished, ...(!session ? [date] : both ? [finishedKey(date, session), date] : [finishedKey(date, session)])]
}

/** The finished list with the day (or one of its sessions) not finished: undoing a session undoes the day too. */
export const unfinishIn = (finished: readonly string[], date: string, session?: DaySession): string[] =>
  finished.filter((d) => d !== date && (session ? d !== finishedKey(date, session) : !d.startsWith(`${date}:`)))
