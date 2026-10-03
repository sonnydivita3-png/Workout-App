import type { BodyweightEntry, Exercise, ExerciseLog, Goal, NotifPrefs, NotificationType, PlanOverrides, Units, WeekPlan } from '../types'
import { addDays } from './dates'
import { goalPeriodKey, goalPct, goalTitle } from './goals'
import { dayPlanOf, workItems } from './plan'
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
}

export const timeToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

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

  if (i.prefs.pbs) {
    const todays = new Set(i.logs.filter((l) => l.date === today && hasData(l)).map((l) => l.exerciseId))
    for (const id of todays) {
      const ex = i.exerciseName(id)
      if (!ex) continue
      // Reps moves and holds, and weighted lifts only ever done with bodyweight (dips, an ab roller): most reps / longest.
      const countMode = ex.kind !== 'strength' ? null : ex.mode && ex.mode !== 'weight' ? ex.mode : strengthSessions(i.logs, id).length === 0 ? 'reps' : null
      if (countMode) {
        const s = setSessions(i.logs, id, countMode)
        const last = s.at(-1)
        if (!last || last.date !== today || s.length < 2) continue
        const prior = Math.max(...s.slice(0, -1).map((x) => x.best))
        if (last.best > prior) {
          out.push({
            id: `pr:${id}:${today}:${countMode}`,
            type: 'pr',
            title: 'New PR 🔥',
            body:
              countMode === 'time'
                ? `${ex.name}: ${formatSeconds(last.best)} hold (was ${formatSeconds(prior)})`
                : `${ex.name}: ${last.best} reps in a set (was ${prior})`,
          })
        }
      } else if (ex.kind === 'strength') {
        const s = strengthSessions(i.logs, id)
        const last = s.at(-1)
        if (!last || last.date !== today || s.length < 2) continue
        const prior = Math.max(...s.slice(0, -1).map((x) => x.topWeight))
        if (last.topWeight > prior) {
          out.push({
            id: `pr:${id}:${today}:weight`,
            type: 'pr',
            title: 'New PR 🔥',
            body: `${ex.name}: ${showWeight(last.topWeight, units)} ${units.weight} (was ${showWeight(prior, units)})`,
          })
        }
      } else {
        // Cardio: only real records (longest yet, fastest 5K / 2,000 m…), never "faster pace than a longer run".
        const entry = i.logs.find((l) => l.exerciseId === id && l.date === today)?.cardio
        for (const b of newCardioBests(i.logs, id, entry, today, units, ex)) {
          out.push({ id: `pr:${id}:${today}:${b.key}`, type: 'pr', title: 'New PR 🔥', body: `${ex.name}: ${b.title[0].toLowerCase()}${b.title.slice(1)}, ${b.value} (was ${b.was})` })
        }
      }
    }
  }

  if (i.prefs.daily && i.prefs.reminderTime && i.nowMinutes >= timeToMinutes(i.prefs.reminderTime)) {
    const planned = workItems(dayPlanOf(i.plan, i.overrides, today))
    const done = new Set(i.logs.filter((l) => l.date === today && hasData(l)).map((l) => l.exerciseId))
    const left = planned.filter((p) => !done.has(p.exerciseId))
    if (left.length > 0) {
      const names = left.map((p) => i.exerciseName(p.exerciseId)?.name).filter(Boolean) as string[]
      out.push({
        id: `planned:${today}`,
        type: 'planned',
        title: done.size ? `${left.length} exercise${left.length > 1 ? 's' : ''} left today` : 'Today’s workout is up 💪',
        body: names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3} more` : ''),
      })
    }
  }

  return out
}

/** Milliseconds until the daily reminder time today, or null if already past / disabled. */
export function msUntilReminder(prefs: NotifPrefs, now: Date): number | null {
  if (!prefs.daily || !prefs.reminderTime) return null
  const target = addDays(now, 0)
  target.setHours(0, timeToMinutes(prefs.reminderTime), 0, 0)
  const ms = target.getTime() - now.getTime()
  return ms > 0 ? ms : null
}
