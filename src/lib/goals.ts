import { BUILTIN_BY_ID } from '../data/exercises'
import type { BodyweightEntry, Exercise, ExerciseLog, Goal, Units } from '../types'
import { bestEffort, longestSession, periodKey, periodTotals } from './cardio'
import { fmtShort } from './dates'
import { bestLift, weekStats } from './stats'
import { formatMinutes, formatPace, formatSeconds, showDistance, showSpeed, showWeight, speedUnit } from './units'

type Lookup = (id: string) => Exercise | undefined
const builtin: Lookup = (id) => BUILTIN_BY_ID.get(id)

/** Goals that reset every week or month. */
export const isPeriodic = (g: Goal): g is Extract<Goal, { period: unknown }> | Extract<Goal, { type: 'workouts' }> =>
  g.type === 'workouts' || g.type === 'cardio-distance' || g.type === 'cardio-time'

/** A key that changes when a periodic goal's week/month rolls over. */
export const goalPeriodKey = (g: Goal, today: string) =>
  g.type === 'workouts' ? periodKey('week', today) : g.type === 'cardio-distance' || g.type === 'cardio-time' ? periodKey(g.period, today) : ''

/** Progress toward a goal, 0–1. */
export function goalPct(goal: Goal, logs: ExerciseLog[], bodyweight: BodyweightEntry[], today: string, lookup: Lookup = builtin): number {
  let pct = 0
  switch (goal.type) {
    case 'workouts':
      pct = weekStats(logs, today).workouts / goal.perWeek
      break
    case 'bodyweight': {
      const now = bodyweight.at(-1)?.lb ?? null
      const start = goal.start ?? bodyweight[0]?.lb ?? null
      if (now != null && start != null) pct = start === goal.target ? 1 : (start - now) / (start - goal.target)
      break
    }
    case 'lift':
      pct = bestLift(logs, goal.exerciseId, goal.mode) / goal.target
      break
    case 'cardio-distance':
      pct = periodTotals(logs, goal.sport, goal.period, today, lookup).distance / goal.target
      break
    case 'cardio-time':
      pct = periodTotals(logs, goal.sport, goal.period, today, lookup).minutes / goal.target
      break
    case 'cardio-pace': {
      const best = bestEffort(logs, goal.sport, goal.minDistance, today, lookup)
      if (best != null) pct = goal.sport === 'run' ? goal.target / best : best / goal.target // faster run pace = smaller number
      break
    }
    case 'race':
      pct = longestSession(logs, goal.sport, today, lookup) / goal.distance
      break
  }
  return Math.max(0, Math.min(1, pct))
}

const SPORT_WORD = { run: 'Run', bike: 'Ride', any: 'Cardio' } as const

export function goalTitle(goal: Goal, units: Units, exerciseName: (id: string) => string | undefined): string {
  switch (goal.type) {
    case 'workouts':
      return `${goal.perWeek} workouts a week`
    case 'bodyweight':
      return `Body weight → ${showWeight(goal.target, units)} ${units.weight}`
    case 'lift': {
      const name = exerciseName(goal.exerciseId) ?? 'Lift'
      if (goal.mode === 'reps') return `${name} → ${goal.target} reps`
      if (goal.mode === 'time') return `${name} → ${formatSeconds(goal.target)} hold`
      return `${name} → ${showWeight(goal.target, units)} ${units.weight}`
    }
    case 'cardio-distance':
      return `${SPORT_WORD[goal.sport]} ${showDistance(goal.target, units)} ${units.distance} a ${goal.period}`
    case 'cardio-time':
      return `${SPORT_WORD[goal.sport]} ${formatMinutes(goal.target)} a ${goal.period}`
    case 'cardio-pace':
      return goal.sport === 'run'
        ? `Run ${showDistance(goal.minDistance, units)} ${units.distance} at ${formatPace(1, goal.target, units)}`
        : `Ride ${showDistance(goal.minDistance, units)} ${units.distance} at ${showSpeed(goal.target, units)} ${speedUnit(units)}`
    case 'race':
      return goal.date ? `${goal.label} · ${fmtShort(goal.date)}` : goal.label
  }
}

/** The "where you are now" line under a goal's progress bar. */
export function goalDetail(
  goal: Goal,
  ctx: { logs: ExerciseLog[]; bodyweight: BodyweightEntry[]; units: Units; today: string; lookup?: Lookup },
): string {
  const { logs, bodyweight, units, today } = ctx
  const lookup = ctx.lookup ?? builtin
  switch (goal.type) {
    case 'workouts':
      return `${weekStats(logs, today).workouts} / ${goal.perWeek} this week`
    case 'bodyweight': {
      const now = bodyweight.at(-1)?.lb ?? null
      return now == null ? 'Log your weight to start' : `Now ${showWeight(now, units)} ${units.weight}`
    }
    case 'lift': {
      const best = bestLift(logs, goal.exerciseId, goal.mode)
      const shown = goal.mode === 'reps' ? `${best} reps` : goal.mode === 'time' ? formatSeconds(best) : `${showWeight(best, units)} ${units.weight}`
      return best ? `Best ${shown}` : 'Not logged yet'
    }
    case 'cardio-distance': {
      const { distance } = periodTotals(logs, goal.sport, goal.period, today, lookup)
      return `${showDistance(distance, units)} ${units.distance} this ${goal.period}`
    }
    case 'cardio-time': {
      const { minutes } = periodTotals(logs, goal.sport, goal.period, today, lookup)
      return `${formatMinutes(minutes)} this ${goal.period}`
    }
    case 'cardio-pace': {
      const best = bestEffort(logs, goal.sport, goal.minDistance, today, lookup)
      if (best == null) return `No ${showDistance(goal.minDistance, units)}+ ${units.distance} ${goal.sport === 'run' ? 'run' : 'ride'} yet`
      return `Best ${goal.sport === 'run' ? formatPace(1, best, units) : `${showSpeed(best, units)} ${speedUnit(units)}`}`
    }
    case 'race': {
      const longest = longestSession(logs, goal.sport, today, lookup)
      const days = goal.date ? Math.round((new Date(goal.date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000) : null
      const when = days == null ? '' : days > 0 ? ` · ${days} day${days === 1 ? '' : 's'} to go` : days === 0 ? ' · race day' : ''
      return `Longest ${showDistance(longest, units)} of ${showDistance(goal.distance, units)} ${units.distance}${when}`
    }
  }
}
