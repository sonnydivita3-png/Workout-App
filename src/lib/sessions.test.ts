import { describe, expect, it } from 'vitest'
import type { PlannedExercise } from '../types'
import { anyFinished, finishIn, isFinished, isSplit, joinSessions, sessionsOf, splitItems, suggestSessions, unfinishIn, withSessions } from './sessions'

// A day as the app plans one: a warm-up, a superset, a lift, a run on its own, and a Hyrox block.
const warm: PlannedExercise[] = [
  { exerciseId: 'walking', sets: 1, minutes: 5, warmup: true, block: 'warmup', blockLabel: 'Warm-up' },
  { exerciseId: 'Arm_Circles', sets: 1, seconds: 30, warmup: true, block: 'warmup', blockLabel: 'Warm-up' },
]
const lifts: PlannedExercise[] = [
  { exerciseId: 'Barbell_Squat', sets: 3, reps: 5 },
  { exerciseId: 'Pushups', sets: 3, reps: 12, block: 'ss1', blockLabel: 'Superset' },
  { exerciseId: 'Inverted_Row', sets: 3, reps: 10, block: 'ss1', blockLabel: 'Superset' },
]
const run: PlannedExercise = { exerciseId: 'running', sets: 1, minutes: 40, distance: 4 }
const day = () => [...warm, ...lifts, run]

describe('a day split into a morning and an evening session', () => {
  it('a day with nothing marked is one session', () => {
    expect(isSplit(day())).toBe(false)
    expect(sessionsOf(day())).toBeNull()
    expect(splitItems(day())).toBeNull()
  })

  it('suggests the cardio in the morning and the lifting (with its warm-up) in the evening', () => {
    expect(suggestSessions(day())).toEqual(['pm', 'pm', 'pm', 'pm', 'pm', 'am'])
    // The warm-up goes with what it comes before: before the run, it goes with the run.
    expect(suggestSessions([...warm, run, ...lifts])).toEqual(['am', 'am', 'am', 'pm', 'pm', 'pm'])
    // Nothing to tell apart: all in the evening, for them to pick what moves.
    expect(suggestSessions(lifts)).toEqual(['pm', 'pm', 'pm'])
  })

  it('moves each part as asked, keeping a superset or warm-up together', () => {
    const next = withSessions(day(), ['pm', 'pm', 'pm', 'am', 'pm', 'am'])
    // The superset goes by its first exercise.
    expect(next.map((p) => p.session)).toEqual(['pm', 'pm', 'pm', 'am', 'am', 'am'])
    expect(splitItems(next)!.am.map((p) => p.exerciseId)).toEqual(['Pushups', 'Inverted_Row', 'running'])
    expect(splitItems(next)!.pm.map((p) => p.exerciseId)).toEqual(['walking', 'Arm_Circles', 'Barbell_Squat'])
  })

  it('is one session again when everything but a warm-up ends up together', () => {
    const one = withSessions(day(), ['am', 'am', 'pm', 'pm', 'pm', 'pm'])
    expect(isSplit(one)).toBe(false)
    expect(one.some((p) => 'session' in p)).toBe(false)
    expect(joinSessions(withSessions(day(), suggestSessions(day()))).some((p) => 'session' in p)).toBe(false)
  })

  it('puts something added since the split with what it is like', () => {
    const split = withSessions(day(), suggestSessions(day()))
    const added = [...split, { exerciseId: 'Plank', sets: 3, seconds: 45 }, { exerciseId: 'Bicycling_Stationary', sets: 1, minutes: 15 }]
    const of = sessionsOf(added)!
    expect(of.at(-2)).toBe('pm') // a lift joins the lifting
    expect(of.at(-1)).toBe('am') // cardio joins the cardio
    // A new block keeps together, going by what's in it.
    const block = [...split, { exerciseId: 'x-burpee', sets: 4, block: 'circuit-1', blockLabel: 'Circuit' }, { exerciseId: 'x-jumping-jacks', sets: 4, block: 'circuit-1', blockLabel: 'Circuit' }]
    expect(sessionsOf(block)!.slice(-2)).toEqual(['pm', 'pm'])
  })

  it('a warm-up added since goes with what follows it', () => {
    const split = withSessions([...lifts, run], ['pm', 'pm', 'pm', 'am'])
    const of = sessionsOf([...warm, ...split])!
    expect(of.slice(0, 2)).toEqual(['pm', 'pm'])
    const before = sessionsOf([...split.slice(0, 3), ...warm, split[3]])!
    expect(before.slice(3, 5)).toEqual(['am', 'am'])
  })

  it('ignores anything that is not morning or evening', () => {
    const odd = day().map((p, i) => (i === 3 ? { ...p, session: 'noon' as unknown as 'am' } : p))
    expect(isSplit(odd)).toBe(false)
  })
})

describe('finishing a split day one session at a time', () => {
  const date = '2026-11-03'
  it('finishes a session, then the day once both are', () => {
    const am = finishIn([], date, 'am')
    expect(isFinished(am, date, 'am')).toBe(true)
    expect(isFinished(am, date, 'pm')).toBe(false)
    expect(isFinished(am, date)).toBe(false)
    expect(anyFinished(am, date)).toBe(true)
    const both = finishIn(am, date, 'pm')
    expect(isFinished(both, date)).toBe(true)
    expect(finishIn(both, date, 'pm')).toEqual(both)
  })
  it('finishing the whole day covers both sessions, and undoing a session undoes the day', () => {
    const day = finishIn([], date)
    expect(isFinished(day, date, 'am') && isFinished(day, date, 'pm')).toBe(true)
    const both = finishIn(finishIn([], date, 'am'), date, 'pm')
    const undone = unfinishIn(both, date, 'pm')
    expect(isFinished(undone, date)).toBe(false)
    expect(isFinished(undone, date, 'am')).toBe(true)
    expect(unfinishIn(both, date)).toEqual([])
    // Other days stay as they are.
    expect(unfinishIn(['2026-11-02', ...both], date)).toEqual(['2026-11-02'])
  })
})
