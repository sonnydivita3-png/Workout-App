import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID, EXERCISES } from '../data/exercises'
import type { PlannedExercise } from '../types'
import { BODY_PARTS, expandParts, isFullBody, partFromName } from './bodyParts'
import { withGearFor } from './equipment'
import { repairState } from './migrate'
import { generateWorkout, liftsMinutes, LIFT_GROUPS, type WorkoutStyle } from './randomizer'
import { familyOf, mulberry32 } from './randomUtil'

const ex = (p: PlannedExercise) => BUILTIN_BY_ID.get(p.exerciseId)!
const count = (xs: (string | undefined)[]) => xs.reduce<Record<string, number>>((m, x) => (x ? { ...m, [x]: (m[x] ?? 0) + 1 } : m), {})

describe('body parts', () => {
  it('splits legs and arms in the library', () => {
    const groups = new Set(EXERCISES.map((e) => e.group))
    for (const p of BODY_PARTS) expect(groups.has(p), p).toBe(true)
    expect(groups.has('Legs')).toBe(false)
    expect(groups.has('Arms')).toBe(false)
    const group = (name: string) => EXERCISES.find((e) => e.name === name)?.group
    expect(group('Back Squat')).toBe('Quads')
    expect(group('Romanian Deadlift')).toBe('Hamstrings')
    expect(group('Calf Raise')).toBe('Calves')
    expect(group('Dumbbell Curl')).toBe('Biceps')
    expect(group('Triceps Pushdown')).toBe('Triceps')
    expect(group('Bench Press - Powerlifting')).toBe('Chest') // the source calls it triceps
  })

  it('reads the old broad names', () => {
    expect(expandParts(['Legs', 'Chest', 'Arms'])).toEqual(['Quads', 'Hamstrings', 'Calves', 'Chest', 'Biceps', 'Triceps'])
    expect(partFromName('Legs', 'Seated calf machine')).toBe('Calves')
    expect(partFromName('Legs', 'Nordic curl')).toBe('Hamstrings')
    expect(partFromName('Legs', 'Sissy squat')).toBe('Quads')
    expect(partFromName('Arms', 'Rope skull crushers')).toBe('Triceps')
    expect(partFromName('Arms', 'Spider curl')).toBe('Biceps')
    expect(partFromName('Chest', 'Anything')).toBe('Chest')
  })

  it('moves saved custom exercises and randomizer choices over', () => {
    const fixed = repairState({ custom: [{ id: 'c1', name: 'Hack squat (gym 2)', kind: 'strength', group: 'Legs', custom: true }], genPrefs: { warmup: [], rest: 'normal', focus: ['Arms', 'Cardio'] } }, { custom: [] as unknown[], genPrefs: { warmup: [], rest: 'normal' } as Record<string, unknown> })
    expect((fixed.custom[0] as { group: string }).group).toBe('Quads')
    expect(fixed.genPrefs.focus).toEqual(['Biceps', 'Triceps', 'Cardio'])
  })

  it('knows a full-body choice from a split', () => {
    expect(isFullBody([...LIFT_GROUPS])).toBe(true)
    expect(isFullBody(expandParts(['Chest', 'Back', 'Legs']))).toBe(true)
    expect(isFullBody(expandParts(['Legs', 'Arms', 'Core']))).toBe(false)
    expect(isFullBody(['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'])).toBe(false)
  })
})

describe('full-body workouts: one exercise per body part', () => {
  const styles: WorkoutStyle[] = ['standard', 'strength', 'supersets', 'bodyweight']
  for (const style of styles) {
    it(`${style}: no part twice, no movement twice, and it still fills the time`, () => {
      for (const minutes of [30, 45, 60, 75, 90]) {
        for (let seed = 1; seed <= 8; seed++) {
          const w = generateWorkout([...LIFT_GROUPS], minutes, { style, rng: mulberry32(seed) })
          const label = `${style} ${minutes} min seed ${seed}: ${w.map((p) => `${ex(p).group}:${ex(p).name}`).join(', ')}`
          // No equipment leaves some parts without moves, so a long bodyweight session may give a part a second,
          // different movement. Everything else: exactly one per part.
          for (const [part, n] of Object.entries(count(w.map((p) => ex(p).group)))) expect(n, `${part} in ${label}`).toBeLessThanOrEqual(style === 'bodyweight' && minutes >= 75 ? 2 : 1)
          for (const [f, n] of Object.entries(count(w.map((p) => familyOf(ex(p)))))) expect(n, `${f} in ${label}`).toBe(1)
          const real = liftsMinutes(w)
          expect(real, label).toBeGreaterThanOrEqual(minutes * 0.85)
          expect(real, label).toBeLessThanOrEqual(minutes * 1.1)
        }
      }
    })
  }

  it('leads with the big lifts: a squat, a press, a pull and a hinge, before arms, calves and core', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = generateWorkout([...LIFT_GROUPS], 60, { rng: mulberry32(seed) })
      const groups = w.map((p) => ex(p).group)
      for (const part of ['Quads', 'Chest', 'Back', 'Hamstrings']) expect(groups, `seed ${seed}`).toContain(part)
      const firstSmall = groups.findIndex((g) => ['Biceps', 'Triceps', 'Calves', 'Core'].includes(g))
      const lastBig = Math.max(...['Quads', 'Chest', 'Back', 'Hamstrings'].map((g) => groups.indexOf(g)))
      expect(lastBig, `seed ${seed}: ${groups.join(', ')}`).toBeLessThan(firstSmall < 0 ? Infinity : firstSmall)
      expect(ex(w.find((p) => ex(p).group === 'Back')!).name, 'an upright row is a shoulder move').not.toMatch(/upright/i)
    }
  })

  it('with dumbbells only or no equipment it is still one per part', () => {
    for (const gear of [['Dumbbell'], []]) {
      for (let seed = 1; seed <= 6; seed++) {
        const w = withGearFor(gear, () => generateWorkout([...LIFT_GROUPS], 45, { rng: mulberry32(seed) }))
        for (const [part, n] of Object.entries(count(w.map((p) => ex(p).group)))) expect(n, `${part} with ${gear.join('/') || 'bodyweight'}`).toBe(1)
      }
    }
  })

  it('a split day still gets several exercises for its parts', () => {
    const w = generateWorkout(['Chest', 'Triceps'], 60, { rng: mulberry32(3) })
    const c = count(w.map((p) => ex(p).group))
    expect(c.Chest).toBeGreaterThanOrEqual(2)
    expect(c.Triceps).toBeGreaterThanOrEqual(2)
  })
})
