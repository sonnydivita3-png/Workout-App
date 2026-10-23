import { describe, expect, it } from 'vitest'
import type { ExerciseLog } from '../types'
import { bodyweightOn, caloriesOf, estimateCalories, hasPersonalDetails, metFor, profileComplete, restingPerHour } from './calories'

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
  it('net of resting burn: a 30-minute 6 mph run at 185 lb is about 369 calories (411 gross − 42 resting)', () => {
    expect(estimateCalories('running', { distance: 3, minutes: 30 }, 185)).toBe(369)
  })

  it('a 7-mile run at 9:00/mi, 185 lb: about 835 net, roughly 0.63 cal per lb per mile', () => {
    const kcal = estimateCalories('running', { distance: 7, minutes: 63 }, 185)!
    expect(kcal).toBeGreaterThan(800)
    expect(kcal).toBeLessThan(860)
    expect(kcal / (185 * 7)).toBeCloseTo(0.64, 1)
  })

  it('sex, age and height set the resting burn (Mifflin-St Jeor); without them, 1 MET', () => {
    const man = { sex: 'male', birthYear: 1986, heightIn: 70 } as const
    // 10×83.9 + 6.25×177.8 − 5×40 + 5 = 1755 kcal/day
    expect(restingPerHour(185, '2026-10-01', man)).toBeCloseTo(1755 / 24, 0)
    expect(restingPerHour(185, '2026-10-01', { ...man, sex: 'female' })).toBeCloseTo((1755 - 166) / 24, 0)
    expect(restingPerHour(185, '2026-10-01', { ...man, sex: null })).toBeCloseTo((1755 - 83) / 24, 0)
    expect(restingPerHour(185, '2026-10-01', null)).toBeCloseTo(83.9, 1)
    // Lower resting burn → a bit more counted as exercise.
    expect(estimateCalories('running', { distance: 3, minutes: 30 }, 185, { ...man, sex: 'female' }, '2026-10-01')!).toBeGreaterThan(estimateCalories('running', { distance: 3, minutes: 30 }, 185, man, '2026-10-01')!)
  })

  it('ignores unbelievable profile numbers (e.g. while typing)', () => {
    expect(hasPersonalDetails({ sex: 'male', birthYear: 19, heightIn: 70 })).toBe(false)
    expect(hasPersonalDetails({ sex: 'male', birthYear: 1990, heightIn: 7 })).toBe(false)
    expect(hasPersonalDetails({ sex: null, birthYear: 1990, heightIn: 66 })).toBe(true)
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
    expect(caloriesOf({ ...l, cardio: { ...l.cardio!, calories: null } }, [{ date: '2026-09-01', lb: 185 }])).toEqual({ kcal: 369, estimated: true })
    expect(caloriesOf({ ...l, cardio: { ...l.cardio!, calories: null } }, [])).toBeNull()
  })
})

describe('profileComplete: what the app asks for before it can be used', () => {
  const me = { sex: 'male' as const, birthYear: 1990, heightIn: 70 }
  const weighed = [{ date: '2026-01-01', lb: 180 }]
  it('needs sex (or prefer not to say), a believable birth year and height, and a weigh-in', () => {
    expect(profileComplete(me, weighed)).toBe(true)
    expect(profileComplete({ ...me, sex: 'unspecified' }, weighed)).toBe(true)
    expect(profileComplete({ ...me, sex: null }, weighed)).toBe(false)
    expect(profileComplete({ ...me, birthYear: 19 }, weighed)).toBe(false)
    expect(profileComplete({ ...me, heightIn: 7 }, weighed)).toBe(false)
    expect(profileComplete(me, [])).toBe(false)
    expect(profileComplete(null, weighed)).toBe(false)
  })
  it('prefer not to say: resting burn halfway between men and women', () => {
    const r = (sex: 'male' | 'female' | 'unspecified') => restingPerHour(180, '2026-10-23', { ...me, sex })
    expect(r('unspecified')).toBeCloseTo((r('male') + r('female')) / 2, 6)
  })
})
