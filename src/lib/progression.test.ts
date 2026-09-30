import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { ExerciseLog } from '../types'
import { compareSet, platesFor, sessionScore, suggestNext } from './progression'

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
