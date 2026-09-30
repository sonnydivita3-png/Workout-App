import { afterEach, describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import { gearOf, hasGear, setOwnedGear } from './equipment'
import { generateProgram } from './program'
import { generateWorkout, liftsMinutes, swapExercise, type WorkoutStyle } from './randomizer'

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
