import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { ExerciseLog } from '../types'
import { workoutSummary } from './summary'

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
