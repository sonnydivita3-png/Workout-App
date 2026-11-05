import { describe, expect, it } from 'vitest'
import { buildBlock, cardioDays, checkInDue, chooseDays, defaultCardio, minRest, recommendedDays, sessionsIn, cleanCoach, estimate, nextCheckIn, planWeeks, programGoals, programInput, review, strengthWeeks, weekBurn, weightTrend, type CoachAnswers, type CoachPlan } from './coach'
import { minutesFor } from './randomizer'
import { mulberry32 } from './randomUtil'
import { perMinute } from './calorieTarget'
import { plannedSets } from './muscles'
import { BUILTIN_BY_ID } from '../data/exercises'

const answers = (over: Partial<CoachAnswers> = {}): CoachAnswers => ({
  goals: [{ kind: 'lose', lb: 30 }], experience: 'some', days: [0, 2, 4, 5], minutes: 60, areas: [], startLb: 200, ...over,
})
const plan = (over: Partial<CoachPlan> = {}): CoachPlan => ({
  id: 'c1', createdAt: '', startDate: '2026-11-02', answers: answers(), weeks: 40, blockEnd: '2026-11-29', adjust: { minutes: 0, volume: 0 }, checkins: [], ...over,
})
const rate = (met: number) => perMinute(met, 200, '2026-11-02', { sex: 'male', birthYear: 1990, heightIn: 70 })

describe('how long a goal takes', () => {
  it('losing weight counts what training burns, never faster than 1% of bodyweight a week', () => {
    // 2,800 active calories a week of training: 0.8 lb a week, so 30 lb is about 38 weeks.
    const [lose] = estimate(answers(), 2800)
    expect(lose.weeks).toBe(38)
    expect(lose.rate).toMatch(/0\.8 lb a week from training/)
    // A huge burn still counts on 1% (2 lb a week at 200 lb) at most.
    expect(estimate(answers(), 20000)[0].weeks).toBe(15)
    // Barely any training: not reachable on training alone in two years.
    expect(estimate(answers(), 300)[0].weeks).toBeNull()
    // Weigh-ins win once there's a trend.
    expect(estimate(answers(), 2800, 1.5)[0].weeks).toBe(20)
  })
  it('muscle grows at a realistic rate for their training age', () => {
    const goal = { kind: 'muscle' as const, lb: 10, areas: ['Chest'] }
    const weeks = (experience: CoachAnswers['experience']) => estimate(answers({ goals: [goal], experience }), 0)[0].weeks!
    // 200 lb: about 2 lb a month new, 1.2 some experience, 0.6 experienced.
    expect(weeks('new')).toBe(22)
    expect(weeks('some')).toBeGreaterThan(weeks('new'))
    expect(weeks('experienced')).toBeGreaterThan(weeks('some'))
    expect(estimate(answers({ goals: [{ kind: 'muscle', areas: [] }] }), 0)[0].weeks).toBe(12)
  })
  it('strength goals grow the estimated max a few percent a month', () => {
    // 185 to 225 is 22% more: about 10 months with some experience.
    expect(strengthWeeks(185, 225, 'some')).toBe(43)
    expect(strengthWeeks(185, 225, 'new')).toBeLessThan(strengthWeeks(185, 225, 'some'))
    expect(strengthWeeks(230, 225, 'some')).toBe(4)
  })
  it('several goals: the plan runs as long as the longest, in 4-week blocks', () => {
    const est = estimate(answers({ goals: [{ kind: 'lose', lb: 10 }, { kind: 'move', focus: ['posture'] }] }), 2800)
    expect(est.map((e) => e.weeks)).toEqual([13, 8])
    expect(planWeeks(est)).toBe(16)
  })
})

