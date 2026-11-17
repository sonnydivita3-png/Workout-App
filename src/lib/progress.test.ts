import { describe, expect, it } from 'vitest'
import raw from '../plans/ice-age-50k.json'
import { makeBackup, readBackup } from './backup'
import { checkPlan, dayOf, type Plan } from './plan'
import type { DayLog } from './store'
import { dayState, formatDuration, pace, parseDuration, weekAverage, weekMiles } from './progress'

const plan = (checkPlan(raw) as { plan: Plan }).plan
const tue = dayOf(plan, '2026-11-17')!

describe('how a day went', () => {
  it('is done, partly done, skipped, missed or still to do', () => {
    expect(dayState(tue, { items: { 0: { status: 'done' }, 1: { status: 'done' } } }, '2026-11-17')).toBe('done')
    expect(dayState(tue, { items: { 0: { status: 'done' } } }, '2026-11-17')).toBe('partial')
    expect(dayState(tue, { items: { 0: { status: 'skipped' }, 1: { status: 'skipped' } } }, '2026-11-20')).toBe('skipped')
    expect(dayState(tue, undefined, '2026-11-18')).toBe('missed')
    expect(dayState(tue, undefined, '2026-11-17')).toBe('open')
    expect(dayState(dayOf(plan, '2026-11-16'), undefined, '2026-11-20')).toBe('rest')
  })
})

describe('a week’s miles', () => {
  it('counts logged miles, or the plan’s for a run marked done without them', () => {
    const logs: Record<string, DayLog> = {
      [`${plan.id}|2026-11-17`]: { items: { 1: { status: 'done' } } }, // easy 3, no numbers
      [`${plan.id}|2026-11-19`]: { items: { 0: { status: 'done', miles: 4.3 } } },
      [`${plan.id}|2026-11-21`]: { items: { 0: { status: 'skipped' } } },
    }
    expect(weekMiles(plan, plan.weeks[0], logs)).toEqual({ planned: 12, done: 7.3 })
  })
})

describe('weigh-ins', () => {
  it('averages the week’s weigh-ins', () => {
    expect(weekAverage({ '2026-11-16': 219, '2026-11-18': 218.5, '2026-11-23': 210 }, '2026-11-16')).toBe(218.8)
    expect(weekAverage({}, '2026-11-16')).toBeNull()
  })
})

describe('times', () => {
  it('reads minutes or h:mm', () => {
    expect(parseDuration('45')).toBe(45)
    expect(parseDuration('1:12')).toBe(72)
    expect(parseDuration('1:12:30')).toBe(72.5)
    expect(parseDuration('1:7')).toBeNull()
    expect(parseDuration('')).toBeNull()
  })
  it('writes them back and works out the pace', () => {
    expect(formatDuration(72)).toBe('1:12')
    expect(formatDuration(45)).toBe('45 min')
    expect(pace(5, 60)).toBe('12:00 /mi')
    expect(pace(3, 35)).toBe('11:40 /mi')
    expect(pace(undefined, 30)).toBeNull()
  })
})

describe('backups', () => {
  it('round-trips the plan, log and weigh-ins', () => {
    const logs = { [`${plan.id}|2026-11-17`]: { items: { 0: { status: 'done' as const, ex: { 0: { done: true, sets: [{ lb: 135, reps: 5 }] } } } }, spine: true, note: 'Felt good' } }
    const r = readBackup(JSON.parse(JSON.stringify(makeBackup(plan, logs, { '2026-11-17': 219.4 }))))
    expect('backup' in r && r.backup).toMatchObject({ plan: { id: plan.id }, logs, weights: { '2026-11-17': 219.4 } })
  })
  it('drops anything strange', () => {
    const r = readBackup({ format: 'durata-backup', plan: null, weights: { '2026-11-17': -5, bad: 200, '2026-11-18': 'x' },
      logs: { __proto__x: {}, 'p|nope': {}, 'p|2026-11-17': { items: { 0: { status: 'maybe', miles: 1e9, ex: { 0: { sets: [{ lb: 'heavy', reps: 5 }] } } } }, note: 7 } } })
    expect('backup' in r && r.backup.weights).toEqual({})
    expect('backup' in r && r.backup.logs).toEqual({ 'p|2026-11-17': { items: { 0: { status: undefined, miles: undefined, minutes: undefined, ex: { 0: { done: undefined, sets: [{ lb: undefined, reps: 5 }] } } } }, spine: undefined, note: undefined } })
    expect(readBackup({ format: 'other' })).toEqual({ error: expect.any(String) })
    expect(readBackup({ format: 'durata-backup', plan: { format: 'durata-plan' } })).toEqual({ error: expect.stringContaining('problems') })
  })
})
