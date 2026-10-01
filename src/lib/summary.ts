import type { Exercise, ExerciseLog, PlannedExercise } from '../types'
import { sessionScore, sessionVolume } from './progression'
import { hasData } from './stats'

export interface ExerciseResult {
  exerciseId: string
  name: string
  /** Compared with the last time you did it. */
  status: 'up' | 'same' | 'down' | 'new' | 'skipped'
  /** New best ever (not just better than last time). */
  pr: boolean
  score: number
  lastScore: number
  volume: number
  lastVolume: number
}

export interface WorkoutSummary {
  results: ExerciseResult[]
  beat: number
  compared: number
  prs: number
  /** Weight × reps for lifts only, in pounds, this time vs the same lifts last time. */
  liftVolume: number
  lastLiftVolume: number
}

/** How today went against your previous efforts, exercise by exercise. */
export function workoutSummary(date: string, items: PlannedExercise[], logs: ExerciseLog[], lookup: (id: string) => Exercise | undefined): WorkoutSummary {
  const results: ExerciseResult[] = []
  let liftVolume = 0
  let lastLiftVolume = 0
  for (const id of [...new Set(items.filter((i) => !i.warmup).map((i) => i.exerciseId))]) {
    const ex = lookup(id)
    if (!ex) continue
    const now = logs.find((l) => l.date === date && l.exerciseId === id)
    const before = logs.filter((l) => l.exerciseId === id && l.date < date && hasData(l)).sort((a, b) => b.date.localeCompare(a.date))
    const last = before[0]
    const score = sessionScore(now, ex.mode, ex.kind)
    const lastScore = sessionScore(last, ex.mode, ex.kind)
    const volume = ex.kind === 'cardio' ? now?.cardio?.distance ?? now?.cardio?.minutes ?? 0 : sessionVolume(now, ex.mode)
    const lastVolume = ex.kind === 'cardio' ? last?.cardio?.distance ?? last?.cardio?.minutes ?? 0 : sessionVolume(last, ex.mode)
    const best = Math.max(0, ...before.map((l) => sessionScore(l, ex.mode, ex.kind)))
    let status: ExerciseResult['status']
    if (!now || !hasData(now) || score === 0) status = 'skipped'
    else if (!last || lastScore === 0) status = 'new'
    else status = score > lastScore + 0.01 ? 'up' : score < lastScore - 0.01 ? 'down' : 'same'
    if (ex.kind === 'strength' && (ex.mode ?? 'weight') === 'weight' && status !== 'skipped') { liftVolume += volume; if (last) lastLiftVolume += lastVolume }
    results.push({ exerciseId: id, name: ex.name, status, pr: status === 'up' && score > best + 0.01, score, lastScore, volume, lastVolume })
  }
  const compared = results.filter((r) => r.status === 'up' || r.status === 'same' || r.status === 'down').length
  return { results, beat: results.filter((r) => r.status === 'up').length, compared, prs: results.filter((r) => r.pr).length, liftVolume, lastLiftVolume }
}

export interface Unfinished { exerciseId: string; name: string; done: number; planned: number; cardio: boolean }

/**
 * What's planned for a day but not logged: lifts with fewer working sets than planned, and cardio with nothing
 * logged. Warm-ups and timed blocks (which log a single result) aren't counted.
 */
export function unfinished(date: string, items: PlannedExercise[], logs: ExerciseLog[], lookup: (id: string) => Exercise | undefined): Unfinished[] {
  const out: Unfinished[] = []
  for (const p of items) {
    if (p.warmup || p.wod) continue
    const ex = lookup(p.exerciseId)
    if (!ex) continue
    const log = logs.find((l) => l.date === date && l.exerciseId === p.exerciseId)
    if (ex.kind === 'cardio') {
      if (!log?.cardio?.distance && !log?.cardio?.minutes) out.push({ exerciseId: ex.id, name: ex.name, done: 0, planned: 1, cardio: true })
      continue
    }
    // Ticked sets (older sets without a tick count when they have numbers); typed but unticked ones aren't done yet.
    const done = (log?.sets ?? []).filter((s) => !s.warmup && (s.done ?? !!(s.weight || s.reps || s.seconds))).length
    if (done < p.sets) out.push({ exerciseId: ex.id, name: ex.name, done, planned: p.sets, cardio: false })
  }
  return out
}