describe('the plan it builds', () => {
  it('blends every goal into the planner, leading with the first', () => {
    expect(programGoals([{ kind: 'muscle', areas: [] }, { kind: 'move', focus: ['mobility'] }, { kind: 'lose', lb: 5 }])).toEqual(['muscle', 'mobility', 'fatloss'])
    expect(programInput(answers({ goals: [{ kind: 'strength', exerciseId: 'Barbell_Squat', targetLb: 315, startLb: 275 }] }), { minutes: 0, volume: 0 }).reps).toBe('heavy')
    const lighter = programInput(answers(), { minutes: 10, volume: -1 })
    expect(lighter).toMatchObject({ minutes: 70, sets: 'flat' })
  })
  it('moving better brings posture and functional sessions', () => {
    const days = buildBlock(answers({ goals: [{ kind: 'move', focus: ['posture'] }] }), { minutes: 0, volume: 0 }, '2026-11-02', '2026-11-02', {}, mulberry32(3))
    const styles = new Set(days.filter((d) => !d.rest).map((d) => d.style))
    expect(styles.has('posture') || styles.has('functional')).toBe(true)
  })
  it('focus areas get more of the week', () => {
    const biceps = (areas: string[]) => {
      let total = 0
      for (let seed = 1; seed <= 4; seed++) {
        const days = buildBlock(answers({ goals: [{ kind: 'muscle', areas }], areas, days: [0, 1, 3, 4] }), { minutes: 0, volume: 0 }, '2026-11-02', '2026-11-02', {}, mulberry32(seed))
        total += plannedSets(days.filter((d) => d.weekIndex === 0).flatMap((d) => d.items), (id) => BUILTIN_BY_ID.get(id)).Biceps
      }
      return total
    }
    expect(biceps(['Biceps'])).toBeGreaterThan(biceps([]))
  })
  it('a week of it burns a sensible number of calories', () => {
    const days = buildBlock(answers(), { minutes: 0, volume: 0 }, '2026-11-02', '2026-11-02', {}, mulberry32(1))
    const burn = weekBurn(days.filter((d) => d.weekIndex === 0), rate, 4)
    // Four hour-long fat-loss sessions at 200 lb: roughly 1,500 to 3,500 active calories.
    expect(burn).toBeGreaterThan(1500)
    expect(burn).toBeLessThan(3500)
    expect(days.filter((d) => !d.rest).every((d) => minutesFor(d.items) <= 60 * 1.3)).toBe(true)
  })
})

