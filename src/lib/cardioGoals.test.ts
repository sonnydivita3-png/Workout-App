import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { ExerciseLog, Goal, NotifPrefs, Units } from '../types'
import { bestEffort, longestSession, periodRange, periodTotals, sportOf } from './cardio'
import { goalDetail, goalPct, goalTitle } from './goals'
import { computeNotifications } from './notify'

const TODAY = '2026-09-29' // Tuesday
const mi: Units = { weight: 'lb', distance: 'mi' }
const km: Units = { weight: 'kg', distance: 'km' }
const run = (date: string, distance: number, minutes: number): ExerciseLog => ({ date, exerciseId: 'running', cardio: { distance, minutes } })
const ride = (date: string, distance: number, minutes: number): ExerciseLog => ({ date, exerciseId: 'cycling', cardio: { distance, minutes } })
const pct = (g: Goal, logs: ExerciseLog[]) => goalPct(g, logs, [], TODAY)

describe('sport detection', () => {
  it('classifies by name, including library and custom exercises', () => {
    const ex = (name: string) => ({ id: 'x', name, kind: 'cardio' as const, group: 'Cardio' })
    expect(sportOf(BUILTIN_BY_ID.get('running'))).toBe('run')
    expect(sportOf(BUILTIN_BY_ID.get('cycling'))).toBe('bike')
    expect(sportOf(ex('Treadmill'))).toBe('run')
    expect(sportOf(ex('Jogging, Treadmill'))).toBe('run')
    expect(sportOf(ex('Recumbent Bike'))).toBe('bike')
    expect(sportOf(ex('Bicycling, Stationary'))).toBe('bike')
    expect(sportOf(ex('Rowing, Stationary'))).toBe('other')
    expect(sportOf({ ...ex('Running'), kind: 'strength' })).toBe('other')
    expect(sportOf(undefined)).toBe('other')
  })
})

describe('periods', () => {
  it('week is Mon–Sun and month is the calendar month', () => {
    expect(periodRange('week', TODAY)).toEqual(['2026-09-28', '2026-10-04'])
    expect(periodRange('month', TODAY)).toEqual(['2026-09-01', '2026-09-30'])
  })
  it('totals only this period, only up to today, only that sport', () => {
    const logs = [run('2026-09-28', 5, 45), run(TODAY, 3, 27), run('2026-09-30', 10, 90), run('2026-09-21', 8, 70), ride('2026-09-28', 20, 80)]
    expect(periodTotals(logs, 'run', 'week', TODAY)).toEqual({ distance: 8, minutes: 72 })
    expect(periodTotals(logs, 'bike', 'week', TODAY)).toEqual({ distance: 20, minutes: 80 })
    expect(periodTotals(logs, 'any', 'week', TODAY).distance).toBe(28)
    expect(periodTotals(logs, 'run', 'month', TODAY).distance).toBe(16) // includes the 21st, not tomorrow
  })
})

describe('goal progress', () => {
  const logs = [run('2026-09-28', 5, 45), run(TODAY, 3, 27), run('2026-09-30', 10, 90)]
  it('weekly mileage', () => {
    expect(pct({ id: 'a', type: 'cardio-distance', sport: 'run', period: 'week', target: 16 }, logs)).toBe(0.5)
    expect(pct({ id: 'a', type: 'cardio-distance', sport: 'run', period: 'week', target: 8 }, logs)).toBe(1)
    expect(pct({ id: 'a', type: 'cardio-distance', sport: 'bike', period: 'week', target: 8 }, logs)).toBe(0)
  })
  it('weekly time', () => {
    expect(pct({ id: 'a', type: 'cardio-time', sport: 'any', period: 'week', target: 144 }, logs)).toBe(0.5)
  })
  it('run pace: faster than target completes it, slower is partial, needs the minimum distance', () => {
    // 5 mi in 45 min = 9:00/mi; 3 mi in 27 min = 9:00/mi
    const goal = (target: number, minDistance = 3): Goal => ({ id: 'p', type: 'cardio-pace', sport: 'run', minDistance, target })
    expect(bestEffort(logs, 'run', 3, TODAY)).toBeCloseTo(9)
    expect(pct(goal(9), logs)).toBe(1)
    expect(pct(goal(8), logs)).toBeCloseTo(8 / 9)
    expect(pct(goal(9, 6), logs)).toBe(0) // no run that long yet (tomorrow's 10 mi doesn't count)
  })
  it('bike speed', () => {
    const logs2 = [ride('2026-09-20', 30, 120)] // 15 mph
    const g = (target: number): Goal => ({ id: 'b', type: 'cardio-pace', sport: 'bike', minDistance: 20, target })
    expect(bestEffort(logs2, 'bike', 20, TODAY)).toBeCloseTo(15)
    expect(pct(g(15), logs2)).toBe(1)
    expect(pct(g(20), logs2)).toBeCloseTo(0.75)
  })
  it('an event is done when one session reaches the distance', () => {
    const half: Goal = { id: 'r', type: 'race', sport: 'run', label: 'Half marathon', distance: 13.109 }
    expect(pct(half, [run('2026-09-20', 6.5545, 60)])).toBeCloseTo(0.5)
    expect(pct(half, [run('2026-09-20', 6, 60), run('2026-09-25', 6, 60)])).toBeLessThan(0.5) // sessions don't add up
    expect(pct(half, [run('2026-09-20', 13.2, 130)])).toBe(1)
    expect(longestSession([run('2026-09-30', 20, 200)], 'run', TODAY)).toBe(0) // future
  })
})

