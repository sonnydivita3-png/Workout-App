import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { ExerciseLog, Goal, NotifPrefs, WeekPlan } from '../types'
import { computeNotifications, msUntilReminder, timeToMinutes } from './notify'

const BP = 'Barbell_Bench_Press_-_Medium_Grip'
const today = '2026-09-29' // a Tuesday
const prefs: NotifPrefs = { system: false, goals: true, pbs: true, daily: true, reminderTime: '17:00' }
const units = { weight: 'lb' as const, distance: 'mi' as const }
const emptyPlan = (): WeekPlan => Array.from({ length: 7 }, () => [])
const sets = (w: number) => [{ weight: w, reps: 5 }]

const run = (over: Partial<Parameters<typeof computeNotifications>[0]> = {}) =>
  computeNotifications({
    logs: [], goals: [], bodyweight: [], plan: emptyPlan(), units, prefs, today, nowMinutes: 12 * 60,
    exerciseName: (id) => BUILTIN_BY_ID.get(id), ...over,
  })

describe('personal bests', () => {
  const logs = (todayWeight: number): ExerciseLog[] => [
    { date: '2026-09-15', exerciseId: BP, sets: sets(130) },
    { date: '2026-09-22', exerciseId: BP, sets: sets(135) },
    { date: today, exerciseId: BP, sets: sets(todayWeight) },
  ]
  it('announces a new top weight today', () => {
    const n = run({ logs: logs(140) })
    expect(n).toHaveLength(1)
    expect(n[0]).toMatchObject({ type: 'pr', id: `pr:${BP}:${today}:weight` })
    expect(n[0].body).toContain('140')
  })
  it('ignores ties, lower weights, and a first-ever session', () => {
    expect(run({ logs: logs(135) })).toHaveLength(0)
    expect(run({ logs: logs(120) })).toHaveLength(0)
    expect(run({ logs: [{ date: today, exerciseId: BP, sets: sets(200) }] })).toHaveLength(0)
  })
  it('does not re-announce old PRs from previous days', () => {
    const old = [...logs(100), { date: '2026-09-20', exerciseId: BP, sets: sets(150) }]
    expect(run({ logs: old.filter((l) => l.date !== today) })).toHaveLength(0)
  })
  it('waits for the workout to be finished, then tells it', () => {
    expect(run({ logs: logs(140), finished: [] })).toHaveLength(0)
    expect(run({ logs: logs(140), finished: ['2026-09-22'] })).toHaveLength(0)
    expect(run({ logs: logs(140), finished: [today] })).toHaveLength(1)
  })
  it('respects the toggle', () => {
    expect(run({ logs: logs(140), prefs: { ...prefs, pbs: false } })).toHaveLength(0)
  })
  it('flags real cardio records only: the longest run, a fastest 5K; never a quick short run', () => {
    const longer: ExerciseLog[] = [
      { date: '2026-09-15', exerciseId: 'running', cardio: { distance: 3, minutes: 30 } },
      { date: today, exerciseId: 'running', cardio: { distance: 3.5, minutes: 30 } },
    ]
    expect(run({ logs: longer }).map((n) => n.id)).toEqual([`pr:running:${today}:distance`])
    const faster: ExerciseLog[] = [
      { date: '2026-09-15', exerciseId: 'running', cardio: { distance: 3.1, minutes: 27 } },
      { date: today, exerciseId: 'running', cardio: { distance: 3.1, minutes: 25 } },
    ]
    expect(run({ logs: faster }).map((n) => n.body)).toEqual(['Running: fastest 5K yet, 25:03 (was 27:04)'])
    // A fast 1.5 mi after slower 5Ks: a faster pace, but no record.
    const short: ExerciseLog[] = [
      { date: '2026-09-15', exerciseId: 'running', cardio: { distance: 3.1, minutes: 27 } },
      { date: today, exerciseId: 'running', cardio: { distance: 1.5, minutes: 10.5 } },
    ]
    expect(run({ logs: short })).toEqual([])
  })
})