describe('the weekly check-in', () => {
  const base = { date: '2026-11-23', energy: 3, soreness: 2, done: 4, planned: 4 }
  const ctx = (weights: [string, number][] = []) => ({ weights: weights.map(([date, lb]) => ({ date, lb })), weeklyBurn: 2800 })
  it('is due a week after the start or the last check-in', () => {
    expect(nextCheckIn(plan())).toBe('2026-11-09')
    expect(checkInDue(plan(), '2026-11-08')).toBe(false)
    expect(checkInDue(plan({ checkins: [{ ...base, date: '2026-11-09', notes: [] }] }), '2026-11-16')).toBe(true)
  })
  it('reads the scale as a trend, not one morning', () => {
    expect(weightTrend([{ date: '2026-11-02', lb: 200 }, { date: '2026-11-16', lb: 198 }])).toBeCloseTo(1, 1)
    expect(weightTrend([{ date: '2026-11-02', lb: 200 }, { date: '2026-11-05', lb: 196 }])).toBeNull()
  })
  it('recovery comes first: worn down means a lighter week, and it says why', () => {
    const r = review(plan(), { ...base, soreness: 5 }, ctx())
    expect(r.adjust.volume).toBe(-1)
    expect(r.rebuild).toBe(true)
    expect(r.notes[0]).toMatch(/lighter/)
    expect(review(plan({ adjust: { minutes: 0, volume: -1 } }), base, ctx()).adjust.volume).toBe(0)
  })
  it('missed sessions: the plan stays the same, no harder plan', () => {
    const r = review(plan(), { ...base, done: 1, planned: 4 }, ctx([['2026-11-02', 200], ['2026-11-23', 200]]))
    expect(r.adjust.minutes).toBe(0)
    expect(r.notes.join(' ')).toMatch(/1 of 4 sessions/)
  })
  it('slow fat loss with every session done: 10 more minutes a session, and food named as the bigger lever', () => {
    const r = review(plan(), base, ctx([['2026-11-02', 200], ['2026-11-09', 200], ['2026-11-23', 199.8]]))
    expect(r.adjust.minutes).toBe(10)
    expect(r.notes.join(' ')).toMatch(/Food is the bigger lever/)
    // Never more than 20 extra minutes.
    expect(review(plan({ adjust: { minutes: 20, volume: 0 } }), base, ctx([['2026-11-02', 200], ['2026-11-23', 200]])).adjust.minutes).toBe(20)
  })
  it('losing faster than 1% a week: a warning about muscle, not more training', () => {
    const r = review(plan(), base, ctx([['2026-11-02', 200], ['2026-11-23', 192]]))
    expect(r.adjust.minutes).toBe(0)
    expect(r.notes.join(' ')).toMatch(/more than 1% of your weight/)
    // The timeline follows the real trend (about 2.7 lb a week, 22 lb to go).
    expect(r.estimates[0].weeks).toBeLessThan(12)
  })
  it('a stalled lift gets a lighter week; reaching it says so', () => {
    const goals = [{ kind: 'strength' as const, exerciseId: 'Barbell_Squat', targetLb: 315, startLb: 275 }]
    const stuck = { ...base, lift: { weight: 245, reps: 4 }, notes: [] }
    const p = plan({ answers: answers({ goals }), checkins: [stuck, stuck, stuck] })
    expect(review(p, { ...base, lift: { weight: 245, reps: 4 } }, ctx()).adjust.volume).toBe(-1)
    expect(review(p, { ...base, lift: { weight: 300, reps: 4 } }, ctx()).notes.join(' ')).toMatch(/reached 315/)
  })
})

describe('sessions since the last check-in', () => {
  it('a session later today is not a missed one', () => {
    const program = { id: 'p', kind: 'program' as const, title: '', createdAt: '', entries: [{ date: '2026-11-03', exerciseIds: ['a'] }, { date: '2026-11-04', exerciseIds: [] }, { date: '2026-11-05', exerciseIds: ['b'] }] }
    expect(sessionsIn(program, [], '2026-11-02', '2026-11-05')).toEqual({ planned: 1, done: 0 })
    const logs = [{ date: '2026-11-05', exerciseId: 'b', sets: [{ weight: 100, reps: 5, done: true }] }]
    expect(sessionsIn(program, logs, '2026-11-02', '2026-11-05')).toEqual({ planned: 2, done: 1 })
  })
})

