import { describe, expect, it } from 'vitest'
import { cardioMet, fitCardio, perMinute, planForCalories, STYLE_MET, WARMUP_MET, workoutCalories } from './calorieTarget'
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
})
