import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { ExerciseLog, Units } from '../types'
import { compareSet, estimateStart, formatSet, plateau, platesFor, sessionBasis, sessionScore, suggestNext } from './progression'

const lb = { weight: 'lb', distance: 'mi' } as const
const bench = BUILTIN_BY_ID.get('Barbell_Bench_Press_-_Medium_Grip')!
const squat = BUILTIN_BY_ID.get('Barbell_Full_Squat')!
const push = BUILTIN_BY_ID.get('Pushups')!
const plank = BUILTIN_BY_ID.get('Plank')!
const log = (sets: ExerciseLog['sets']): ExerciseLog => ({ date: '2026-09-01', exerciseId: 'x', sets })

describe('suggestNext (slow double progression, a set or two at a time)', () => {
  const curl = BUILTIN_BY_ID.get('Dumbbell_Bicep_Curl')!
  const rdl = BUILTIN_BY_ID.get('Romanian_Deadlift')!
  const at = (date: string, sets: ExerciseLog['sets']): ExerciseLog => ({ date, exerciseId: 'x', sets })
  const w = (weight: number, reps: number) => ({ weight, reps })

  it('target hit once: a rep more on two sets, not a heavier weight on all of them', () => {
    const s = suggestNext(bench, log([{ weight: 95, reps: 10, warmup: true }, w(135, 8), w(135, 8), w(135, 8), w(135, 8)]), { reps: 8, sets: 4 }, lb)
    expect(s).toMatchObject({ kind: 'add-reps', weight: 135, reps: 9, changed: 2 })
    expect(s.sets).toEqual([w(135, 9), w(135, 9), w(135, 8), w(135, 8)].map((x) => ({ ...x, seconds: null })))
  })
  it('adds the smallest step to the first two sets once the target holds (2 over, or two sessions running)', () => {
    const over = suggestNext(bench, log([w(135, 10), w(135, 9), w(135, 8)]), { reps: 8, sets: 3 }, lb)
    expect(over).toMatchObject({ kind: 'add-weight', weight: 140, reps: 8, changed: 2 })
    expect(over.sets!.map((x) => x.weight)).toEqual([140, 140, 135])
    const history = [at('2026-09-08', [w(135, 8), w(135, 8)]), at('2026-09-04', [w(135, 8), w(135, 8)])]
    const twice = suggestNext(bench, history[0], { reps: 8, sets: 2 }, lb, history)
    expect(twice).toMatchObject({ kind: 'add-weight', weight: 140, changed: 2 })
    expect(twice.why).toMatch(/two sessions running/)
  })
  it('then brings the other sets up to the new weight, two at a time (the squat case: 185, 185, 205, 205)', () => {
    const s = suggestNext(squat, log([w(185, 8), w(185, 8), w(205, 8), w(205, 8)]), { reps: 8, sets: 4 }, lb)
    expect(s).toMatchObject({ kind: 'add-weight', weight: 205, reps: 8, changed: 2 })
    expect(s.sets!.map((x) => x.weight)).toEqual([205, 205, 205, 205])
    expect(s.why).toBe('You did 205 lb × 8 on 2 of 4 sets. Bring 2 more up to 205 lb.')
  })
  it('more sets planned than last time is the step up: last time’s numbers, plus the extra sets', () => {
    const s = suggestNext(rdl, log([w(225, 6), w(225, 6), w(225, 6), w(225, 6)]), { reps: 6, sets: 5 }, lb)
    expect(s).toMatchObject({ kind: 'add-sets', weight: 225, reps: 6, changed: 1 })
  })
  it('a big jump for the load (35 to 40 lb dumbbells) waits for target + 2 on every set', () => {
    expect(suggestNext(curl, log([w(35, 10), w(35, 10), w(35, 10)]), { reps: 10, sets: 3 }, lb)).toMatchObject({ kind: 'add-reps', weight: 35, reps: 11, changed: 2 })
    expect(suggestNext(curl, log([w(35, 12), w(35, 12), w(35, 11)]), { reps: 10, sets: 3 }, lb)).toMatchObject({ kind: 'add-reps', reps: 12, changed: 1 })
    expect(suggestNext(curl, log([w(35, 12), w(35, 12), w(35, 12)]), { reps: 10, sets: 3 }, lb)).toMatchObject({ kind: 'add-weight', weight: 40, reps: 10 })
  })
  it('short of the target: same weight, a rep more on the lowest sets', () => {
    expect(suggestNext(bench, log([w(135, 8), w(135, 6), w(135, 7)]), { reps: 8 }, lb)).toMatchObject({ kind: 'add-reps', weight: 135, reps: 7, changed: 2 })
  })
  it('heavy squats step 10 lb, lighter ones 5', () => {
    expect(suggestNext(squat, log([w(225, 7), w(225, 5)]), { reps: 5 }, lb)).toMatchObject({ weight: 235, changed: 2 })
    expect(suggestNext(squat, log([w(135, 7), w(135, 5)]), { reps: 5 }, lb)).toMatchObject({ weight: 140 })
  })
  it('does not add weight after an all-out (RPE 10) set', () => {
    expect(suggestNext(bench, log([{ weight: 135, reps: 10, rpe: 10 }, w(135, 8)]), { reps: 8 }, lb).kind).toBe('repeat')
  })
  it('bodyweight: +1 rep on the lowest two sets; holds: +5s; first time: no numbers', () => {
    expect(suggestNext(push, log([{ weight: null, reps: 20 }, { weight: null, reps: 18 }, { weight: null, reps: 18 }]), {}, lb)).toMatchObject({ reps: 19, changed: 2 })
    expect(suggestNext(plank, log([{ weight: null, reps: null, seconds: 60 }]), {}, lb)).toMatchObject({ seconds: 65 })
    expect(suggestNext(bench, undefined, { reps: 8 }, lb).kind).toBe('first')
    // The first-time hint fits how it's logged: no "pick a weight" for push-ups or planks.
    expect(suggestNext(bench, undefined, {}, lb).why).toMatch(/pick a weight/)
    expect(suggestNext(push, undefined, {}, lb).why).toMatch(/reps short of failure/)
    expect(suggestNext(plank, undefined, {}, lb).why).toMatch(/hold until/)
  })
  it('a different rep target works the weight out from last time, not last time plus a step', () => {
    // 3 × 12 at 135, then 3 × 6: about 150 (not 140), from 135 × 12's estimated max with a rep in reserve.
    const down = suggestNext(bench, log([w(135, 12), w(135, 12), w(135, 12)]), { reps: 6, sets: 3 }, lb)
    expect(down).toMatchObject({ kind: 'estimate', weight: 150, reps: 6, changed: 3 })
    expect(down.sets!.every((x) => x.weight === 150 && x.reps === 6)).toBe(true)
    expect(down.why).toBe('6 reps today, 12 last time: weight worked out from your 135 lb × 12.')
    // 5s at 225, then 10s: about 190, not "225, on the way to 10".
    expect(suggestNext(squat, log([w(225, 5), w(225, 5), w(225, 5)]), { reps: 10, sets: 3 }, lb)).toMatchObject({ kind: 'estimate', weight: 190, reps: 10 })
    // A rep or two off is still ordinary double progression.
    expect(suggestNext(bench, log([w(185, 8), w(185, 8), w(185, 8)]), { reps: 10, sets: 3 }, lb)).toMatchObject({ kind: 'add-reps', weight: 185, reps: 9 })
  })
  it('a month or more off: about 90% to ease back in', () => {
    const before = { date: '2026-08-01', exerciseId: 'x', sets: [w(185, 8), w(185, 8), w(185, 8)] }
    const s = suggestNext(bench, before, { reps: 8, sets: 3 }, lb, [before], '2026-09-15')
    expect(s).toMatchObject({ kind: 'deload', weight: 165, reps: 8, changed: 3 })
    expect(s.why).toMatch(/^6 weeks since you last did this/)
    // Three weeks: carry on as usual.
    expect(suggestNext(bench, before, { reps: 8, sets: 3 }, lb, [before], '2026-08-22').kind).not.toBe('deload')
    // Bodyweight: repeat last time.
    const pushups = { date: '2026-08-01', exerciseId: 'x', sets: [{ weight: null, reps: 20 }] }
    expect(suggestNext(push, pushups, {}, lb, [pushups], '2026-09-15')).toMatchObject({ kind: 'repeat', reps: 20 })
  })
  it('a planned deload week: about 90% of last time, whatever last time was', () => {
    const s = suggestNext(bench, log([w(185, 8), w(185, 8), w(185, 8)]), { reps: 8, sets: 2, deload: true }, lb)
    expect(s).toMatchObject({ kind: 'deload', weight: 165, reps: 8, changed: 2 })
    expect(s.why).toMatch(/^Deload week/)
    expect(suggestNext(push, log([{ weight: null, reps: 20 }]), { deload: true }, lb)).toMatchObject({ kind: 'repeat', reps: 20 })
  })
  it('uses 2.5 kg steps in kg', () => {
    const s = suggestNext(bench, log([{ weight: 100 * 2.20462262, reps: 7 }, { weight: 100 * 2.20462262, reps: 5 }]), { reps: 5 }, { weight: 'kg', distance: 'km' })
    expect(Math.round((s.weight! / 2.20462262) * 10) / 10).toBe(102.5)
  })
})

