import type { BodyweightEntry, Exercise, ExerciseLog, Goal, NotifPrefs, NotificationType, PlanOverrides, Units, WeekPlan } from '../types'
import { addDays } from './dates'
import { goalPeriodKey, goalPct, goalTitle } from './goals'
import { dayPlanOf, workItems } from './plan'
import { anyFinished, isFinished, SESSIONS, splitItems } from './sessions'
import { newCardioBests } from './cardioBests'
import { hasData, setSessions, strengthSessions } from './stats'
import { formatSeconds, showWeight } from './units'

export interface Candidate {
  id: string
  type: NotificationType
  title: string
  body: string
}

interface Input {
  logs: ExerciseLog[]
  goals: Goal[]
  bodyweight: BodyweightEntry[]
  plan: WeekPlan
  overrides?: PlanOverrides
  units: Units
  prefs: NotifPrefs
  today: string
  nowMinutes: number // minutes since local midnight
  exerciseName: (id: string) => Exercise | undefined
  /** Days whose workout was finished: personal bests are only told once it is. */
  finished?: string[]
}

export const timeToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** When to remind about each session of a day split in two: the times they picked, else 7 am and the usual time. */
export const sessionTimes = (prefs: NotifPrefs) => ({ am: prefs.amTime || '07:00', pm: prefs.pmTime || prefs.reminderTime || '17:00' })

/** The day's reminder times: one, or on a day split into a morning and an evening session, one for each. */
export const reminderTimes = (prefs: NotifPrefs, split: boolean): string[] =>
  !prefs.daily ? [] : split ? [sessionTimes(prefs).am, sessionTimes(prefs).pm] : prefs.reminderTime ? [prefs.reminderTime] : []

/**
 * Everything worth telling the user about right now. IDs are deterministic
 * (e.g. one PR per exercise per day) so calling this repeatedly never duplicates.
 */
export function computeNotifications(i: Input): Candidate[] {
  const out: Candidate[] = []
  const { units, today } = i

  if (i.prefs.goals) {
    for (const g of i.goals) {
      const pct = goalPct(g, i.logs, i.bodyweight, today, i.exerciseName)
      const period = goalPeriodKey(g, today) // weekly/monthly goals can be reached again next period
      const key = period ? `${g.id}:${period}` : g.id
      const title = goalTitle(g, units, (id) => i.exerciseName(id)?.name)
      if (pct >= 1) {
        out.push({ id: `goal-done:${key}`, type: 'goal-reached', title: 'Goal reached 🎯', body: title })
      } else if (g.type === 'workouts' ? g.perWeek >= 2 && pct >= (g.perWeek - 1) / g.perWeek : pct >= 0.85) {
        out.push({
          id: `goal-close:${key}`,
          type: 'goal-close',
          title: g.type === 'workouts' ? 'One workout to go 👀' : 'Almost there 🔥',
          body: g.type === 'workouts' ? `${title} — one more this week` : `${title} — ${Math.round(pct * 100)}% of the way`,
        })
      }
    }
  }

  // Personal bests are celebrated when the workout is finished ("Finish workout"), not set by set along the way.
  // Without a finished list (older callers), every logged day counts.
  // (On a day split in two, finishing either session counts.)
  if (i.prefs.pbs && (!i.finished || anyFinished(i.finished, today))) out.push(...newBests(today, i.logs, units, i.exerciseName))

  if (i.prefs.daily) {
    const day = dayPlanOf(i.plan, i.overrides, today)
    const done = new Set(i.logs.filter((l) => l.date === today && hasData(l)).map((l) => l.exerciseId))
    const finished = i.finished ?? []
    const names = (left: typeof day) => {
      const n = left.map((p) => i.exerciseName(p.exerciseId)?.name).filter(Boolean) as string[]
      return n.slice(0, 3).join(', ') + (n.length > 3 ? ` +${n.length - 3} more` : '')
    }
    const split = splitItems(day)
    if (split) {
      // Two sessions: a reminder for each at its own time, until it's done (or finished).
      const at = sessionTimes(i.prefs)
      for (const s of SESSIONS) {
        if (i.nowMinutes < timeToMinutes(at[s]) || isFinished(finished, today, s)) continue
        const planned = workItems(split[s])
        const left = planned.filter((p) => !done.has(p.exerciseId))
        if (!left.length) continue
        const when = s === 'am' ? 'this morning' : 'this evening'
        out.push({
          id: `planned-${s}:${today}`,
          type: 'planned',
          title: left.length < planned.length ? `${left.length} exercise${left.length > 1 ? 's' : ''} left ${when}` : s === 'am' ? 'Your morning workout is up ☀️' : 'Your evening workout is up 💪',
          body: names(left),
        })
      }
    } else if (i.prefs.reminderTime && i.nowMinutes >= timeToMinutes(i.prefs.reminderTime) && !isFinished(finished, today)) {
      const left = workItems(day).filter((p) => !done.has(p.exerciseId))
      if (left.length > 0) {
        out.push({
          id: `planned:${today}`,
          type: 'planned',
          title: done.size ? `${left.length} exercise${left.length > 1 ? 's' : ''} left today` : 'Today’s workout is up 💪',
          body: names(left),
        })
      }
    }
  }

  return out
}