describe('goal text', () => {
  it('reads naturally in miles and km', () => {
    expect(goalTitle({ id: 'a', type: 'cardio-distance', sport: 'run', period: 'week', target: 20 }, mi, () => undefined)).toBe('Run 20 mi a week')
    expect(goalTitle({ id: 'a', type: 'cardio-distance', sport: 'run', period: 'week', target: 20 }, km, () => undefined)).toBe('Run 32.19 km a week')
    expect(goalTitle({ id: 'a', type: 'cardio-time', sport: 'bike', period: 'month', target: 600 }, mi, () => undefined)).toBe('Ride 10h 00m a month')
    expect(goalTitle({ id: 'a', type: 'cardio-pace', sport: 'run', minDistance: 3.107, target: 8 }, mi, () => undefined)).toBe('Run 3.11 mi at 8:00 /mi')
    expect(goalTitle({ id: 'a', type: 'cardio-pace', sport: 'bike', minDistance: 25, target: 15 }, km, () => undefined)).toBe('Ride 40.23 km at 24.1 km/h')
    expect(goalTitle({ id: 'a', type: 'race', sport: 'run', label: 'Marathon', distance: 26.219, date: '2026-10-25' }, mi, () => undefined)).toBe('Marathon · Oct 25')
  })
  it('detail shows progress and days to go', () => {
    const g: Goal = { id: 'r', type: 'race', sport: 'run', label: 'Marathon', distance: 26.219, date: '2026-10-09' }
    const d = goalDetail(g, { logs: [run('2026-09-27', 18, 200)], bodyweight: [], units: mi, today: TODAY })
    expect(d).toBe('Longest 18 of 26.22 mi · 10 days to go')
    expect(goalDetail({ id: 'x', type: 'cardio-pace', sport: 'run', minDistance: 3.1, target: 8 }, { logs: [], bodyweight: [], units: mi, today: TODAY })).toContain('No 3.1+ mi run yet')
  })
})

describe('notifications for cardio goals', () => {
  const prefs: NotifPrefs = { system: false, goals: true, pbs: true, daily: false, reminderTime: '17:00' }
  const notes = (goals: Goal[], logs: ExerciseLog[], today = TODAY) =>
    computeNotifications({ logs, goals, bodyweight: [], plan: Array.from({ length: 7 }, () => []), units: mi, prefs, today, nowMinutes: 600, exerciseName: (id) => BUILTIN_BY_ID.get(id) })
  const weekly: Goal = { id: 'w', type: 'cardio-distance', sport: 'run', period: 'week', target: 20 }

  it('close at 85%, reached at 100%', () => {
    expect(notes([weekly], [run('2026-09-28', 10, 90)])).toHaveLength(0)
    expect(notes([weekly], [run('2026-09-28', 17.5, 150)])[0]).toMatchObject({ type: 'goal-close' })
    expect(notes([weekly], [run('2026-09-28', 20, 180)])[0]).toMatchObject({ type: 'goal-reached' })
  })
  it('a weekly goal can be reached again next week (ids differ), a one-off event cannot repeat', () => {
    const logs = [run('2026-09-28', 20, 180), run('2026-10-05', 20, 180)]
    const a = notes([weekly], logs)[0].id
    const b = notes([weekly], logs, '2026-10-06')[0].id
    expect(a).not.toBe(b)
    const race: Goal = { id: 'r', type: 'race', sport: 'run', label: 'Half', distance: 13.1 }
    const big = [run('2026-09-20', 13.1, 130)]
    expect(notes([race], big)[0].id).toBe(notes([race], big, '2026-10-06')[0].id)
  })
})
