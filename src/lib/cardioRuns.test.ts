import { describe, expect, it } from 'vitest'
import { runCalories } from './calories'
import { newCardioBests } from './cardioBests'
import { runsOf, withRuns } from './cardioRuns'
import { repairState } from './migrate'
import { cardioSessions } from './stats'

const units = { weight: 'lb', distance: 'mi' } as const
const km = (k: number) => k / 1.609344

describe('more than one run on a day', () => {
  it('keeps each run and puts their totals on top; one run is a plain log again', () => {
    const two = withRuns({ distance: 3, minutes: 27, done: true }, [{ distance: 3, minutes: 27 }, { distance: 2, minutes: 17, calories: 200 }])
    expect(two).toMatchObject({ distance: 5, minutes: 44, done: true, parts: [{ distance: 3, minutes: 27 }, { distance: 2, minutes: 17, calories: 200 }] })
    // A calorie total only when every run has its own number.
    expect(two.calories).toBeUndefined()
    expect(withRuns(two, [{ distance: 3, minutes: 27, calories: 300 }, { distance: 2, minutes: 17, calories: 200 }]).calories).toBe(500)
    expect(runsOf(two)).toHaveLength(2)
    const one = withRuns(two, [{ distance: 2, minutes: 17, calories: 200 }])
    expect(one).toEqual({ distance: 2, minutes: 17, calories: 200, done: true })
    expect(runsOf(one)).toEqual([one])
    expect(runsOf(undefined)).toEqual([])
  })
  it('records judge each run: two 2.5 km runs are not a 5K, and the day’s total is not the longest run', () => {
    const before = [
      { date: '2026-10-01', exerciseId: 'running', cardio: { distance: km(5), minutes: 25 } },
      { date: '2026-10-02', exerciseId: 'running', cardio: { distance: 4, minutes: 36 } },
    ]
    const today = withRuns({ distance: null, minutes: null }, [{ distance: km(2.5), minutes: 10 }, { distance: km(2.5), minutes: 10 }])
    expect(newCardioBests(before, 'running', today, '2026-10-03', units)).toEqual([])
    // A run inside the day that's a record still counts.
    const fast = withRuns({ distance: null, minutes: null }, [{ distance: 1, minutes: 9 }, { distance: km(5), minutes: 24 }])
    expect(newCardioBests(before, 'running', fast, '2026-10-03', units).map((b) => b.key)).toContain('fastest-5k')
    // Charts and pace see two sessions on that day, each with its own pace.
    const s = cardioSessions([...before, { date: '2026-10-03', exerciseId: 'running', cardio: fast }], 'running').filter((x) => x.date === '2026-10-03')
    expect(s.map((x) => x.distance)).toEqual([1, km(5)])
  })
  it('calories add up run by run: a watch’s number where typed, the estimate for the others', () => {
    const lb = 180
    const est = runCalories('running', { distance: 2, minutes: 17 }, lb, null, '2026-10-03')!.kcal
    const day = runCalories('running', withRuns({ distance: null, minutes: null }, [{ distance: 3, minutes: 27, calories: 300 }, { distance: 2, minutes: 17 }]), lb, null, '2026-10-03')!
    expect(day).toEqual({ kcal: 300 + est, estimated: true })
  })
  it('a restored backup checks each run and rebuilds the totals', () => {
    const saved = { logs: [{ date: '2026-10-03', exerciseId: 'running', cardio: { distance: 99, minutes: 99, parts: [{ distance: 3, minutes: 27 }, { distance: 'two', minutes: 17 }] } }] }
    const out = repairState(saved, { logs: [] as unknown[] }) as { logs: { cardio: { distance: number; minutes: number; parts: unknown[] } }[] }
    expect(out.logs[0].cardio).toMatchObject({ distance: 3, minutes: 44, parts: [{ distance: 3, minutes: 27 }, { distance: null, minutes: 17 }] })
  })
})