/**
 * Milliseconds until the next reminder time today (on a day split into two sessions, the morning's or the evening's),
 * or null if they're past or reminders are off.
 */
export function msUntilReminder(prefs: NotifPrefs, now: Date, split = false): number | null {
  const ahead = reminderTimes(prefs, split).map((t) => {
    const target = addDays(now, 0)
    target.setHours(0, timeToMinutes(t), 0, 0)
    return target.getTime() - now.getTime()
  }).filter((ms) => ms > 0)
  return ahead.length ? Math.min(...ahead) : null
}

/**
 * The personal bests set on a day, one line each: heaviest weight, most reps or longest hold, and cardio records
 * (longest yet, fastest 5K...). Ids are stable per exercise and day, so they're never told twice.
 */
export function newBests(date: string, logs: ExerciseLog[], units: Units, exerciseName: (id: string) => Exercise | undefined): Candidate[] {
  const out: Candidate[] = []
  const done = new Set(logs.filter((l) => l.date === date && hasData(l)).map((l) => l.exerciseId))
  for (const id of done) {
    const ex = exerciseName(id)
    if (!ex) continue
    // Reps moves and holds, and weighted lifts only ever done with bodyweight (dips, an ab roller): most reps / longest.
    const countMode = ex.kind !== 'strength' ? null : ex.mode && ex.mode !== 'weight' ? ex.mode : strengthSessions(logs, id).length === 0 ? 'reps' : null
    if (countMode) {
      const s = setSessions(logs, id, countMode)
      const last = s.at(-1)
      if (!last || last.date !== date || s.length < 2) continue
      const prior = Math.max(...s.slice(0, -1).map((x) => x.best))
      if (last.best > prior) {
        out.push({
          id: `pr:${id}:${date}:${countMode}`,
          type: 'pr',
          title: 'New PR 🔥',
          body:
            countMode === 'time'
              ? `${ex.name}: ${formatSeconds(last.best)} hold (was ${formatSeconds(prior)})`
              : `${ex.name}: ${last.best} reps in a set (was ${prior})`,
        })
      }
    } else if (ex.kind === 'strength') {
      const s = strengthSessions(logs, id)
      const last = s.at(-1)
      if (!last || last.date !== date || s.length < 2) continue
      const prior = Math.max(...s.slice(0, -1).map((x) => x.topWeight))
      if (last.topWeight > prior) {
        out.push({
          id: `pr:${id}:${date}:weight`,
          type: 'pr',
          title: 'New PR 🔥',
          body: `${ex.name}: ${showWeight(last.topWeight, units)} ${units.weight} (was ${showWeight(prior, units)})`,
        })
      }
    } else {
      // Cardio: only real records (longest yet, fastest 5K / 2,000 m…), never "faster pace than a longer run".
      const entry = logs.find((l) => l.exerciseId === id && l.date === date)?.cardio
      for (const b of newCardioBests(logs, id, entry, date, units, ex)) {
        out.push({ id: `pr:${id}:${date}:${b.key}`, type: 'pr', title: 'New PR 🔥', body: `${ex.name}: ${b.title[0].toLowerCase()}${b.title.slice(1)}, ${b.value} (was ${b.was})` })
      }
    }
  }
  return out
}
