import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { AppNotification, Exercise, ExerciseLog, PlanOverrides, WeekPlan } from '../types'
import { challengeProgress } from './challengeProgress'
import { buildPayload, completedWorkout, datesFor, defaultTitle, describePayload, payloadFromDays, planFromPayload, sanitizePayload, startFor } from './share'
import { buildSnapshot } from './snapshot'
import type { ChallengeSpec, SharedPayload } from './types'

const lookup = (id: string) => BUILTIN_BY_ID.get(id)
const emptyPlan = (): WeekPlan => Array.from({ length: 7 }, () => [])
const TODAY = '2026-09-29' // Tuesday

describe('sharing a plan', () => {
  it('covers a day, a week (Mon–Sun) or four weeks', () => {
    expect(datesFor('day', TODAY)).toEqual([TODAY])
    const week = datesFor('week', TODAY)
    expect(week).toHaveLength(7); expect(week[0]).toBe('2026-09-28'); expect(week[6]).toBe('2026-10-04')
    const month = datesFor('month', TODAY)
    expect(month).toHaveLength(28); expect(month[0]).toBe('2026-09-28'); expect(month[27]).toBe('2026-10-25')
    expect(startFor('day', TODAY)).toBe(TODAY); expect(startFor('week', TODAY)).toBe('2026-09-28')
  })

  it('snapshots the plan (template + overrides), marks rest days, and carries only the custom exercises it uses', () => {
    const plan = emptyPlan(); plan[1] = [{ exerciseId: 'Pushups', sets: 3, reps: 12 }, { exerciseId: 'custom-x', sets: 2 }]
    const overrides: PlanOverrides = { '2026-09-30': [], '2026-10-01': [{ exerciseId: 'running', sets: 1, minutes: 30, distance: 3, note: 'Easy' }] }
    const custom: Exercise[] = [{ id: 'custom-x', name: 'Farmer walk', kind: 'strength', mode: 'time', group: 'Other', custom: true }, { id: 'custom-unused', name: 'Nope', kind: 'strength', group: 'Other', custom: true }]
    const p = buildPayload({ scope: 'week', dates: datesFor('week', TODAY), plan, overrides, custom })
    expect(p.days).toHaveLength(7)
    expect(p.days[1]).toMatchObject({ offset: 1, rest: false }); expect(p.days[1].items).toHaveLength(2) // Tuesday from the template
    expect(p.days[2]).toMatchObject({ rest: true, items: [] }) // explicit rest day
    expect(p.days[3].items[0]).toMatchObject({ exerciseId: 'running', distance: 3, note: 'Easy' })
    expect(p.custom.map((c) => c.id)).toEqual(['custom-x'])
    // it's a copy: editing the original later doesn't change what was shared
    plan[1][0].sets = 99
    expect(p.days[1].items[0].sets).toBe(3)
    expect(describePayload(p)).toBe('2 workouts · 3 exercises · 5 rest days')
    expect(defaultTitle(p, (id) => lookup(id)?.name)).toBe('2-workout week')
  })

  it('never includes logged results or anything private (only the plan travels)', () => {
    const plan = emptyPlan(); plan[1] = [{ exerciseId: 'Pushups', sets: 3, reps: 12 }]
    const json = JSON.stringify(buildPayload({ scope: 'day', dates: [TODAY], plan, overrides: {}, custom: [] }))
    expect(json).not.toMatch(/weight|bodyweight|logs|email/i)
  })
})