describe('comparisons and plates', () => {
  it('compares sets by est. 1RM, reps or time; ignores warm-ups', () => {
    expect(compareSet({ weight: 140, reps: 8 }, { weight: 135, reps: 8 }, 'weight')).toBe('up')
    expect(compareSet({ weight: 135, reps: 7 }, { weight: 135, reps: 8 }, 'weight')).toBe('down')
    expect(compareSet({ weight: null, reps: 20 }, { weight: null, reps: 20 }, 'reps')).toBe('same')
    expect(compareSet({ weight: 50, reps: 10, warmup: true }, { weight: 135, reps: 8 }, 'weight')).toBeNull()
    expect(sessionScore(log([{ weight: 100, reps: 10, warmup: true }, { weight: 100, reps: 5 }]), 'weight', 'strength')).toBeCloseTo(100 * (1 + 5 / 30))
  })
  it('works out plates per side', () => {
    expect(platesFor(225, lb)).toEqual({ bar: 45, perSide: [45, 45], left: 0 })
    expect(platesFor(185, lb).perSide).toEqual([45, 25])
    expect(platesFor(100, { weight: 'kg', distance: 'km' }).perSide).toEqual([25, 15])
    expect(platesFor(47, lb).left).toBe(2)
  })
})

describe('plateaus', () => {
  const at = (date: string, reps: number[], weight = 185): ExerciseLog => ({ date, exerciseId: 'x', sets: reps.map((r) => ({ weight, reps: r })) })
  it('spots 3 sessions stuck at the same weight and suggests a ~10% deload', () => {
    const history = [at('2026-09-20', [8, 6]), at('2026-09-13', [8, 7]), at('2026-09-06', [8, 6])]
    expect(plateau(bench, history)).toBe(3)
    const s = suggestNext(bench, history[0], { reps: 8 }, lb, history)
    expect(s.kind).toBe('deload')
    expect(s.weight).toBe(165)
  })
  it('does not call it a plateau while reps are still going up, or after a weight change', () => {
    expect(plateau(bench, [at('2026-09-20', [8, 7]), at('2026-09-13', [7, 6]), at('2026-09-06', [6, 6])])).toBe(0)
    expect(plateau(bench, [at('2026-09-20', [8, 6]), at('2026-09-13', [8, 6], 180), at('2026-09-06', [8, 6], 180)])).toBe(0)
    expect(plateau(bench, [at('2026-09-20', [8, 6]), at('2026-09-13', [8, 6])])).toBe(0)
    expect(plateau(push, [at('2026-09-20', [8]), at('2026-09-13', [8]), at('2026-09-06', [8])])).toBe(0)
  })
  it('hitting the target still means progress, not a deload', () => {
    const history = [at('2026-09-20', [8, 8]), at('2026-09-13', [8, 8]), at('2026-09-06', [8, 8])]
    expect(suggestNext(bench, history[0], { reps: 8 }, lb, history).kind).toBe('add-weight')
  })
})

