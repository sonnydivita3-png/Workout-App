import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import { weeklySets } from './muscles'

describe('weeklySets', () => {
  it('counts working sets per muscle, this week vs last, ignoring warm-ups and cardio', () => {
    const logs = [
      { date: '2026-09-29', exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', sets: [{ weight: 95, reps: 10, warmup: true }, { weight: 135, reps: 8 }, { weight: 135, reps: 8 }] },
      { date: '2026-09-30', exerciseId: 'Pushups', sets: [{ weight: null, reps: 20 }] },
      { date: '2026-09-22', exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', sets: [{ weight: 135, reps: 8 }] },
      { date: '2026-09-29', exerciseId: 'running', cardio: { distance: 3, minutes: 27 } },
    ]
    const w = weeklySets(logs, '2026-09-30', (id) => BUILTIN_BY_ID.get(id))
    expect(w.thisWeek.Chest).toBe(3)
    expect(w.lastWeek.Chest).toBe(1)
    expect(w.thisWeek.Legs).toBe(0)
  })
})
