import { describe, expect, it } from 'vitest'
import type { ExerciseLog, PlanOverrides, WeekPlan } from '../types'
import { dayLabel, workoutTitle, dayPlanOf, isRestDay, lastWorkout, repeatPlan } from './plan'
import { BUILTIN_BY_ID } from '../data/exercises'
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

describe('last week so far', () => {
  it('compares with last week up to the same weekday', () => {
    // TODAY is Tuesday 2026-09-29: last week's Monday counts toward "so far", its Friday doesn't.
    const lastMon = '2026-09-21'
    const lastFri = '2026-09-25'
    const stats = weekStats([lift(lastMon), lift(lastFri)], TODAY)
    expect(stats.lastWorkouts).toBe(2)
    expect(stats.lastWorkoutsSoFar).toBe(1)
    expect(stats.lastVolumeSoFar).toBe(225 * 5)
  })
})

describe('repeatPlan', () => {
  it('rebuilds a workout: working sets, usual reps, warm-ups, holds and cardio', () => {
    const logs: ExerciseLog[] = [
      { date: TODAY, exerciseId: 'Barbell_Squat', sets: [{ weight: 95, reps: 5, warmup: true }, { weight: 185, reps: 8 }, { weight: 185, reps: 8 }, { weight: 185, reps: 6 }] },
      { date: TODAY, exerciseId: 'Plank', sets: [{ weight: null, reps: null, seconds: 45 }, { weight: null, reps: null, seconds: 45 }] },
      { date: TODAY, exerciseId: 'running', cardio: { distance: 3, minutes: 27 } },
      { date: TODAY, exerciseId: 'gone-custom', sets: [{ weight: 10, reps: 10 }] },
    ]
    expect(repeatPlan(logs, (id) => BUILTIN_BY_ID.get(id))).toEqual([
      { exerciseId: 'Barbell_Squat', sets: 3, reps: 8, warmupSets: 1 },
      { exerciseId: 'Plank', sets: 2, seconds: 45 },
      { exerciseId: 'running', sets: 1, minutes: 27, distance: 3 },
    ])
  })
})

describe('dayLabel', () => {
  const look = (id: string) => BUILTIN_BY_ID.get(id)
  it('names a day by what it trains', () => {
    expect(dayLabel([], look)).toBe('')
    expect(dayLabel([{ exerciseId: 'running', sets: 1 }], look)).toBe('Run')
    expect(dayLabel([{ exerciseId: 'cycling', sets: 1 }], look)).toBe('Ride')
    expect(dayLabel([{ exerciseId: 'Barbell_Squat', sets: 3 }, { exerciseId: 'Leg_Press', sets: 3 }, { exerciseId: 'Plank', sets: 3 }], look)).toBe('Legs')
    expect(dayLabel([{ exerciseId: 'Barbell_Squat', sets: 3 }, { exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', sets: 3 }, { exerciseId: 'Pullups', sets: 3 }], look)).toBe('Full')
    expect(dayLabel([{ exerciseId: 'x-burpee', sets: 1, wod: { kind: 'amrap', minutes: 10 } }], look)).toBe('Timed')
    // Body parts roll up to an area: biceps and triceps make an arm day, quads and hamstrings a leg day.
    expect(dayLabel([{ exerciseId: 'Dumbbell_Bicep_Curl', sets: 3 }, { exerciseId: 'Triceps_Pushdown', sets: 3 }], look)).toBe('Arms')
    expect(dayLabel([{ exerciseId: 'Barbell_Squat', sets: 3 }, { exerciseId: 'Lying_Leg_Curls', sets: 3 }], look)).toBe('Legs')
    expect(dayLabel([{ exerciseId: 'running', sets: 1, block: 'hyrox' }, { exerciseId: 'x-sled-push', sets: 1, block: 'hyrox' }], look)).toBe('Hyrox')
  })
})

describe('workoutTitle', () => {
  const t = (...ids: string[]) => workoutTitle(ids.map((id) => BUILTIN_BY_ID.get(id)!))
  it('sums a workout up in a few words', () => {
    expect(t('Barbell_Squat', 'Barbell_Bench_Press_-_Medium_Grip', 'Bent_Over_Barbell_Row', 'Dumbbell_Bicep_Curl')).toBe('Full body')
    expect(t('Barbell_Bench_Press_-_Medium_Grip', 'Bent_Over_Barbell_Row', 'Standing_Military_Press')).toBe('Upper body')
    expect(t('Dumbbell_Bicep_Curl', 'Barbell_Squat')).toBe('Arms & legs')
    expect(t('Barbell_Bench_Press_-_Medium_Grip', 'Dumbbell_Bicep_Curl', 'Triceps_Pushdown')).toBe('Chest & arms')
    expect(t('Barbell_Squat', 'Lying_Leg_Curls', 'running')).toBe('Legs + cardio')
    expect(t('running')).toBe('Run')
    expect(t('Elliptical_Trainer')).toBe('Cardio')
  })
})
