import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { ExerciseLog, Units } from '../types'
import { compareSet, estimateStart, plateau, platesFor, sessionScore, suggestNext } from './progression'

const lb = { weight: 'lb', distance: 'mi' } as const
const bench = BUILTIN_BY_ID.get('Barbell_Bench_Press_-_Medium_Grip')!
const squat = BUILTIN_BY_ID.get('Barbell_Full_Squat')!
const push = BUILTIN_BY_ID.get('Pushups')!
const plank = BUILTIN_BY_ID.get('Plank')!
const log = (sets: ExerciseLog['sets']): ExerciseLog => ({ date: '2026-09-01', exerciseId: 'x', sets })

describe('suggestNext (double progression)', () => {
  it('adds weight once every working set hits the target', () => {
    const s = suggestNext(bench, log([{ weight: 95, reps: 10, warmup: true }, { weight: 135, reps: 8 }, { weight: 135, reps: 8 }, { weight: 135, reps: 8 }]), { reps: 8 }, lb)
    expect(s).toMatchObject({ kind: 'add-weight', weight: 140, reps: 8 })
    expect(suggestNext(squat, log([{ weight: 225, reps: 5 }, { weight: 225, reps: 5 }]), { reps: 5 }, lb).weight).toBe(235)
  })
  it('otherwise keeps the weight and adds a rep', () => {
    expect(suggestNext(bench, log([{ weight: 135, reps: 8 }, { weight: 135, reps: 6 }]), { reps: 8 }, lb)).toMatchObject({ kind: 'add-reps', weight: 135, reps: 7 })
  })
  it('does not add weight after an all-out (RPE 10) set', () => {
    expect(suggestNext(bench, log([{ weight: 135, reps: 8, rpe: 10 }, { weight: 135, reps: 8 }]), { reps: 8 }, lb).kind).toBe('repeat')
  })
  it('bodyweight: +1 rep; holds: +5s; first time: no numbers', () => {
    expect(suggestNext(push, log([{ weight: null, reps: 20 }, { weight: null, reps: 18 }]), {}, lb)).toMatchObject({ reps: 21 })
    expect(suggestNext(plank, log([{ weight: null, reps: null, seconds: 60 }]), {}, lb)).toMatchObject({ seconds: 65 })
    expect(suggestNext(bench, undefined, { reps: 8 }, lb).kind).toBe('first')
  })
  it('uses 2.5 kg / 5 kg steps in kg', () => {
    const s = suggestNext(bench, log([{ weight: 100 * 2.20462262, reps: 5 }, { weight: 100 * 2.20462262, reps: 5 }]), { reps: 5 }, { weight: 'kg', distance: 'km' })
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
  it('hitting the target still means add weight, not deload', () => {
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
