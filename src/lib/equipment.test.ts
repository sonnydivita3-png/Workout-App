import { afterEach, describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import { gearOf, hasGear, setOwnedGear, withGearFor } from './equipment'
import { generateProgram } from './program'
import { generateWorkout, liftsMinutes, swapExercise, type WorkoutStyle } from './randomizer'
import { familyOf, isIsolation, mulberry32 } from './randomUtil'

const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const ex = (id: string) => BUILTIN_BY_ID.get(id)!

afterEach(() => setOwnedGear(null))

describe('equipment', () => {
  it('knows what each exercise needs', () => {
    expect(gearOf(ex('Pushups'))).toBe('Bodyweight')
    expect(gearOf(ex('Barbell_Squat'))).toBe('Barbell')
    expect(gearOf(ex('running'))).toBe('Outdoor')
    setOwnedGear(['Dumbbell'])
    expect(hasGear(ex('Dumbbell_Bench_Press'))).toBe(true)
    expect(hasGear(ex('Barbell_Squat'))).toBe(false)
    expect(hasGear(ex('Pullups'))).toBe(true)
    expect(hasGear(ex('running'))).toBe(true)
  })

  const styles: WorkoutStyle[] = ['standard', 'strength', 'supersets', 'bodyweight', 'circuit', 'pha', 'amrap', 'emom', 'tabata', 'fortime', 'crossfit', 'hyrox']
  const focuses = [['Chest'], ['Back'], ['Shoulders'], ['Arms'], ['Legs'], ['Chest', 'Back', 'Legs'], ['Core', 'Cardio']]

  for (const [label, gear] of [['bodyweight only', []], ['dumbbells only', ['Dumbbell']]] as const) {
    it(`every generated workout sticks to ${label}`, () => {
      setOwnedGear(gear)
      let seed = 1
      for (const style of styles) {
        for (const focus of focuses) {
          const items = generateWorkout(focus, 45, { style, rng: seeded(seed++), warmup: { cardio: 5, mobility: 5, sets: true } })
          expect(items.length, `${style} ${focus}`).toBeGreaterThan(0)
          for (const p of items) expect(hasGear(ex(p.exerciseId)), `${style} ${focus}: ${p.exerciseId}`).toBe(true)
        }
      }
    })
  }

  it('dumbbell-only lifting workouts still fill the time', () => {
    setOwnedGear(['Dumbbell'])
    for (const focus of [['Chest'], ['Legs'], ['Chest', 'Back']]) {
      const items = generateWorkout(focus, 45, { style: 'standard', rng: seeded(7) })
      expect(liftsMinutes(items), focus.join()).toBeGreaterThan(45 * 0.8)
    }
  })

  it('re-files no-equipment moves the library calls "Other" as bodyweight', () => {
    expect(gearOf(ex('Mountain_Climbers'))).toBe('Bodyweight')
    expect(gearOf(ex('Parallel_Bar_Dip'))).toBe('Other')
  })

  it('plans and swaps respect it too', () => {
    setOwnedGear([])
    const days = generateProgram({ anchorMonday: '2026-09-28', weeks: 2, trainWeekdays: [0, 2, 4], goal: 'muscle', minutes: 45, rng: seeded(3) })
    for (const p of days.flatMap((d) => d.items)) expect(hasGear(ex(p.exerciseId)), p.exerciseId).toBe(true)
    const items = generateWorkout(['Chest'], 30, { style: 'bodyweight', rng: seeded(5) })
    for (let i = 0; i < 10; i++) {
      const swapped = swapExercise(items, 0, seeded(100 + i))
      expect(hasGear(ex(swapped[0].exerciseId))).toBe(true)
    }
  })
})

describe('equipment for one workout', () => {
  it('withGearFor uses the given gear, then puts the profile back', () => {
    setOwnedGear(['Dumbbell'])
    const w = withGearFor([], () => generateWorkout(['Chest', 'Back', 'Legs'], 45, { style: 'standard', rng: mulberry32(3) }))
    for (const p of w) expect(['Bodyweight', 'Outdoor'], p.exerciseId).toContain(gearOf(BUILTIN_BY_ID.get(p.exerciseId)!))
    expect(() => withGearFor(null, () => { throw new Error('x') })).toThrow()
    const barbell = [...BUILTIN_BY_ID.values()].find((e) => gearOf(e) === 'Barbell')!
    expect(hasGear(barbell)).toBe(false) // back to dumbbells only
  })
})

describe('full-body workouts with a full gym', () => {
  it('cover a squat or hinge, a press, a pull and an overhead press, with no movement three times', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = generateWorkout(['Legs', 'Chest', 'Back', 'Shoulders', 'Arms', 'Core'], 75, { style: 'standard', rng: mulberry32(seed) })
      const names = w.map((p) => BUILTIN_BY_ID.get(p.exerciseId)!.name)
      const label = `seed ${seed}: ${names.join(', ')}`
      expect(names.some((n) => /squat|deadlift|leg press|lunge/i.test(n)), label).toBe(true)
      expect(names.some((n) => /bench press|press|dip|push-?up/i.test(n)), label).toBe(true)
      expect(names.some((n) => /row|pull-?up|chin-?up|pulldown/i.test(n)), label).toBe(true)
      expect(names.some((n) => /overhead press|shoulder press|military press|push press|arnold/i.test(n)), label).toBe(true)
      const count = new Map<string, number>()
      for (const p of w) { const f = familyOf(BUILTIN_BY_ID.get(p.exerciseId)!); if (f) count.set(f, (count.get(f) ?? 0) + 1) }
      for (const [f, n] of count) expect(n, `${f} in ${label}`).toBeLessThanOrEqual(2)
      // The first exercise is a big compound lift, not an isolation move.
      expect(isIsolation(BUILTIN_BY_ID.get(w[0].exerciseId)!), label).toBe(false)
    }
  })
})
