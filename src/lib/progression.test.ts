import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { ExerciseLog } from '../types'
import { compareSet, formatSet, plateau, platesFor, sessionBasis, sessionScore } from './progression'

const lb = { weight: 'lb', distance: 'mi' } as const
const bench = BUILTIN_BY_ID.get('Barbell_Bench_Press_-_Medium_Grip')!
const push = BUILTIN_BY_ID.get('Pushups')!
const log = (sets: ExerciseLog['sets']): ExerciseLog => ({ date: '2026-09-01', exerciseId: 'x', sets })

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
  it('spots 3 sessions stuck at the same weight (plans rotate that lift for a while)', () => {
    const history = [at('2026-09-20', [8, 6]), at('2026-09-13', [8, 7]), at('2026-09-06', [8, 6])]
    expect(plateau(bench, history)).toBe(3)
  })
  it('does not call it a plateau while reps are still going up, or after a weight change', () => {
    expect(plateau(bench, [at('2026-09-20', [8, 7]), at('2026-09-13', [7, 6]), at('2026-09-06', [6, 6])])).toBe(0)
    expect(plateau(bench, [at('2026-09-20', [8, 6]), at('2026-09-13', [8, 6], 180), at('2026-09-06', [8, 6], 180)])).toBe(0)
    expect(plateau(bench, [at('2026-09-20', [8, 6]), at('2026-09-13', [8, 6])])).toBe(0)
    expect(plateau(push, [at('2026-09-20', [8]), at('2026-09-13', [8]), at('2026-09-06', [8])])).toBe(0)
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

  it('bodyweight sets are never a plateau (there is no weight to stall at)', () => {
    const last: ExerciseLog = { date: 'd', exerciseId: dips.id, sets: [bw(10), bw(10), bw(9)] }
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
