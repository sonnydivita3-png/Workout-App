import type { Exercise, ExerciseLog, PlannedExercise, Units } from '../types'
import { newCardioBests } from './cardioBests'
import { sessionBasis, sessionScore, sessionVolume } from './progression'
import { hasData } from './stats'
import { isTicked, setRows, workingRows } from './setRows'

export interface ExerciseResult {
  exerciseId: string
  name: string
  /**
   * Compared with the last time you did it. 'done': logged, but not comparable with last time (e.g. weighted last
   * time, bodyweight today).
   */
  status: 'up' | 'same' | 'down' | 'new' | 'done' | 'skipped'
  /** New best ever (not just better than last time). */
  pr: boolean
  /** Cardio: the records it set, e.g. "Fastest 5K yet: 24:51". */
  best?: string
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

/**
 * Whether an exercise was done today: cardio with a distance or time; a lift with a working set ticked or filled in.
 * A bodyweight set (reps, no weight) counts like any other.
 */
function did(l: ExerciseLog | undefined, ex: Exercise): boolean {
  if (!l) return false
  if (ex.kind === 'cardio') return hasData(l)
  return (l.sets ?? []).some((s) => !s.warmup && !s.drop && isTicked(s))
}

/**
 * How today went against your previous efforts, exercise by exercise. Lifts are compared with last time (progressive
 * overload). Cardio isn't: a shorter, easier run than last time is often the plan, so it's just "done", and it only
 * counts as a best when it sets a real record (see cardioBests).
 */
export function workoutSummary(date: string, items: PlannedExercise[], logs: ExerciseLog[], lookup: (id: string) => Exercise | undefined, units: Units = { weight: 'lb', distance: 'mi' }): WorkoutSummary {
  const results: ExerciseResult[] = []
  let liftVolume = 0
  let lastLiftVolume = 0
  for (const id of [...new Set(items.filter((i) => !i.warmup).map((i) => i.exerciseId))]) {
    const ex = lookup(id)
    if (!ex) continue
    const now = logs.find((l) => l.date === date && l.exerciseId === id)
    const before = logs.filter((l) => l.exerciseId === id && l.date < date && hasData(l)).sort((a, b) => b.date.localeCompare(a.date))
    const last = before[0]
    if (ex.kind === 'cardio') {
      const done = did(now, ex)
      const bests = done ? newCardioBests(logs, id, now?.cardio, date, units, ex) : []
      results.push({
        exerciseId: id, name: ex.name, status: !done ? 'skipped' : last ? 'done' : 'new', pr: bests.length > 0,
        ...(bests.length ? { best: bests.map((b) => `${b.title}: ${b.value}`).join(' · ') } : {}),
        score: 0, lastScore: 0, volume: 0, lastVolume: 0,
      })
      continue
    }
    const score = sessionScore(now, ex.mode, ex.kind)
    const lastScore = sessionScore(last, ex.mode, ex.kind)
    const volume = sessionVolume(now, ex.mode)
    const lastVolume = sessionVolume(last, ex.mode)
    const basis = sessionBasis(now, ex.mode, ex.kind)
    // Bests only count sessions measured the same way (weighted vs bodyweight).
    const best = Math.max(0, ...before.filter((l) => sessionBasis(l, ex.mode, ex.kind) === basis).map((l) => sessionScore(l, ex.mode, ex.kind)))
    let status: ExerciseResult['status']
    if (!did(now, ex)) status = 'skipped'
    else if (!last) status = 'new'
    else if (!basis || basis !== sessionBasis(last, ex.mode, ex.kind) || score === 0 || lastScore === 0) status = 'done'
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
    // The working sets exactly as the card shows them: a set made into a warm-up isn't a missing working set. Ticked
    // sets are done (older sets without a tick count when they have numbers); typed but unticked ones aren't yet.
    const work = workingRows(setRows(p, log?.sets))
    const done = work.filter(isTicked).length
    if (done < work.length) out.push({ exerciseId: ex.id, name: ex.name, done, planned: work.length, cardio: false })
  }
  return out
}
