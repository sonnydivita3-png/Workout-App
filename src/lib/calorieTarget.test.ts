import { describe, expect, it } from 'vitest'
import { cardioMet, effortLabel, fitCardio, setCardioPace, metForRate, perMinute, planForCalories, planWithin, recentSpeed, setCardioEffort, STYLE_MET, styleFor, WARMUP_MET, workoutCalories } from './calorieTarget'
import { speedForMet } from './calories'
import type { PlannedExercise } from '../types'

const LB = 80 / 0.45359237 // 80 kg
const rate = (met: number) => perMinute(met, LB, '2026-10-23')

describe('a workout for a calorie target', () => {
  it('net calories a minute: (MET − 1) × kg / 60 without personal details', () => {
    expect(rate(8)).toBeCloseTo((7 * 80) / 60, 5) // running at a usual pace: about 9.3 a minute
    expect(rate(STYLE_MET.standard)).toBeCloseTo((2.5 * 80) / 60, 5) // lifting: about 3.3 a minute
  })

  it('lifting keeps its minutes and the cardio makes up the rest', () => {
    const run = cardioMet(['running'], 'steady')
    const plan = planForCalories(1000, [{ key: 'warmup', met: WARMUP_MET, minutes: 5 }, { key: 'standard', met: STYLE_MET.standard, minutes: 45 }, { key: 'cardio', met: run, minutes: 15 }], rate, 'cardio')
    expect(plan.minutes.warmup).toBe(5)
    expect(plan.minutes.standard).toBe(45)
    // 5 min warm-up ≈ 15, 45 min lifting ≈ 150, so about 835 from running at ≈ 9.3 a minute: ≈ 90 minutes.
    expect(plan.minutes.cardio).toBe(90)
    expect(plan.totalMinutes).toBe(140)
    expect(Math.abs(plan.totalKcal - 1000)).toBeLessThan(50)
  })

  it('harder cardio gets there sooner', () => {
    const parts = (kind: 'steady' | 'intervals') => [{ key: 'cardio', met: cardioMet(['running'], kind), minutes: 30 }]
    expect(planForCalories(600, parts('intervals'), rate, 'cardio').minutes.cardio).toBeLessThan(planForCalories(600, parts('steady'), rate, 'cardio').minutes.cardio)
  })

  it('without cardio, the parts keep their shares and grow together; the warm-up stays', () => {
    const plan = planForCalories(500, [{ key: 'warmup', met: WARMUP_MET, minutes: 5 }, { key: 'standard', met: STYLE_MET.standard, minutes: 30 }, { key: 'circuit', met: STYLE_MET.circuit, minutes: 30 }], rate)
    expect(plan.minutes.warmup).toBe(5)
    expect(plan.minutes.standard).toBe(plan.minutes.circuit)
    expect(Math.abs(plan.totalKcal - 500)).toBeLessThan(40)
  })

  it('a small target never asks for less than five minutes of cardio', () => {
    const plan = planForCalories(100, [{ key: 'standard', met: STYLE_MET.standard, minutes: 60 }, { key: 'cardio', met: 8, minutes: 10 }], rate, 'cardio')
    expect(plan.minutes.cardio).toBe(5)
  })

  it('the workout as made: its own cardio counts, and the cardio is stretched to land on the target', () => {
    const mets = { lift: STYLE_MET.standard, cond: STYLE_MET.circuit, cardioFactor: 1 }
    const items: PlannedExercise[] = [
      { exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', sets: 4, reps: 6, est: 12 },
      { exerciseId: 'Barbell_Squat', sets: 4, reps: 6, est: 13 },
      { exerciseId: 'hiking', sets: 1, minutes: 45, est: 45 },
      { exerciseId: 'Bicycling_Stationary', sets: 1, minutes: 45, est: 45 },
    ]
    // Hiking (MET 6) and a stationary bike (7) burn less than the running the time was planned for.
    const before = workoutCalories(items, rate, mets)
    expect(before).toBeLessThan(950)
    const fitted = fitCardio(items, 1000, rate, mets)
    expect(Math.abs(workoutCalories(fitted, rate, mets) - 1000)).toBeLessThan(60)
    expect(fitted[2].minutes).toBeGreaterThan(45)
    expect(fitted[2].minutes! % 5).toBe(0)
    expect(fitted[0]).toBe(items[0]) // lifting untouched
    // No cardio: nothing to stretch.
    expect(fitCardio(items.slice(0, 2), 1000, rate, mets)).toEqual(items.slice(0, 2))
  })

  describe('within a time limit: how hard it has to be', () => {
    const metOf = (r: number) => metForRate(r, LB, '2026-10-23')
    it('metForRate undoes perMinute', () => {
      for (const met of [3.5, 8, 12.3]) expect(metOf(rate(met))).toBeCloseTo(met, 6)
    })

    it('1,000 calories in 90 minutes with 40 of lifting: the run has to be very fast; harder lifting eases it', () => {
      const parts = (lift: number) => [{ key: 'warmup', met: WARMUP_MET, minutes: 5 }, { key: 'lift', met: lift, minutes: 40 }, { key: 'cardio', met: 8, minutes: 30 }]
      const plan = planWithin(1000, 90, parts(STYLE_MET.standard), rate, metOf, 'cardio')
      expect(plan.minutes).toEqual({ warmup: 5, lift: 40, cardio: 45 })
      expect(plan.totalMinutes).toBe(90)
      expect(Math.abs(plan.totalKcal - 1000)).toBeLessThan(5)
      const mph = speedForMet('running', plan.needMet!)!
      expect(mph).toBeGreaterThan(10) // under 6:00 a mile for 45 minutes: not realistic for most
      const harder = planWithin(1000, 90, parts(STYLE_MET.supersets), rate, metOf, 'cardio')
      expect(speedForMet('running', harder.needMet!)!).toBeLessThan(mph)
      // At an easy usual pace (MET 8), what it really takes: much longer.
      expect(planForCalories(1000, parts(STYLE_MET.standard), rate, 'cardio').totalMinutes).toBeGreaterThan(120)
    })

    it('lifting only: the style it takes, or none when no lifting burns that much', () => {
      const lift = (target: number, limit: number) => planWithin(target, limit, [{ key: 'warmup', met: WARMUP_MET, minutes: 5 }, { key: 'standard', met: STYLE_MET.standard, minutes: 40 }], rate, metOf)
      expect(styleFor(lift(180, 60).needMet!)).toBe('standard')
      expect(styleFor(lift(250, 60).needMet!)).toBe('supersets')
      expect(styleFor(lift(500, 60).needMet!)).toBe('circuit')
      expect(styleFor(lift(1000, 60).needMet!)).toBeNull()
      expect(lift(500, 60).minutes.standard).toBe(55)
    })

    it('no time left for the cardio: says so', () => {
      const plan = planWithin(600, 45, [{ key: 'lift', met: 3.5, minutes: 45 }, { key: 'cardio', met: 8, minutes: 10 }], rate, metOf, 'cardio')
      expect(plan.needMet).toBeNull()
    })

    it('the run gets a target distance (so a pace); other cardio an effort; the estimate matches', () => {
      const mets = { lift: STYLE_MET.standard, cond: STYLE_MET.circuit, cardioFactor: 1 }
      const set = setCardioEffort([{ exerciseId: 'running', sets: 1, minutes: 45, est: 45 }, { exerciseId: 'x-row-erg', sets: 1, minutes: 20, est: 20 }], 11, 1)
      expect(set[0].distance! / 0.75).toBeCloseTo(speedForMet('running', 11)!, 0)
      expect(set[1].intensity).toBeCloseTo(11 / 7, 2)
      expect(workoutCalories(set, rate, mets)).toBeCloseTo(65 * rate(11), -1)
      expect(effortLabel(11 / 7)).toBe('too hard')
      expect(effortLabel(1)).toBe('moderate')
    })

    it('their recent speed: the median of their latest logs', () => {
      const log = (date: string, distance: number, minutes: number) => ({ date, exerciseId: 'running', cardio: { distance, minutes } })
      expect(recentSpeed([log('2026-10-01', 3, 30), log('2026-10-03', 6, 60), log('2026-10-05', 4, 30)], ['running'])).toBe(6)
      expect(recentSpeed([], ['running'])).toBeNull()
    })
  })

  it('at their pace: their run at their speed, other cardio at their effort; faster means less time', () => {
    const mets = { lift: STYLE_MET.standard, cond: STYLE_MET.circuit, cardioFactor: 1 }
    const items: PlannedExercise[] = [{ exerciseId: 'running', sets: 1, minutes: 30, est: 30 }, { exerciseId: 'x-row-erg', sets: 1, minutes: 20, est: 20 }]
    const paced = setCardioPace(items, { exerciseId: 'running', mph: 8, effort: 'hard' })
    expect(paced[0].distance).toBe(4)
    expect(paced[1].intensity).toBe(1.2)
    expect(setCardioPace(items, { effort: 'moderate' })[1].intensity).toBeUndefined()
    const fast = fitCardio(setCardioPace(items, { exerciseId: 'running', mph: 8, effort: 'hard' }), 600, rate, mets)
    const slow = fitCardio(setCardioPace(items, { exerciseId: 'running', mph: 5.5, effort: 'easy' }), 600, rate, mets)
    const total = (l: PlannedExercise[]) => l.reduce((a, p) => a + p.minutes!, 0)
    expect(total(fast)).toBeLessThan(total(slow))
    // The pace survives the time being fitted: still 8 mph.
    expect(fast[0].distance! / (fast[0].minutes! / 60)).toBeCloseTo(8, 0)
    expect(Math.abs(workoutCalories(fast, rate, mets) - 600)).toBeLessThan(60)
  })
})
