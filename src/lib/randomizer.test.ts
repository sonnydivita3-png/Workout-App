import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import { FOCUS_OPTIONS, generateWorkout, minutesFor, plannedFor, replaceExercise, swapExercise, targetsFor } from './randomizer'

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

  it('gives every lift sets plus reps (or seconds for timed holds)', () => {
    for (let run = 0; run < 100; run++) {
      for (const p of generateWorkout(['Legs', 'Arms', 'Core'], 60)) {
        expect(p.sets).toBeGreaterThanOrEqual(2)
        expect(p.sets).toBeLessThanOrEqual(4)
        const mode = BUILTIN_BY_ID.get(p.exerciseId)!.mode
        if (mode === 'time') {
          expect(p.seconds).toBeGreaterThan(0)
          expect(p.reps).toBeUndefined()
        } else {
          expect(p.reps).toBeGreaterThan(0)
          expect(p.seconds).toBeUndefined()
        }
      }
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

describe('exercise modes', () => {
  it('classifies timed and bodyweight moves from the library', () => {
    expect(BUILTIN_BY_ID.get('Plank')!.mode).toBe('time')
    expect(BUILTIN_BY_ID.get('Barbell_Bench_Press_-_Medium_Grip')!.mode).toBe('weight')
    const pushups = [...BUILTIN_BY_ID.values()].find((e) => e.id === 'Pushups')
    expect(pushups?.mode).toBe('reps')
  })

  it('timed exercises get hold seconds, never reps', () => {
    const plank = BUILTIN_BY_ID.get('Plank')!
    for (let i = 0; i < 50; i++) {
      const t = targetsFor(plank)
      expect([30, 45, 60]).toContain(t.seconds)
      expect(t.reps).toBeUndefined()
    }
  })
})

describe('replaceExercise', () => {
  it('keeps the slot, sets and order while swapping in a chosen exercise', () => {
    const w = generateWorkout(['Chest', 'Back'], 45)
    const plank = BUILTIN_BY_ID.get('Plank')!
    const r = replaceExercise(w, 1, plank)
    expect(r).toHaveLength(w.length)
    expect(r[1].exerciseId).toBe('Plank')
    expect(r[1].sets).toBe(w[1].sets)
    expect(r[1].seconds).toBeGreaterThan(0)
    expect(r[0]).toBe(w[0]) // untouched rows are the same objects
    expect(w[1].exerciseId).not.toBe('Plank') // original array not mutated
  })

  it('converts between lifting and cardio', () => {
    const run = BUILTIN_BY_ID.get('running')!
    const lift = plannedFor(run, { exerciseId: 'x', sets: 4, reps: 8 })
    expect(lift).toEqual({ exerciseId: 'running', sets: 1, minutes: 15 })
    const back = plannedFor(BUILTIN_BY_ID.get('Barbell_Bench_Press_-_Medium_Grip')!, { exerciseId: 'running', sets: 1, minutes: 30 })
    expect(back.sets).toBeGreaterThanOrEqual(2)
    expect(back.reps).toBeGreaterThan(0)
    expect(back.minutes).toBeUndefined()
  })
})