describe('the week a coach would lay out', () => {
  const week = (a: CoachAnswers, seed = 1) => buildBlock(a, { minutes: 0, volume: 0 }, '2026-11-09', '2026-11-09', { capVolume: true }, mulberry32(seed)).filter((d) => d.weekIndex === 0)
  it('free every day: training days are picked and spread, with rest days between', () => {
    expect(recommendedDays('new', 7)).toBe(3)
    expect(recommendedDays('some', 7)).toBe(4)
    expect(chooseDays([0, 1, 2, 3, 4, 5, 6], 3, 'new')).toEqual([0, 2, 4])
    expect(chooseDays([0, 1, 2, 3, 4, 5, 6], 4, 'some')).toHaveLength(4)
    // Never more days in a row than their experience handles (Mon-Fri free, 4 days, new: not four in a row).
    const four = chooseDays([0, 1, 2, 3, 4], 4, 'new')
    expect(four).not.toEqual([0, 1, 2, 3])
    for (const exp of ['new', 'some', 'experienced'] as const) {
      const days = chooseDays([0, 1, 2, 3, 4, 5, 6], recommendedDays(exp, 7), exp)
      const plan = week(answers({ experience: exp, days, available: [0, 1, 2, 3, 4, 5, 6], cardio: defaultCardio([{ kind: 'lose', lb: 20 }]) }))
      expect(plan.filter((d) => d.rest).length, exp).toBeGreaterThanOrEqual(minRest(exp))
    }
  })
  it('cardio days go on the other free days, keeping the rest days', () => {
    expect(cardioDays([0, 1, 2, 3, 4, 5, 6], [0, 2, 4], 4, 'new')).toHaveLength(2) // 3 lifting + 2 cardio leaves 2 rest days
    const plan = week(answers({ days: [0, 2, 4], available: [0, 1, 2, 3, 4, 5, 6], cardio: { place: 'days', perWeek: 2, minutes: 40 } }))
    expect(plan.filter((d) => d.name?.startsWith('Cardio')).length).toBe(2)
    expect(plan.filter((d) => d.rest).length).toBeGreaterThanOrEqual(1)
  })
  it('two-a-days: cardio in the morning, lifting in the evening, on lifting days', () => {
    const plan = week(answers({ days: [0, 2, 4], available: [0, 2, 4], cardio: { place: 'ampm', perWeek: 3, minutes: 30 } }))
    const lifting = plan.filter((d) => !d.rest)
    expect(lifting).toHaveLength(3)
    for (const d of lifting) {
      expect(d.name).toMatch(/cardio AM · .+ PM/)
      expect(d.items.filter((p) => p.session === 'am').every((p) => p.minutes)).toBe(true)
      expect(d.items.some((p) => p.session === 'pm' && !p.minutes)).toBe(true)
    }
  })
  it('cardio after lifting is inside the session time', () => {
    const plan = week(answers({ days: [0, 2, 4], available: [0, 2, 4], minutes: 60, cardio: { place: 'after', perWeek: 3, minutes: 20 } }))
    for (const d of plan.filter((x) => !x.rest)) {
      expect(d.items.at(-1)!.minutes, d.name).toBeGreaterThanOrEqual(20)
      expect(minutesFor(d.items)).toBeLessThanOrEqual(60 * 1.15)
    }
  })
  it('a liked Tabata on a 90-minute day is lifting plus the Tabata, not 20 minutes', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const days = buildBlock(answers({ days: [0, 2, 4, 5], minutes: 90 }), { minutes: 0, volume: 0 }, '2026-11-09', '2026-11-09', { capVolume: true, likedStyles: ['tabata'] }, mulberry32(seed))
      for (const d of days.filter((x) => x.style === 'tabata' && x.weekIndex < 3)) expect(minutesFor(d.items), d.date).toBeGreaterThan(90 * 0.75)
    }
  })
  it('no lower-body day three times in a four-day week', () => {
    const LOWER = ['Quads', 'Hamstrings', 'Glutes']
    for (let seed = 1; seed <= 12; seed++) {
      const plan = week(answers({ goals: [{ kind: 'muscle', areas: [] }, { kind: 'move', focus: ['posture'] }], days: [0, 1, 3, 4] }), seed)
      const lower = plan.filter((d) => !d.rest && d.groups.length < 6 && d.groups.some((g) => LOWER.includes(g)) && d.groups.filter((g) => LOWER.includes(g)).length * 2 >= d.groups.filter((g) => !['Calves', 'Core', 'Biceps', 'Triceps'].includes(g)).length)
      expect(lower.length, plan.map((d) => d.name).join(', ')).toBeLessThanOrEqual(2)
    }
  })
})

describe('saved plans', () => {
  it('a damaged plan is no plan, not a crash', () => {
    expect(cleanCoach(null)).toBeNull()
    expect(cleanCoach({ id: 'x', startDate: '2026-11-02', answers: { goals: [{ kind: 'fly' }], days: [] } })).toBeNull()
    expect(cleanCoach({ ...plan(), adjust: { minutes: 'x', volume: 7 }, checkins: 'no' })).toMatchObject({ adjust: { minutes: 0, volume: 0 }, checkins: [] })
  })
})
