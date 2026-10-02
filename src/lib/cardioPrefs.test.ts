import { afterEach, describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { PlannedExercise } from '../types'
import { CARDIO_TYPES, setCardioPrefs, withCardioFor } from './cardioPrefs'
import { setOwnedGear } from './equipment'
import { repairState } from './migrate'
import { generateWorkout, swapExercise, type WorkoutStyle } from './randomizer'
import { mulberry32 } from './randomUtil'

const ex = (p: PlannedExercise) => BUILTIN_BY_ID.get(p.exerciseId)!
// The workout itself: conditioning formats now start with a short warm-up of their own.
const gen = (style: WorkoutStyle, focus: string[], minutes: number, seed = 1) => generateWorkout(focus, minutes, { style, rng: mulberry32(seed) }).filter((p) => !p.warmup)
const cardio = (w: PlannedExercise[]) => w.filter((p) => ex(p).kind === 'cardio')

afterEach(() => { setCardioPrefs(null); setOwnedGear(null) })

describe('cardio library', () => {
  it('has the less common machines, all logged as cardio', () => {
    for (const c of CARDIO_TYPES) expect(BUILTIN_BY_ID.get(c.exerciseId)?.kind, c.exerciseId).toBe('cardio')
    const names = CARDIO_TYPES.map((c) => c.label).join(' | ')
    for (const m of ['Elliptical', 'Rower', 'SkiErg', 'Air bike', 'BikeErg', 'Stair climber', 'VersaClimber', 'Jump rope']) expect(names).toContain(m)
  })
})

describe('liked cardio', () => {
  it('finishes a workout on the machine they like', () => {
    setCardioPrefs(['elliptical'])
    for (let seed = 1; seed <= 10; seed++) {
      const w = gen('standard', ['Chest', 'Cardio'], 60, seed)
      expect(cardio(w).map((p) => p.exerciseId)).toEqual(['Elliptical_Trainer'])
    }
  })

  it('splits the cardio time across several kinds when asked', () => {
    setCardioPrefs(['airbike', 'row', 'ski'], true)
    const w = gen('standard', ['Cardio'], 30, 2)
    expect(new Set(w.map((p) => p.exerciseId))).toEqual(new Set(['x-air-bike', 'x-row-erg', 'x-skierg']))
    expect(w.reduce((a, p) => a + (p.minutes ?? 0), 0)).toBe(30)
    // Not split: one of them per session.
    setCardioPrefs(['airbike', 'row', 'ski'], false)
    expect(gen('standard', ['Cardio'], 30, 2)).toHaveLength(1)
  })

  it('puts a liked machine in every CrossFit WOD, with a calorie or distance target', () => {
    setCardioPrefs(['airbike', 'ski'])
    for (let seed = 1; seed <= 15; seed++) {
      const w = gen('crossfit', [], 60, seed)
      const parts = new Set(w.filter((p) => p.wod).map((p) => p.block))
      for (const b of parts) {
        const m = w.filter((p) => p.block === b && ex(p).kind === 'cardio')
        expect(m, `seed ${seed} ${b}`).toHaveLength(1)
        expect(['x-air-bike', 'x-skierg']).toContain(m[0].exerciseId)
        expect(m[0].note).toMatch(/^\d+ cal\b/)
      }
    }
  })

  it('AMRAP and Tabata use machines for full body or when Cardio is picked, not for an arms-only piece', () => {
    setCardioPrefs(['bikeerg'])
    expect(cardio(gen('amrap', [], 20, 1)).map((p) => p.exerciseId)).toEqual(['x-bike-erg'])
    expect(cardio(gen('tabata', [], 20, 1)).map((p) => p.exerciseId)).toEqual(['x-bike-erg'])
    expect(cardio(gen('amrap', ['Arms'], 20, 1))).toHaveLength(0)
    expect(cardio(gen('emom', ['Arms', 'Cardio'], 20, 1)).map((p) => p.exerciseId)).toEqual(['x-bike-erg'])
  })

  it('uses the classic machines when there is no preference, and only what the equipment allows', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 30; seed++) for (const p of cardio(gen('crossfit', [], 45, seed))) seen.add(p.exerciseId)
    expect(seen.size).toBeGreaterThan(2)
    setOwnedGear([])
    for (let seed = 1; seed <= 20; seed++) for (const p of cardio(gen('amrap', [], 20, seed))) expect(p.exerciseId).toBe('running')
  })

  it('HIIT circuits get a machine station when they like one', () => {
    setCardioPrefs(['row'])
    for (let seed = 1; seed <= 10; seed++) {
      const w = gen('circuit', [], 30, seed)
      expect(cardio(w).map((p) => p.exerciseId), `seed ${seed}`).toEqual(['x-row-erg'])
    }
  })

  it('swapping a WOD machine picks another machine with its own amount', () => {
    const w = withCardioFor(['airbike', 'run'], false, () => gen('amrap', [], 20, 4))
    const i = w.findIndex((p) => ex(p).kind === 'cardio')
    const next = withCardioFor(['airbike', 'run'], false, () => swapExercise(w, i, mulberry32(1)))
    expect(ex(next[i]).kind).toBe('cardio')
    expect(next[i].exerciseId).not.toBe(w[i].exerciseId)
    expect(next[i].note).toMatch(/^\d+ (cal|m)$/)
    expect(next[i].block).toBe(w[i].block)
  })

  it('warms up on their machine', () => {
    setCardioPrefs(['stairs'])
    const w = generateWorkout(['Legs'], 45, { rng: mulberry32(1), warmup: { cardio: 5 } })
    expect(w[0].exerciseId).toBe('Stairmaster')
  })
})

describe('older logs', () => {
  it('SkiErg and rower sets become cardio entries', () => {
    const fixed = repairState({ logs: [{ date: '2026-01-01', exerciseId: 'x-skierg', sets: [{ weight: null, reps: null, seconds: 270 }] }] }, { logs: [] as unknown[] })
    expect(fixed.logs[0]).toEqual({ date: '2026-01-01', exerciseId: 'x-skierg', cardio: { distance: null, minutes: 5 } })
  })
})