describe('receiving a plan is safe', () => {
  const good: SharedPayload = { version: 1, scope: 'week', custom: [], days: [{ offset: 0, rest: false, items: [{ exerciseId: 'Pushups', sets: 3, reps: 12 }] }, { offset: 1, rest: true, items: [] }] }

  it('accepts a good payload and returns a clean copy', () => {
    const clean = sanitizePayload(JSON.parse(JSON.stringify(good)))
    expect(clean).toEqual(good)
  })

  it('rejects anything that isn’t a plan', () => {
    for (const bad of [null, 'x', 5, [], {}, { version: 2 }, { version: 1, scope: 'year', days: [] }, { version: 1, scope: 'day', days: 'no' }, { version: 1, scope: 'day', days: [] }]) {
      expect(sanitizePayload(bad), JSON.stringify(bad)).toBeNull()
    }
    const tooMany = { ...good, days: Array.from({ length: 29 }, (_, i) => ({ offset: i % 28, rest: true, items: [] })) }
    expect(sanitizePayload(tooMany)).toBeNull()
    expect(sanitizePayload({ ...good, days: [{ offset: 0, items: [] }, { offset: 0, items: [] }] })).toBeNull() // duplicate day
    expect(sanitizePayload({ ...good, days: [{ offset: -1, items: [] }] })).toBeNull()
    expect(sanitizePayload({ ...good, days: [{ offset: 1.5, items: [] }] })).toBeNull()
    expect(sanitizePayload({ ...good, days: [{ offset: 0, items: Array.from({ length: 41 }, () => ({ exerciseId: 'a', sets: 1 })) }] })).toBeNull()
  })

  it('drops or clamps bad items and fields instead of trusting them', () => {
    const clean = sanitizePayload({
      version: 1, scope: 'day', custom: [],
      days: [{ offset: 0, items: [
        { exerciseId: 'Pushups', sets: 3, reps: 12, evil: '<script>alert(1)</script>', __proto__: { polluted: true } },
        { exerciseId: 'Plank', sets: 1e9 }, { exerciseId: '', sets: 3 }, { sets: 3 }, { exerciseId: 'Pullups', sets: NaN },
        { exerciseId: 'x'.repeat(101), sets: 3 }, 'not an object', null,
        { exerciseId: 'Barbell_Deadlift', sets: 3, reps: -5, seconds: 999999, minutes: 'ten', distance: Infinity, note: 'n'.repeat(700) },
        { exerciseId: 'Pushups', sets: 9 }, // duplicate exercise on the same day
      ] }],
    })!
    const items = clean.days[0].items
    expect(items.map((i) => i.exerciseId)).toEqual(['Pushups', 'Barbell_Deadlift'])
    expect(items[0]).toEqual({ exerciseId: 'Pushups', sets: 3, reps: 12 }) // unknown fields stripped
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(items[1]).toEqual({ exerciseId: 'Barbell_Deadlift', sets: 3 }) // bad numbers and the oversized note removed
  })

  it('cleans custom exercises and ignores malformed ones', () => {
    const clean = sanitizePayload({ ...good, custom: [{ id: 'c1', name: 'Sled drag', kind: 'strength', mode: 'time', group: 'Legs', bogus: 1 }, { id: 'c2', name: '', kind: 'strength' }, { id: 'c3', name: 'X', kind: 'flying' }, 7] })!
    expect(clean.custom).toEqual([{ id: 'c1', name: 'Sled drag', kind: 'strength', mode: 'time', group: 'Legs', custom: true }])
  })

  it('places days by offset from the start date and never lets a friend’s rest days override your plans', () => {
    const p: SharedPayload = { version: 1, scope: 'week', custom: [], days: [{ offset: 0, rest: false, items: [{ exerciseId: 'Pushups', sets: 3 }] }, { offset: 1, rest: true, items: [] }, { offset: 3, rest: false, items: [{ exerciseId: 'running', sets: 1, minutes: 20 }] }] }
    const { days } = planFromPayload(p, '2026-10-05', [])
    expect(Object.keys(days)).toEqual(['2026-10-05', '2026-10-08'])
  })

  it('brings custom exercises under fresh ids, reuses identical ones, and drops unknown library ids', () => {
    const shared: Exercise = { id: 'custom-abc', name: 'Sled drag', kind: 'strength', mode: 'time', group: 'Legs', custom: true }
    const p: SharedPayload = { version: 1, scope: 'day', custom: [shared], days: [{ offset: 0, rest: false, items: [{ exerciseId: 'custom-abc', sets: 3, seconds: 30 }, { exerciseId: 'not-a-real-id', sets: 3 }, { exerciseId: 'Plank', sets: 3 }] }] }
    const mine: Exercise = { id: 'custom-abc', name: 'Something else', kind: 'strength', group: 'Other', custom: true } // same id, different exercise
    const a = planFromPayload(p, TODAY, [mine])
    expect(a.newCustom).toHaveLength(1)
    expect(a.newCustom[0].id).not.toBe('custom-abc') // never overwrites the recipient's own
    expect(a.days[TODAY].map((i) => i.exerciseId)).toEqual([a.newCustom[0].id, 'Plank'])
    expect(a.skipped).toBe(1)
    const same: Exercise = { ...shared, id: 'custom-mine' }
    const b = planFromPayload(p, TODAY, [same]) // identical exercise already exists: reuse it
    expect(b.newCustom).toEqual([]); expect(b.days[TODAY][0].exerciseId).toBe('custom-mine')
  })
})

