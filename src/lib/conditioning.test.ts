import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { ExerciseLog, PlannedExercise, TimedLog, WeekPlan } from '../types'
import { cardioWeek, conditioningWeek, hyroxRunPace, lowerIsBetter, resultScore, resultsFor, timedMinutes, weekOf } from './conditioning'

const lookup = (id: string) => BUILTIN_BY_ID.get(id)
const plan: WeekPlan = Array.from({ length: 7 }, () => [])
const WEEK = weekOf('2026-10-01') // Mon 28 Sep – Sun 4 Oct
const amrap = (date: string, rounds: number, reps = 0, movements = ['Pushups', 'Bodyweight_Squat']): TimedLog => ({
  id: `a${date}`, date, block: 'wod', wod: { kind: 'amrap', minutes: 12 }, title: 'AMRAP 12 min', movements, rounds, reps,
})

describe('weeks', () => {
  it('runs Monday to Sunday, and the week before', () => {
    expect(WEEK).toEqual(['2026-09-28', '2026-10-04'])
    expect(weekOf('2026-10-04', 1)).toEqual(['2026-09-21', '2026-09-27'])
  })
})

describe('cardio minutes', () => {
  it('adds up by kind of cardio, with distance, inside the week only', () => {
    const logs: ExerciseLog[] = [
      { date: '2026-09-29', exerciseId: 'running', cardio: { distance: 3, minutes: 27 } },
      { date: '2026-10-01', exerciseId: 'running', cardio: { distance: 2, minutes: 18 } },
      { date: '2026-10-02', exerciseId: 'x-row-erg', cardio: { distance: null, minutes: 20 } },
      { date: '2026-09-27', exerciseId: 'running', cardio: { distance: 5, minutes: 45 } }, // last week
    ]
    const w = cardioWeek(logs, [], WEEK, lookup)
    expect(w.minutes).toBe(65)
    expect(w.distance).toBe(5)
    expect(w.byType).toEqual([{ label: 'Running', minutes: 45 }, { label: 'Rower', minutes: 20 }])
  })

  it('leaves out runs and rows that were part of a timed workout or Hyrox (they count as conditioning)', () => {
    const logs: ExerciseLog[] = [{ date: '2026-09-29', exerciseId: 'x-row-erg', cardio: { distance: null, minutes: 4 } }]
    expect(cardioWeek(logs, [amrap('2026-09-29', 5, 0, ['x-row-erg'])], WEEK, lookup).minutes).toBe(0)
  })
})

describe('conditioning minutes', () => {
  it('counts timed results by format, Hyrox by finish time, and logged circuits by their planned length', () => {
    const hyrox: TimedLog = { id: 'h', date: '2026-10-03', block: 'hyrox', wod: { kind: 'fortime', minutes: 90, rounds: 8 }, title: 'Hyrox-style · 8 × (1000 m run + station)', movements: ['running'], seconds: 75 * 60, hyrox: true }
    const forTime: TimedLog = { id: 'f', date: '2026-09-30', block: 'wod', wod: { kind: 'fortime', minutes: 20, rounds: 3 }, title: '', movements: [], seconds: 14 * 60 + 30 }
    const circuit: PlannedExercise[] = [
      { exerciseId: 'Pushups', sets: 3, block: 'circuit', est: 6 },
      { exerciseId: 'Bodyweight_Squat', sets: 3, block: 'circuit', est: 6 },
    ]
    const logs: ExerciseLog[] = [{ date: '2026-10-01', exerciseId: 'Pushups', sets: [{ weight: null, reps: 12 }] }]
    const w = conditioningWeek([amrap('2026-09-29', 6), hyrox, forTime], logs, plan, { '2026-10-01': circuit, '2026-10-02': circuit }, WEEK)
    expect(w.sessions).toBe(4) // the 2nd circuit day wasn't logged
    expect(Object.fromEntries(w.byKind.map((k) => [k.label, k.minutes]))).toEqual({ Hyrox: 75, AMRAP: 12, 'For time': 14.5, Circuits: 12 })
    expect(w.minutes).toBe(113.5)
  })

  it('a capped for-time result counts the cap; Tabata its full length', () => {
    expect(timedMinutes({ ...amrap('2026-09-29', 0), wod: { kind: 'fortime', minutes: 20, rounds: 5 }, capped: true, rounds: 4 })).toBe(20)
    expect(timedMinutes({ ...amrap('2026-09-29', 0), wod: { kind: 'tabata', minutes: 9, rounds: 8, work: 20, rest: 10, gap: 60, intervals: 16 }, intervals: 16 })).toBe(9)
  })
})

describe('benchmark results', () => {
  const items: PlannedExercise[] = [{ exerciseId: 'Pushups', sets: 1, reps: 10 }, { exerciseId: 'Bodyweight_Squat', sets: 1, reps: 15 }]

  it('finds the same workout in any order of movements, oldest first', () => {
    const logs = [amrap('2026-09-20', 6), amrap('2026-09-01', 5, 0, ['Bodyweight_Squat', 'Pushups']), amrap('2026-09-10', 9, 0, ['Burpee'])]
    expect(resultsFor(logs, { kind: 'amrap', movements: ['Pushups', 'Bodyweight_Squat'] }).map((t) => t.date)).toEqual(['2026-09-01', '2026-09-20'])
  })

  it('scores AMRAPs as rounds plus part of a round, for time as minutes (lower is better)', () => {
    expect(resultScore(amrap('2026-09-01', 6, 10), items)).toBeCloseTo(6.4)
    const ft: TimedLog = { ...amrap('2026-09-01', 0), wod: { kind: 'fortime', minutes: 20, rounds: 3 }, seconds: 600 }
    expect(resultScore(ft)).toBe(10)
    expect(lowerIsBetter(ft)).toBe(true)
    expect(resultScore({ ...ft, capped: true, seconds: undefined })).toBeNull()
  })

  it('matches Hyrox by its layout, and reads the run pace from that day', () => {
    const h = (date: string, title: string): TimedLog => ({ id: date, date, block: 'hyrox', wod: { kind: 'fortime', minutes: 90 }, title, movements: ['running'], seconds: 4000, hyrox: true })
    const all = [h('2026-09-01', 'A'), h('2026-09-15', 'B'), h('2026-09-29', 'A')]
    expect(resultsFor(all, { kind: 'fortime', movements: [], title: 'A', hyrox: true }).map((t) => t.date)).toEqual(['2026-09-01', '2026-09-29'])
    expect(resultsFor(all, { kind: 'fortime', movements: ['running'] })).toEqual([])
    const logs: ExerciseLog[] = [{ date: '2026-09-29', exerciseId: 'running', cardio: { distance: 5, minutes: 45 } }]
    expect(hyroxRunPace(all[2], logs, lookup)).toBe(9)
  })
})
