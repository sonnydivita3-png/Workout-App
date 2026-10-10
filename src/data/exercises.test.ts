import { describe, expect, it } from 'vitest'
import { gearOf } from '../lib/equipment'
import { ALL_EXERCISES, BUILTIN_BY_ID, EXERCISES } from './exercises'

describe('the exercise library', () => {
  it('offers 500 everyday exercises, each name once', () => {
    expect(EXERCISES).toHaveLength(500)
    expect(EXERCISES.some((e) => e.retired)).toBe(false)
    const names = EXERCISES.map((e) => e.name.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })

  it('keeps retired exercises known, so old logs and plans still show their names', () => {
    for (const id of ['Atlas_Stones', 'Tire_Flip', 'Bench_Press_-_Powerlifting', 'x-air-squat']) {
      expect(BUILTIN_BY_ID.get(id)?.retired, id).toBe(true)
      expect(EXERCISES.some((e) => e.id === id), id).toBe(false)
    }
    expect(ALL_EXERCISES.length).toBeGreaterThan(EXERCISES.length)
  })

  it('keeps the everyday lifts', () => {
    for (const name of ['Back Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'Pull-Up', 'Push-Up', 'Lat Pulldown', 'Leg Press', 'Romanian Deadlift', 'Hip Thrust', 'Plank', 'Dumbbell Curl', 'Triceps Pushdown', 'Calf Raise', 'Goblet Squat', 'Kettlebell Swing', 'Face Pull', 'Pec Deck', 'Side Plank', 'Glute Bridge'])
      expect(EXERCISES.some((e) => e.name === name), name).toBe(true)
  })

  it('files equipment consistently: bars and benches are bodyweight, specialist kit is "Other"', () => {
    const g = (id: string) => gearOf(BUILTIN_BY_ID.get(id)!)
    expect(g('Pullups')).toBe('Bodyweight')
    expect(g('Dips_-_Chest_Version')).toBe('Bodyweight')
    expect(g('Knee_Hip_Raise_On_Parallel_Bars')).toBe('Bodyweight')
    expect(g('Ring_Dips')).toBe('Other')
    expect(g('Hyperextensions_Back_Extensions')).toBe('Machine')
    expect(g('Band_Assisted_Pull-Up')).toBe('Bands')
    expect(g('Trap_Bar_Deadlift')).toBe('Barbell')
    expect(BUILTIN_BY_ID.get('Close-Grip_EZ_Bar_Curl')!.equipment).toBe('EZ bar')
    expect(BUILTIN_BY_ID.get('Mountain_Climbers')!.group).toBe('Core')
    expect(BUILTIN_BY_ID.get('Flutter_Kicks')!.group).toBe('Core')
  })
})
