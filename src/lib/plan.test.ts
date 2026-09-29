import { describe, expect, it } from 'vitest'
import type { ExerciseLog, PlanOverrides, WeekPlan } from '../types'
import { dayPlanOf, isRestDay, lastWorkout } from './plan'
import { weekStats } from './stats'

const TODAY = '2026-09-29' // Tuesday
const run = (date: string, distance = 3): ExerciseLog => ({ date, exerciseId: 'running', cardio: { distance, minutes: 27 } })
const lift = (date: string): ExerciseLog => ({ date, exerciseId: 'Barbell_Deadlift', sets: [{ weight: 225, reps: 5 }] })
const emptyPlan = (): WeekPlan => Array.from({ length: 7 }, () => [])

describe('lastWorkout', () => {
  it('never shows a run planned or logged for tomorrow', () => {
    const logs = [lift('2026-09-26'), run('2026-09-30')] // Sat lift, tomorrow's run
    const last = lastWorkout(logs, {}, TODAY)
    expect(last?.date).toBe('2026-09-26')
    expect(last?.logs.map((l) => l.exerciseId)).toEqual(['Barbell_Deadlift'])
  })

  it('is null when the only data is in the future', () => {
    expect(lastWorkout([run('2026-09-30'), run('2026-10-05')], {}, TODAY)).toBeNull()
  })

  it('a workout logged today counts; a rest day today does not', () => {
    expect(lastWorkout([lift('2026-09-26'), run(TODAY)], {}, TODAY)?.date).toBe(TODAY)
    // Today is a rest day: no data today, so the most recent past workout is shown.
    const overrides: PlanOverrides = { [TODAY]: [] }
    expect(lastWorkout([lift('2026-09-26'), run('2026-09-30')], overrides, TODAY)?.date).toBe('2026-09-26')
  })

  it('skips days marked as rest, even if something is logged on them', () => {
    const overrides: PlanOverrides = { '2026-09-28': [] }
    const logs = [lift('2026-09-26'), run('2026-09-28')]
    expect(lastWorkout(logs, overrides, TODAY)?.date).toBe('2026-09-26')
  })

  it('ignores entries with no real data', () => {
    const blank: ExerciseLog = { date: '2026-09-28', exerciseId: 'running', cardio: { distance: null, minutes: null } }
    const blankSets: ExerciseLog = { date: '2026-09-28', exerciseId: 'Barbell_Deadlift', sets: [{ weight: null, reps: null }] }
    expect(lastWorkout([lift('2026-09-25'), blank, blankSets], {}, TODAY)?.date).toBe('2026-09-25')
  })

  it('groups every exercise from the most recent day', () => {
    const logs = [lift('2026-09-27'), run('2026-09-27'), lift('2026-09-20')]
    expect(lastWorkout(logs, {}, TODAY)?.logs).toHaveLength(2)
  })
})

describe('rest days', () => {
  it('an empty override is a rest day even when the weekly template has exercises; no override is not', () => {
    const plan = emptyPlan()
    plan[1] = [{ exerciseId: 'running', sets: 1 }] // Tuesday template
    expect(dayPlanOf(plan, {}, TODAY)).toHaveLength(1)
    expect(isRestDay({}, TODAY)).toBe(false)
    expect(dayPlanOf(plan, { [TODAY]: [] }, TODAY)).toEqual([])
    expect(isRestDay({ [TODAY]: [] }, TODAY)).toBe(true)
    expect(isRestDay({ [TODAY]: [{ exerciseId: 'running', sets: 1 }] }, TODAY)).toBe(false)
    expect(isRestDay(undefined, TODAY)).toBe(false)
  })
})

describe('this week stats ignore future dates', () => {
  it("tomorrow's data does not count as a workout or volume yet", () => {
    const stats = weekStats([lift('2026-09-28'), lift('2026-09-30'), lift('2026-10-02')], TODAY)
    expect(stats.workouts).toBe(1)
    expect(stats.volume).toBe(225 * 5)
  })
})
