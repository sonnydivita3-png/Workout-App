import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { PlannedExercise } from '../types'
import { BODY_PARTS } from './bodyParts'
import { overloaded, sessionSets } from './muscles'
import { defaultWeekdays, generateProgram } from './program'
import { extraTimeOptions, FINISHER, generateWorkout, minutesFor, type ExtraTimeOption } from './randomizer'
import { mulberry32 } from './randomUtil'
import { extraTimeOf, perMuscleOf } from './volumePrefs'

const lookup = (id: string) => BUILTIN_BY_ID.get(id)
const of = (part: string, items: PlannedExercise[]) => items.filter((p) => !p.warmup && BUILTIN_BY_ID.get(p.exerciseId)?.group === part)
const sets = (items: PlannedExercise[]) => items.reduce((a, p) => a + p.sets, 0)

describe('too much for one muscle', () => {
  it('spots an hour of one muscle, not a full-body hour', () => {
    const chestHour = generateWorkout(['Chest'], 60, { style: 'standard', rng: mulberry32(7) })
    const over = overloaded(chestHour, lookup)
    expect(over.map((o) => o.part)).toEqual(['Chest'])
    expect(over[0].exercises).toBeGreaterThan(5)
    expect(overloaded(generateWorkout([...BODY_PARTS], 60, { style: 'standard', rng: mulberry32(7) }), lookup)).toEqual([])
    // Their own, higher limit on exercises: past about 15 sets still counts as a lot.
    const n = over[0].exercises
    expect(overloaded(chestHour, lookup, n).length).toBe(over[0].sets > sessionSets('Chest') ? 1 : 0)
    // Circuit stations and warm-ups aren't straight sets: they don't count.
    expect(overloaded([...Array(8)].map(() => ({ exerciseId: 'Pushups', sets: 4, block: 'circuit' })), lookup)).toEqual([])
  })

  it('offers other ways to use the time: heavier with fewer exercises, a finisher, another part, or shorter', () => {
    const base = generateWorkout(['Chest'], 60, { style: 'standard', rng: mulberry32(3) })
    const options = extraTimeOptions(['Chest'], 60, { style: 'standard', rng: mulberry32(4) }, 5, ['Chest'])
    expect(options.map((o) => o.id)).toEqual(['heavier', 'finisher', 'part', 'shorter'])
    const by = Object.fromEntries(options.map((o) => [o.id, o])) as Record<string, ExtraTimeOption>
    // Heavier: fewer exercises, 4-5 sets each, 5-8 reps (so longer rests), still most of the hour.
    const heavy = of('Chest', by.heavier.items)
    expect(heavy.length).toBeLessThanOrEqual(5)
    expect(heavy.length).toBeLessThan(of('Chest', base).length)
    for (const p of heavy) expect([4, 5]).toContain(p.sets)
    for (const p of heavy.filter((x) => BUILTIN_BY_ID.get(x.exerciseId)?.mode === 'weight')) expect([5, 8]).toContain(p.reps)
    expect(minutesFor(by.heavier.items)).toBeGreaterThan(45)
    // The rest keep chest to 5 exercises and about 15 sets.
    for (const id of ['finisher', 'part', 'shorter']) {
      const chest = of('Chest', by[id].items)
      expect(chest.length, id).toBeLessThanOrEqual(5)
      expect(sets(chest), id).toBeLessThanOrEqual(sessionSets('Chest'))
    }
    expect(by.finisher.items.some((p) => p.note === FINISHER)).toBe(true)
    expect(Math.abs(minutesFor(by.finisher.items) - 60)).toBeLessThan(8)
    expect(by.part.part).toBe('Triceps')
    expect(of('Triceps', by.part.items).length).toBeGreaterThan(0)
    expect(minutesFor(by.shorter.items)).toBeLessThan(minutesFor(base) - 5)
  })

  it('keeps to their own number, and a workout with a cardio part gets no finisher', () => {
    for (const o of extraTimeOptions(['Chest'], 60, { style: 'standard', rng: mulberry32(5) }, 3, ['Chest'])) {
      expect(of('Chest', o.items).length, o.id).toBeLessThanOrEqual(3)
    }
    expect(extraTimeOptions(['Chest', 'Cardio'], 75, { style: 'standard', rng: mulberry32(5) }, 5, ['Chest']).map((o) => o.id)).not.toContain('finisher')
  })

  it('plans keep to their number of exercises per muscle', () => {
    const days = generateProgram({ anchorMonday: '2026-09-28', weeks: 1, trainWeekdays: defaultWeekdays(5), goal: 'muscle', minutes: 60, split: 'bodypart', rng: mulberry32(1), perMuscle: 3 })
    for (const d of days.filter((x) => !x.rest)) {
      const count = new Map<string, number>()
      for (const p of d.items) {
        const g = BUILTIN_BY_ID.get(p.exerciseId)?.group
        if (g && !['Cardio', 'Mobility'].includes(g) && !p.warmup) count.set(g, (count.get(g) ?? 0) + 1)
      }
      for (const [g, n] of count) expect(n, `${d.name}: ${g}`).toBeLessThanOrEqual(3)
    }
  })

  it('reads saved choices safely', () => {
    expect(perMuscleOf(undefined)).toBe(5)
    expect(perMuscleOf(3.6)).toBe(4)
    expect(perMuscleOf(40)).toBe(12)
    expect(perMuscleOf(-2)).toBe(5)
    expect(extraTimeOf('heavier')).toBe('heavier')
    expect(extraTimeOf('nonsense')).toBe('ask')
  })
})
