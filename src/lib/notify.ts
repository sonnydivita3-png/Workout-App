import type { BodyweightEntry, Exercise, ExerciseLog, Goal, NotifPrefs, NotificationType, Units, WeekPlan } from '../types'
import { addDays, mondayOf, parseISO, toISO, weekdayIndex } from './dates'
import { goalPct, goalTitle } from './goals'
import { cardioSessions, hasData, setSessions, strengthSessions } from './stats'
import { formatPace, formatSeconds, showDistance, showWeight } from './units'

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
    const weekKey = toISO(mondayOf(parseISO(today)))
    for (const g of i.goals) {
      const pct = goalPct(g, i.logs, i.bodyweight, today)
      const key = g.type === 'workouts' ? `${g.id}:${weekKey}` : g.id
      const title = goalTitle(g, units, (id) => i.exerciseName(id)?.name)
      if (pct >= 1) {
        out.push({ id: `goal-done:${key}`, type: 'goal-reached', title: 'Goal reached', body: title })
      } else if (g.type === 'workouts' ? g.perWeek >= 2 && pct >= (g.perWeek - 1) / g.perWeek : pct >= 0.85) {
        out.push({
          id: `goal-close:${key}`,
          type: 'goal-close',
          title: g.type === 'workouts' ? 'One workout to go' : 'Almost there',
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
      if (ex.kind === 'strength' && ex.mode && ex.mode !== 'weight') {
        const s = setSessions(i.logs, id, ex.mode)
        const last = s.at(-1)
        if (!last || last.date !== today || s.length < 2) continue
        const prior = Math.max(...s.slice(0, -1).map((x) => x.best))
        if (last.best > prior) {
          out.push({
            id: `pr:${id}:${today}:${ex.mode}`,
            type: 'pr',
            title: 'New personal best',
            body:
              ex.mode === 'time'
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
            title: 'New personal best',
            body: `${ex.name}: ${showWeight(last.topWeight, units)} ${units.weight} (was ${showWeight(prior, units)})`,
          })
        }
      } else {
        const s = cardioSessions(i.logs, id)
        const last = s.at(-1)
        if (!last || last.date !== today || s.length < 2) continue
        const before = s.slice(0, -1)
        const priorDist = Math.max(0, ...before.map((x) => x.distance ?? 0))
        if (last.distance && last.distance > priorDist) {
          out.push({
            id: `pr:${id}:${today}:distance`,
            type: 'pr',
            title: 'New personal best',
            body: `${ex.name}: longest yet at ${showDistance(last.distance, units)} ${units.distance}`,
          })
        }
        const paces = before.map((x) => x.pace).filter((p): p is number => p != null)
        if (last.pace != null && paces.length && last.pace < Math.min(...paces)) {
          out.push({
            id: `pr:${id}:${today}:pace`,
            type: 'pr',
            title: 'New personal best',
            body: `${ex.name}: fastest pace yet, ${formatPace(last.distance, last.minutes, units)}`,
          })
        }
      }
    }
  }

  if (i.prefs.daily && i.prefs.reminderTime && i.nowMinutes >= timeToMinutes(i.prefs.reminderTime)) {
    const planned = i.plan[weekdayIndex(parseISO(today))]
    const done = new Set(i.logs.filter((l) => l.date === today && hasData(l)).map((l) => l.exerciseId))
    const left = planned.filter((p) => !done.has(p.exerciseId))
    if (left.length > 0) {
      const names = left.map((p) => i.exerciseName(p.exerciseId)?.name).filter(Boolean) as string[]
      out.push({
        id: `planned:${today}`,
        type: 'planned',
        title: done.size ? `${left.length} exercise${left.length > 1 ? 's' : ''} left today` : 'Workout planned today',
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
