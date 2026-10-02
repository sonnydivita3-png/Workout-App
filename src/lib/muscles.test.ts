import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import { weeklySets, weeklyTarget } from './muscles'

describe('weeklySets', () => {
  it('counts working sets per muscle, this week vs last, ignoring warm-ups and cardio', () => {
    const logs = [
      { date: '2026-09-29', exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', sets: [{ weight: 95, reps: 10, warmup: true }, { weight: 135, reps: 8 }, { weight: 135, reps: 8 }] },
      { date: '2026-09-30', exerciseId: 'Pushups', sets: [{ weight: null, reps: 20 }] },
      { date: '2026-09-22', exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', sets: [{ weight: 135, reps: 8 }] },
      { date: '2026-09-29', exerciseId: 'running', cardio: { distance: 3, minutes: 27 } },
      { date: '2026-09-30', exerciseId: 'Barbell_Squat', sets: [{ weight: 185, reps: 5 }, { weight: 185, reps: 5 }] },
      { date: '2026-09-30', exerciseId: 'Dumbbell_Bicep_Curl', sets: [{ weight: 30, reps: 10 }] },
    ]
    const w = weeklySets(logs, '2026-09-30', (id) => BUILTIN_BY_ID.get(id))
    expect(w.thisWeek.Chest).toBe(3)
    expect(w.lastWeek.Chest).toBe(1)
    // Legs and arms are split into parts.
    expect(w.thisWeek.Quads).toBe(2)
    expect(w.thisWeek.Biceps).toBe(1)
    expect(w.thisWeek.Hamstrings).toBe(0)
    expect('Legs' in w.thisWeek).toBe(false)
  })
})

describe('weekly hard-set targets', () => {
  it('come from the goal, with smaller muscles at about 60%', () => {
    expect(weeklyTarget('Chest', 'muscle')).toBe(12)
    expect(weeklyTarget('Biceps', 'muscle')).toBe(7)
    expect(weeklyTarget('Quads', 'strength')).toBe(8)
    expect(weeklyTarget('Back', 'fitness')).toBe(6)
    expect(weeklyTarget('Core', 'fitness')).toBe(4)
  })
  it('use their own number when set, else the usual 10', () => {
    expect(weeklyTarget('Chest', 'muscle', 16)).toBe(16)
    expect(weeklyTarget('Triceps', 'muscle', 16)).toBe(10)
    expect(weeklyTarget('Chest', null)).toBe(10)
    expect(weeklyTarget('Chest', 'nonsense' as never)).toBe(10)
    expect(weeklyTarget('Calves', null, 2)).toBe(2)
  })
})

describe('targets with several goals', () => {
  it('use the biggest dose any goal needs', () => {
    expect(weeklyTarget('Chest', ['fatloss', 'muscle'])).toBe(12)
    expect(weeklyTarget('Chest', ['fitness', 'strength'])).toBe(8)
    expect(weeklyTarget('Chest', [])).toBe(10)
  })
})
