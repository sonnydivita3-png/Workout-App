import { describe, expect, it } from 'vitest'
import type { ExerciseLog } from '../types'
import { bestLift, epley, hasData, isPR, strengthSessions, weekStats } from './stats'

const lift = (date: string, sets: ExerciseLog['sets'], exerciseId = 'bench'): ExerciseLog => ({ date, exerciseId, sets })

describe('estimated one-rep max', () => {
  it('Epley: a single is the weight itself, 135 × 10 is 180', () => {
    expect(epley(135, 1)).toBe(135)
    expect(epley(135, 10)).toBe(180)
  })
  it('counts 12 reps at most, so a high-rep set never inflates the max (warm-ups never count)', () => {
    const [s] = strengthSessions([lift('2026-10-01', [{ weight: 100, reps: 25 }, { weight: 60, reps: 10, warmup: true }])], 'bench')
    expect(s.e1rm).toBeCloseTo(epley(100, 12)) // 140, not 183
    expect(s.topWeight).toBe(100)
    expect(s.volume).toBe(2500)
  })
})

describe('PRs and what counts as logged', () => {
  it('a PR beats every earlier session; a tie or a first session is not one', () => {
    expect(isPR([100, 120, 125])).toBe(true)
    expect(isPR([100, 125, 125])).toBe(false)
    expect(isPR([100])).toBe(false)
    expect(isPR([0, 0])).toBe(false)
  })
  it('a log with no numbers is not a workout', () => {
    expect(hasData(lift('2026-10-01', [{ weight: null, reps: null }]))).toBe(false)
    expect(hasData(lift('2026-10-01', [{ weight: null, reps: 8 }]))).toBe(true)
    expect(hasData({ date: '2026-10-01', exerciseId: 'running', cardio: { distance: null, minutes: 20 } })).toBe(true)
  })
  it('best lift by weight, reps or time', () => {
    const logs = [lift('2026-10-01', [{ weight: 135, reps: 5 }]), lift('2026-10-08', [{ weight: 145, reps: 3 }])]
    expect(bestLift(logs, 'bench')).toBe(145)
    expect(bestLift([lift('2026-10-01', [{ weight: null, reps: 12 }, { weight: null, reps: 15 }], 'push')], 'push', 'reps')).toBe(15)
  })
})

describe('sets typed in but not ticked', () => {
  // Typing doesn't log a set, ✓ does ("Finish workout" lists these as not logged yet); older sets without a tick count.
  const typed = { weight: 225, reps: 5, done: false, auto: false }
  it('are not a workout, a session, a best or volume until ticked', () => {
    const logs = [lift('2026-10-26', [{ weight: 185, reps: 5, done: true }]), lift('2026-10-28', [typed])]
    expect(hasData(logs[1])).toBe(false)
    expect(strengthSessions(logs, 'bench').map((s) => s.date)).toEqual(['2026-10-26'])
    expect(bestLift(logs, 'bench')).toBe(185)
    expect(weekStats(logs, '2026-10-28')).toMatchObject({ workouts: 1, volume: 925 })
    expect(bestLift([lift('2026-10-28', [{ weight: null, reps: 30, done: false }], 'push')], 'push', 'reps')).toBe(0)
  })
  it('count once ticked, and sets from before ticks existed count by their numbers', () => {
    expect(hasData(lift('2026-10-28', [{ ...typed, done: true }]))).toBe(true)
    expect(bestLift([lift('2026-10-28', [{ weight: 225, reps: 5 }])], 'bench')).toBe(225)
  })
})

describe('the week', () => {
  const day = (date: string) => lift(date, [{ weight: 100, reps: 10 }])
  it('a streak counts weeks in a row with a workout; the current week only adds once it has one', () => {
    // Weeks of Oct 12 and Oct 19 trained; today is Wednesday Oct 28 (week of Oct 26), nothing yet.
    const logs = [day('2026-10-13'), day('2026-10-21')]
    expect(weekStats(logs, '2026-10-28').streak).toBe(2)
    expect(weekStats([...logs, day('2026-10-27')], '2026-10-28').streak).toBe(3)
    // A gap week ends it.
    expect(weekStats([day('2026-10-06'), day('2026-10-21')], '2026-10-28').streak).toBe(1)
  })
  it('"last week so far" stops at the same weekday, across a clock change (US: Nov 1)', () => {
    const logs = [day('2026-10-27'), day('2026-10-31'), day('2026-11-03')]
    const s = weekStats(logs, '2026-11-04') // Wednesday after the change
    expect(s.workouts).toBe(1)
    expect(s.lastWorkouts).toBe(2)
    expect(s.lastWorkoutsSoFar).toBe(1) // up to last Wednesday only
    expect(s.volume).toBe(1000)
  })
  it('a workout dated in the future does not count yet', () => {
    expect(weekStats([day('2026-10-30')], '2026-10-28').workouts).toBe(0)
  })
})