describe('completed workouts', () => {
  const logs: ExerciseLog[] = [
    { date: TODAY, exerciseId: 'Pushups', sets: [{ weight: null, reps: 20 }, { weight: null, reps: 18 }, { weight: null, reps: 15 }] },
    { date: TODAY, exerciseId: 'Barbell_Deadlift', sets: [{ weight: 225, reps: 5 }, { weight: 245, reps: 3 }] },
    { date: TODAY, exerciseId: 'Plank', sets: [{ weight: null, reps: null, seconds: 60 }] },
    { date: TODAY, exerciseId: 'running', cardio: { distance: 3.1, minutes: 27 } },
    { date: TODAY, exerciseId: 'Pullups', sets: [{ weight: null, reps: null }] }, // nothing logged
    { date: '2026-09-28', exerciseId: 'Leg_Press', sets: [{ weight: 300, reps: 10 }] },
  ]
  it('turn into a repeatable workout plus a summary of what was achieved', () => {
    const p = completedWorkout(TODAY, logs, lookup, [])!
    expect(p.scope).toBe('day')
    expect(p.days[0].items).toEqual([
      { exerciseId: 'Pushups', sets: 3, reps: 20 },
      { exerciseId: 'Barbell_Deadlift', sets: 2, reps: 5 },
      { exerciseId: 'Plank', sets: 1, seconds: 60 },
      { exerciseId: 'running', sets: 1, minutes: 27, distance: 3.1 },
    ])
    expect(p.results).toEqual(['Push-Up 3 × 20', 'Deadlift 2 sets, top 245 lb × 3', 'Plank 1 × 60s', 'Running 3.1 mi in 27 min'])
    expect(completedWorkout('2026-01-01', logs, lookup, [])).toBeNull()
  })
})

describe('challenge progress', () => {
  const accepted = '2026-09-28T09:00:00'
  const c = (spec: ChallengeSpec, target: number, endsAt = '2026-10-05T09:00:00') => ({ spec, target, acceptedAt: accepted, endsAt })
  const pushups: ChallengeSpec = { metric: 'reps', mode: 'total', exercise: { id: 'Pushups', name: 'Pushups', kind: 'strength', mode: 'reps' } }
  const sets = (...reps: number[]) => reps.map((r) => ({ weight: null, reps: r }))
  const log = (date: string, exerciseId: string, s: ReturnType<typeof sets>): ExerciseLog => ({ date, exerciseId, sets: s })

  it('totals reps over the window and finishes at the target', () => {
    const logs = [log('2026-09-28', 'Pushups', sets(30, 25)), log('2026-09-29', 'Pushups', sets(20)), log('2026-09-27', 'Pushups', sets(500)) /* before accepting */]
    expect(challengeProgress(c(pushups, 100), logs, TODAY, lookup)).toEqual({ progress: 75, done: false })
    expect(challengeProgress(c(pushups, 75), logs, TODAY, lookup)).toEqual({ progress: 75, done: true })
  })
  it('best mode takes the single best set; other exercises and days outside the window do not count', () => {
    const logs = [log('2026-09-28', 'Pushups', sets(12, 31, 20)), log('2026-09-29', 'Pullups', sets(99)), log('2026-10-06', 'Pushups', sets(80))]
    expect(challengeProgress(c({ ...pushups, mode: 'best' }, 40, '2026-10-05T09:00:00'), logs, '2026-10-07', lookup).progress).toBe(31) // day 10/06 is after the window
  })
  it('does nothing until it is accepted, and never counts the future', () => {
    expect(challengeProgress({ spec: pushups, target: 10 }, [log('2026-09-29', 'Pushups', sets(50))], TODAY, lookup)).toEqual({ progress: 0, done: false })
    expect(challengeProgress(c(pushups, 10), [log('2026-09-30', 'Pushups', sets(50))], TODAY, lookup).progress).toBe(0)
  })
  it('handles timed holds and heaviest weight', () => {
    const plank: ChallengeSpec = { metric: 'seconds', mode: 'best', exercise: { id: 'Plank', name: 'Plank', kind: 'strength', mode: 'time' } }
    expect(challengeProgress(c(plank, 120), [{ date: '2026-09-29', exerciseId: 'Plank', sets: [{ weight: null, reps: null, seconds: 90 }, { weight: null, reps: null, seconds: 130 }] }], TODAY, lookup)).toEqual({ progress: 130, done: true })
    const dead: ChallengeSpec = { metric: 'weight', mode: 'best', exercise: { id: 'Barbell_Deadlift', name: 'Deadlift', kind: 'strength', mode: 'weight' } }
    expect(challengeProgress(c(dead, 300), [{ date: '2026-09-29', exerciseId: 'Barbell_Deadlift', sets: [{ weight: 275, reps: 3 }, { weight: 255, reps: 5 }] }], TODAY, lookup).progress).toBe(275)
  })
  it('counts cardio distance by sport, total or longest single', () => {
    const run = (date: string, d: number): ExerciseLog => ({ date, exerciseId: 'running', cardio: { distance: d, minutes: d * 9 } })
    const ride: ExerciseLog = { date: '2026-09-29', exerciseId: 'cycling', cardio: { distance: 30, minutes: 120 } }
    const logs = [run('2026-09-28', 3), run('2026-09-29', 4.5), ride]
    expect(challengeProgress(c({ metric: 'distance', mode: 'total', sport: 'run' }, 10), logs, TODAY, lookup)).toEqual({ progress: 7.5, done: false })
    expect(challengeProgress(c({ metric: 'distance', mode: 'best', sport: 'run' }, 4), logs, TODAY, lookup)).toEqual({ progress: 4.5, done: true })
    expect(challengeProgress(c({ metric: 'distance', mode: 'total', sport: 'any' }, 40), logs, TODAY, lookup).progress).toBe(37.5)
    expect(challengeProgress(c({ metric: 'minutes', mode: 'total', sport: 'bike' }, 100), logs, TODAY, lookup)).toEqual({ progress: 120, done: true })
  })
  it('a shared workout is done when every exercise has been logged since accepting', () => {
    const workout: SharedPayload = { version: 1, scope: 'day', custom: [], days: [{ offset: 0, rest: false, items: [{ exerciseId: 'Pushups', sets: 3 }, { exerciseId: 'Plank', sets: 3 }, { exerciseId: 'running', sets: 1 }] }] }
    const spec: ChallengeSpec = { metric: 'exercises', mode: 'workout', workout }
    const logs = [log('2026-09-29', 'Pushups', sets(10)), { date: '2026-09-29', exerciseId: 'Plank', sets: [{ weight: null, reps: null, seconds: 30 }] }, log('2026-09-20', 'Pushups', sets(10))]
    expect(challengeProgress(c(spec, 3), logs, TODAY, lookup)).toEqual({ progress: 2, done: false })
    expect(challengeProgress(c(spec, 3), [...logs, { date: TODAY, exerciseId: 'running', cardio: { distance: 1, minutes: 9 } }], TODAY, lookup)).toEqual({ progress: 3, done: true })
  })
})

