import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import { FOCUS_OPTIONS, generateWorkout, minutesFor, swapExercise } from './randomizer'

const groupsOf = (items: { exerciseId: string }[]) => new Set(items.map((p) => BUILTIN_BY_ID.get(p.exerciseId)!.group))

describe('generateWorkout', () => {
  it('stays close to the time budget and never repeats an exercise', () => {
    for (let run = 0; run < 200; run++) {
      for (const minutes of [20, 30, 45, 60, 90]) {
        const focus = [...FOCUS_OPTIONS].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 4))
        const w = generateWorkout(focus, minutes)
        expect(w.length).toBeGreaterThan(0)
        expect(new Set(w.map((p) => p.exerciseId)).size).toBe(w.length)
        // Fewer groups than exercises can force a minimum, so allow some slack over.
        expect(minutesFor(w)).toBeLessThanOrEqual(minutes + 8)
      }
    }
  })

  it('only picks from the selected focus areas', () => {
    for (let run = 0; run < 100; run++) {
      const w = generateWorkout(['Chest', 'Back'], 45)
      for (const g of groupsOf(w)) expect(['Chest', 'Back']).toContain(g)
      expect(groupsOf(w).size).toBe(2)
    }
  })

  it('cardio only gives timed cardio, mixed adds it after lifting', () => {
    const only = generateWorkout(['Cardio'], 30)
    expect(only.every((p) => BUILTIN_BY_ID.get(p.exerciseId)!.kind === 'cardio' && !!p.minutes)).toBe(true)
    expect(only.reduce((a, p) => a + p.minutes!, 0)).toBe(30)

    const mixed = generateWorkout(['Legs', 'Cardio'], 60)
    expect(BUILTIN_BY_ID.get(mixed.at(-1)!.exerciseId)!.kind).toBe('cardio')
    expect(mixed.some((p) => BUILTIN_BY_ID.get(p.exerciseId)!.kind === 'strength')).toBe(true)
  })

  it('gives every lift sets and reps', () => {
    for (const p of generateWorkout(['Legs', 'Arms', 'Core'], 60)) {
      expect(p.sets).toBeGreaterThanOrEqual(2)
      expect(p.sets).toBeLessThanOrEqual(4)
      expect(p.reps).toBeGreaterThan(0)
    }
  })

  it('handles more focus areas than the time allows', () => {
    const w = generateWorkout(['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core'], 20)
    expect(w.length).toBeGreaterThan(0)
    expect(minutesFor(w)).toBeLessThanOrEqual(28)
  })

  it('returns nothing for no focus', () => {
    expect(generateWorkout([], 30)).toEqual([])
  })
})

describe('swapExercise', () => {
  it('swaps for a different exercise in the same group', () => {
    const w = generateWorkout(['Chest'], 45)
    const s = swapExercise(w, 0)
    expect(s[0].exerciseId).not.toBe(w[0].exerciseId)
    expect(BUILTIN_BY_ID.get(s[0].exerciseId)!.group).toBe('Chest')
    expect(s[0].sets).toBe(w[0].sets)
  })
})
