import type { AppNotification, Exercise, ExerciseLog } from '../types'
import { addDays, parseISO, toISO } from '../lib/dates'
import { hasData, weekStats } from '../lib/stats'
import type { ProgressSnapshot } from './types'

/**
 * The summary a person can choose to share with friends: recent exercise names, weekly count, streak and the text of
 * recent personal-best notifications. Body weight, measurements, photos, goals and full set details are never included.
 */
export function buildSnapshot(p: { logs: ExerciseLog[]; notifications: AppNotification[]; today: string; lookup: (id: string) => Exercise | undefined; now?: number }): ProgressSnapshot {
  const stats = weekStats(p.logs, p.today)
  const recent: ProgressSnapshot['recent'] = []
  for (let i = 0; i < 7; i++) {
    const date = toISO(addDays(parseISO(p.today), -i))
    const names = [...new Set(p.logs.filter((l) => l.date === date && hasData(l)).map((l) => p.lookup(l.exerciseId)?.name).filter((n): n is string => !!n))]
    if (names.length) recent.push({ date, exercises: names.slice(0, 6) })
  }
  const since = (p.now ?? Date.now()) - 14 * 86400000
  const bests = p.notifications.filter((n) => n.type === 'pr' && n.ts >= since).map((n) => n.body).slice(0, 5)
  return { updatedAt: new Date(p.now ?? Date.now()).toISOString(), weekWorkouts: stats.workouts, weekStreak: stats.streak, recent, bests }
}
