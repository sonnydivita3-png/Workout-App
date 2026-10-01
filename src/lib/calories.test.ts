import { describe, expect, it } from 'vitest'
import type { ExerciseLog } from '../types'
import { bodyweightOn, caloriesOf, estimateCalories, metFor } from './calories'

describe('MET by activity and speed', () => {
  it('uses speed for runs, walks and rides when distance is logged', () => {
    expect(metFor('running', { distance: 3, minutes: 30 })).toBeCloseTo(9.8) // 6 mph
    expect(metFor('running', { distance: 4, minutes: 30 })).toBeCloseTo(11.8) // 8 mph
    expect(metFor('running', { distance: null, minutes: 30 })).toBe(8.0)
    expect(metFor('cycling', { distance: 7, minutes: 30 })).toBeCloseTo(9.0) // 14 mph, between 13 (8.0) and 15 (10.0)
  })

  it('a slow "run" counts as a walk, a fast walk as a run; machines use a fixed value', () => {
    expect(metFor('running', { distance: 1, minutes: 20 })).toBeCloseTo(3.5) // 3 mph
    expect(metFor('walking', { distance: 2.5, minutes: 30 })).toBeCloseTo(8.3) // 5 mph: the running curve
    expect(metFor('x-row-erg', { distance: 3, minutes: 20 })).toBe(7.0)
    expect(metFor('some-custom-cardio', { distance: null, minutes: 20 })).toBe(6.0)
  })
})

describe('estimates', () => {
  it('MET × kg × hours: a 30-minute 6 mph run at 185 lb is about 411 calories', () => {
    expect(estimateCalories('running', { distance: 3, minutes: 30 }, 185)).toBe(411)
  })

  it('needs a bodyweight and minutes', () => {
    expect(estimateCalories('running', { distance: 3, minutes: 30 }, null)).toBeNull()
    expect(estimateCalories('running', { distance: 3, minutes: null }, 185)).toBeNull()
  })

  it('uses the bodyweight from that day (or the first one logged)', () => {
    const bw = [{ date: '2026-09-01', lb: 200 }, { date: '2026-09-20', lb: 190 }]
    expect(bodyweightOn(bw, '2026-09-25')).toBe(190)
    expect(bodyweightOn(bw, '2026-09-10')).toBe(200)
    expect(bodyweightOn(bw, '2026-08-01')).toBe(200)
    expect(bodyweightOn([], '2026-08-01')).toBeNull()
  })

  it('their own number wins over the estimate', () => {
    const l: ExerciseLog = { date: '2026-09-25', exerciseId: 'running', cardio: { distance: 3, minutes: 30, calories: 350 } }
    expect(caloriesOf(l, [{ date: '2026-09-01', lb: 185 }])).toEqual({ kcal: 350, estimated: false })
    expect(caloriesOf({ ...l, cardio: { ...l.cardio!, calories: null } }, [{ date: '2026-09-01', lb: 185 }])).toEqual({ kcal: 411, estimated: true })
    expect(caloriesOf({ ...l, cardio: { ...l.cardio!, calories: null } }, [])).toBeNull()
  })
})