describe('starting weight for a new lift', () => {
  const ex = (id: string) => BUILTIN_BY_ID.get(id)!
  const lbs = { weight: 'lb', distance: 'mi' } as Units
  const benchLog: ExerciseLog = { date: '2026-09-20', exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', sets: [{ weight: 185, reps: 5 }, { weight: 185, reps: 5 }] }
  const lookup = (id: string) => BUILTIN_BY_ID.get(id)

  it('scales a similar lift for the equipment, a bit on the safe side', () => {
    const s = estimateStart(ex('Dumbbell_Bench_Press'), [benchLog], 10, lbs, lookup)!
    expect(s.kind).toBe('estimate')
    expect(s.weight).toBe(55) // per dumbbell, for 10 reps
    expect(s.reps).toBe(10)
    expect(s.why).toMatch(/your Bench Press \(185×5\)/)
  })

  it('incline pressing comes from flat, a little lighter', () => {
    expect(estimateStart(ex('Incline_Dumbbell_Press'), [benchLog], 10, lbs, lookup)!.weight).toBe(45)
  })

  it('kg users get kg steps', () => {
    const s = estimateStart(ex('Dumbbell_Bench_Press'), [benchLog], 10, { weight: 'kg', distance: 'km' } as Units, lookup)!
    expect(Math.round((s.weight! / 2.20462262) * 10) / 10 % 2.5).toBe(0)
  })

  it('needs the same movement and muscle, with weights', () => {
    expect(estimateStart(ex('Cable_Crossover'), [benchLog], 12, lbs, lookup)).toBeNull() // a fly isn't a press
    expect(estimateStart(ex('Leg_Press'), [benchLog], 10, lbs, lookup)).toBeNull()
    const bodyweightOnly: ExerciseLog = { ...benchLog, sets: [{ weight: null, reps: 20 }] }
    expect(estimateStart(ex('Dumbbell_Bench_Press'), [bodyweightOnly], 10, lbs, lookup)).toBeNull()
  })

  it('uses the most recent similar lift', () => {
    const later: ExerciseLog = { date: '2026-09-27', exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', sets: [{ weight: 225, reps: 5 }] }
    expect(estimateStart(ex('Dumbbell_Bench_Press'), [benchLog, later], 10, lbs, lookup)!.why).toMatch(/225×5/)
  })
})

describe('bodyweight sets on weighted lifts (no weight, or 0)', () => {
  const dips = BUILTIN_BY_ID.get('Dips_-_Chest_Version')!
  const bw = (reps: number, weight: number | null = 0) => ({ weight, reps })
  const lbs = { weight: 'lb', distance: 'mi' } as const

  it('a session with only bodyweight sets is measured in reps; any weighted set makes it a load session', () => {
    const now: ExerciseLog = { date: 'd', exerciseId: dips.id, sets: [bw(12), bw(10, null)] }
    expect(sessionBasis(now, 'weight', 'strength')).toBe('reps')
    expect(sessionScore(now, 'weight', 'strength')).toBe(12)
    const weighted: ExerciseLog = { date: 'd', exerciseId: dips.id, sets: [bw(12), { weight: 25, reps: 8 }] }
    expect(sessionBasis(weighted, 'weight', 'strength')).toBe('load')
    expect(sessionScore(weighted, 'weight', 'strength')).toBeCloseTo(25 * (1 + 8 / 30))
  })

  it('compares bodyweight sets by reps, and never weighted against bodyweight', () => {
    expect(compareSet(bw(12), bw(10), 'weight')).toBe('up')
    expect(compareSet(bw(10, null), bw(10), 'weight')).toBe('same')
    expect(compareSet({ weight: 25, reps: 8 }, bw(15), 'weight')).toBeNull()
    expect(compareSet({ weight: 25, reps: 8 }, { weight: 25, reps: 6 }, 'weight')).toBe('up')
  })

  it('suggests one more rep, not "add 5 lb", and never a deload', () => {
    const last: ExerciseLog = { date: 'd', exerciseId: dips.id, sets: [bw(10), bw(10), bw(9)] }
    const s = suggestNext(dips, last, { reps: 10 }, lbs, [last, last, last])
    expect(s).toMatchObject({ kind: 'add-reps', weight: null, reps: 11 })
    expect(plateau(dips, [last, last, last, last])).toBe(0)
  })

  it('shows "12 reps" rather than "0×12"', () => {
    expect(formatSet(bw(12), 'weight', lbs)).toBe('12 reps')
    expect(formatSet({ weight: 135, reps: 5 }, 'weight', lbs)).toBe('135×5')
    expect(formatSet({ weight: null, reps: 15 }, 'reps', lbs)).toBe('15')
    // Logged with a load before the exercise was switched to bodyweight: the load still shows.
    expect(formatSet({ weight: 25, reps: 8 }, 'reps', lbs)).toBe('25×8')
  })

  it('the ab roller is a reps move', () => {
    expect(BUILTIN_BY_ID.get('Ab_Roller')!.mode).toBe('reps')
  })
})
