import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { ExerciseLog } from '../types'
import { unfinished, workoutSummary } from './summary'

const B = 'Barbell_Bench_Press_-_Medium_Grip'
const lift = (date: string, weight: number, reps: number, id = B): ExerciseLog => ({ date, exerciseId: id, sets: [{ weight, reps }, { weight, reps }] })

describe('workoutSummary', () => {
  it('compares each exercise with last time and spots new bests', () => {
    const logs = [lift('2026-09-01', 145, 8), lift('2026-09-10', 135, 8), lift('2026-09-20', 150, 8), { date: '2026-09-20', exerciseId: 'Pushups', sets: [{ weight: null, reps: 20 }] }, { date: '2026-09-10', exerciseId: 'Pushups', sets: [{ weight: null, reps: 25 }] }]
    const s = workoutSummary('2026-09-20', [{ exerciseId: B, sets: 2 }, { exerciseId: 'Pushups', sets: 2 }, { exerciseId: 'Plank', sets: 2 }], logs, (id) => BUILTIN_BY_ID.get(id))
    expect(s.results.map((r) => [r.name.slice(0, 7), r.status, r.pr])).toEqual([['Bench P', 'up', true], ['Push-Up', 'down', false], ['Plank', 'skipped', false]])
    expect(s).toMatchObject({ beat: 1, compared: 2, prs: 1, liftVolume: 150 * 16, lastLiftVolume: 135 * 16 })
  })
  it('first time is "new", not a PR', () => {
    const s = workoutSummary('2026-09-20', [{ exerciseId: B, sets: 2 }], [lift('2026-09-20', 100, 5)], (id) => BUILTIN_BY_ID.get(id))
    expect(s.results[0]).toMatchObject({ status: 'new', pr: false })
  })
})

describe('unfinished', () => {
  it('lists lifts short of their planned sets and cardio with nothing logged', () => {
    const items = [
      { exerciseId: B, sets: 3 },
      { exerciseId: 'Pushups', sets: 2 },
      { exerciseId: 'running', sets: 1 },
      { exerciseId: 'Plank', sets: 2, warmup: true },
    ]
    const logs = [
      { date: 'd', exerciseId: B, sets: [{ weight: 95, reps: 5, warmup: true }, { weight: 135, reps: 8 }, { weight: 135, reps: 8 }] },
      { date: 'd', exerciseId: 'Pushups', sets: [{ weight: null, reps: 20 }, { weight: null, reps: 18 }] },
    ]
    const u = unfinished('d', items, logs, (id) => BUILTIN_BY_ID.get(id))
    expect(u.map((x) => [x.exerciseId, x.done, x.planned])).toEqual([[B, 2, 3], ['running', 0, 1]])
  })
})

describe('ticked sets', () => {
  it('counts ticked sets, and older sets with numbers; typed but unticked sets are not done yet', () => {
    const items = [{ exerciseId: 'Pushups', sets: 4 }]
    const sets = [
      { weight: null, reps: 10, done: true },
      { weight: null, reps: 10 }, // saved before ticks existed
      { weight: null, reps: 12, done: false }, // typed, not ticked
      { weight: null, reps: null, done: false },
    ]
    const u = unfinished('d', items, [{ date: 'd', exerciseId: 'Pushups', sets }], (id) => BUILTIN_BY_ID.get(id))
    expect(u.map((x) => [x.done, x.planned])).toEqual([[2, 4]])
  })
})