describe('progress snapshot', () => {
  const logs: ExerciseLog[] = [
    { date: TODAY, exerciseId: 'Pushups', sets: [{ weight: null, reps: 20 }] },
    { date: '2026-09-27', exerciseId: 'running', cardio: { distance: 3, minutes: 27 } },
    { date: '2026-09-27', exerciseId: 'Plank', sets: [{ weight: null, reps: null, seconds: 60 }] },
    { date: '2026-09-10', exerciseId: 'Pullups', sets: [{ weight: null, reps: 10 }] }, // too old for "recent"
  ]
  const now = new Date('2026-09-29T12:00:00').getTime()
  const pr = (body: string, daysAgo: number): AppNotification => ({ id: body, type: 'pr', title: 'New personal best', body, ts: now - daysAgo * 86400000, read: true })
  it('summarises this week and the last seven days, with recent personal bests only', () => {
    const s = buildSnapshot({ logs, today: TODAY, lookup, now, notifications: [pr('Bench: 145 lb (was 135)', 2), pr('Old one', 30), { ...pr('goal', 1), type: 'goal-reached' }] })
    expect(s.weekWorkouts).toBe(1) // Mon–Tue: only today has data (Sunday was last week)
    expect(s.recent.map((r) => r.date)).toEqual([TODAY, '2026-09-27'])
    expect(s.recent[1].exercises.sort()).toEqual(['Plank', 'Running'])
    expect(s.bests).toEqual(['Bench: 145 lb (was 135)'])
  })
  it('contains nothing private: no body weight, goals, or exact sets', () => {
    const json = JSON.stringify(buildSnapshot({ logs, today: TODAY, lookup, now, notifications: [] }))
    expect(json).not.toMatch(/weight|goal|reps|lb|email/i)
  })
})

describe('payloadFromDays', () => {
  it('builds a shareable plan from made-on-the-spot days and carries only the custom exercises used', () => {
    const custom = [
      { id: 'custom-a', name: 'Sled push', kind: 'strength' as const, group: 'Other', equipment: 'Custom', custom: true },
      { id: 'custom-b', name: 'Unused', kind: 'strength' as const, group: 'Other', equipment: 'Custom', custom: true },
    ]
    const p = payloadFromDays([{ offset: 0, items: [{ exerciseId: 'custom-a', sets: 3 }] }, { offset: 2, items: [] }], 'week', custom)
    expect(p.scope).toBe('week')
    expect(p.days).toEqual([{ offset: 0, rest: false, items: [{ exerciseId: 'custom-a', sets: 3 }] }, { offset: 2, rest: true, items: [] }])
    expect(p.custom.map((c) => c.id)).toEqual(['custom-a'])
    expect(sanitizePayload(p)).not.toBeNull()
  })
})