describe('reps-only and timed exercises', () => {
  const PLANK = 'Plank'
  const PUSHUPS = 'Pushups'
  const timed = (secs: number, date: string): ExerciseLog => ({ date, exerciseId: PLANK, sets: [{ weight: null, reps: null, seconds: secs }] })
  const reps = (n: number, date: string): ExerciseLog => ({ date, exerciseId: PUSHUPS, sets: [{ weight: null, reps: n }] })

  it('announces a longer plank hold', () => {
    const n = run({ logs: [timed(45, '2026-09-20'), timed(60, today)] })
    expect(n).toHaveLength(1)
    expect(n[0].body).toContain('60s hold')
    expect(n[0].body).toContain('45s')
  })
  it('announces more push-ups in a set, but not fewer', () => {
    expect(run({ logs: [reps(20, '2026-09-20'), reps(25, today)] })[0].body).toContain('25 reps')
    expect(run({ logs: [reps(20, '2026-09-20'), reps(15, today)] })).toHaveLength(0)
  })
  it('goals use reps / seconds, not weight', () => {
    const repGoal: Goal = { id: 'r', type: 'lift', exerciseId: PUSHUPS, mode: 'reps', target: 30 }
    const holdGoal: Goal = { id: 'h', type: 'lift', exerciseId: PLANK, mode: 'time', target: 120 }
    const n = run({ goals: [repGoal, holdGoal], logs: [reps(27, '2026-09-20'), timed(120, '2026-09-21')] })
    const byId = Object.fromEntries(n.map((x) => [x.id, x]))
    expect(byId['goal-close:r'].body).toContain('30 reps')
    expect(byId['goal-close:r'].body).not.toContain('lb')
    expect(byId['goal-done:h'].body).toContain('2:00 hold')
  })
})

describe('goals', () => {
  const lift: Goal = { id: 'g1', type: 'lift', exerciseId: BP, target: 200 }
  it('says close at 85%+ and reached at 100%', () => {
    const at = (w: number) => run({ goals: [lift], logs: [{ date: '2026-09-20', exerciseId: BP, sets: sets(w) }] })
    expect(at(150)).toHaveLength(0)
    expect(at(175)[0]).toMatchObject({ type: 'goal-close', id: 'goal-close:g1' })
    expect(at(200)[0]).toMatchObject({ type: 'goal-reached', id: 'goal-done:g1' })
  })
  it('workouts-per-week goal is close when one workout short, scoped to the week', () => {
    const g: Goal = { id: 'w', type: 'workouts', perWeek: 3 }
    const days = ['2026-09-28', today]
    const logs = days.map((d) => ({ date: d, exerciseId: BP, sets: sets(100) }))
    const n = run({ goals: [g], logs })
    expect(n[0]).toMatchObject({ type: 'goal-close' })
    expect(n[0].id).toContain('2026-09-28') // Monday of this week
  })
  it('body weight goal works in either direction', () => {
    const g: Goal = { id: 'b', type: 'bodyweight', target: 175, start: 190 }
    const bw = (lb: number) => [{ date: today, lb }]
    expect(run({ goals: [g], bodyweight: bw(180) })).toHaveLength(0)
    expect(run({ goals: [g], bodyweight: bw(176.5) })[0].type).toBe('goal-close')
    expect(run({ goals: [g], bodyweight: bw(174) })[0].type).toBe('goal-reached')
  })
})

describe('daily reminder', () => {
  const plan = () => { const p = emptyPlan(); p[1] = [{ exerciseId: BP, sets: 3 }, { exerciseId: 'running', sets: 1 }]; return p }
  it('waits for the reminder time', () => {
    expect(run({ plan: plan(), nowMinutes: 16 * 60 })).toHaveLength(0)
    expect(run({ plan: plan(), nowMinutes: 17 * 60 })[0]).toMatchObject({ type: 'planned', id: `planned:${today}` })
  })
  it('stays quiet once everything is done, and counts what is left', () => {
    const done: ExerciseLog[] = [{ date: today, exerciseId: BP, sets: sets(100) }]
    expect(run({ plan: plan(), logs: done, nowMinutes: 18 * 60 })[0].title).toContain('1 exercise left')
    done.push({ date: today, exerciseId: 'running', cardio: { distance: 2, minutes: 20 } })
    expect(run({ plan: plan(), logs: done, nowMinutes: 18 * 60 }).filter((n) => n.type === 'planned')).toHaveLength(0)
  })
  it('does nothing on a rest day or when disabled', () => {
    expect(run({ nowMinutes: 20 * 60 })).toHaveLength(0)
    expect(run({ plan: plan(), nowMinutes: 20 * 60, prefs: { ...prefs, daily: false } })).toHaveLength(0)
  })
})

describe('helpers', () => {
  it('parses times and schedules the reminder', () => {
    expect(timeToMinutes('07:30')).toBe(450)
    const now = new Date(2026, 8, 29, 16, 0, 0)
    expect(msUntilReminder(prefs, now)).toBe(60 * 60 * 1000)
    expect(msUntilReminder(prefs, new Date(2026, 8, 29, 18, 0, 0))).toBeNull()
    expect(msUntilReminder({ ...prefs, daily: false }, now)).toBeNull()
  })
})
