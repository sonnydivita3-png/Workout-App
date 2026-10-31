import { describe, expect, it } from 'vitest'
import { gearOf } from '../lib/equipment'
import { ALL_EXERCISES, BUILTIN_BY_ID, EXERCISES } from './exercises'

describe('the exercise library', () => {
  it('offers everyday exercises (the 500 kept from the dataset, plus ones added for plans), each name once', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(500)
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

describe('suspension, medicine ball and other functional kit', () => {
  it('is in the library under its own equipment, ready for functional workouts', async () => {
    const { familyOf } = await import('../lib/randomUtil')
    const { takesWarmup } = await import('../lib/warmups')
    const { stationOf } = await import('../lib/stations')
    const kit = ['Suspension (TRX)', 'Medicine ball', 'Battle rope', 'Sandbag', 'Rings', 'Sliders', 'Exercise ball']
    const by = (eq: string) => EXERCISES.filter((e) => e.equipment === eq)
    expect(by('Suspension (TRX)').length).toBeGreaterThanOrEqual(20)
    expect(by('Medicine ball').length).toBeGreaterThanOrEqual(10)
    for (const eq of kit) for (const e of by(eq)) {
      // One weight (or none) all session: no ramp-up sets on a ball, rope, straps…
      expect(takesWarmup(e), e.name).toBe(false)
      // …and the ones added here aren't handed out in everyday lifting workouts (functional, HIIT and the list use them).
      if (/^x-|^Suspended|^Battling/.test(e.id)) expect(e.suggest, e.name).toBe(false)
    }
    // Every one tagged for functional workouts fits one of their movement patterns.
    for (const e of EXERCISES.filter((x) => x.tags?.includes('functional') && kit.includes(x.equipment ?? ''))) expect(familyOf(e), e.name).toBeTruthy()
    // Straps and rings hang from an anchor: a fixed spot, next to the pull-up bar.
    expect(stationOf(BUILTIN_BY_ID.get('Suspended_Row')!)).toBe('straps')
    expect(stationOf(BUILTIN_BY_ID.get('x-mb-woodchop')!)).toBe('floor')
    expect(BUILTIN_BY_ID.get('Battling_Ropes')).toMatchObject({ name: 'Battle Rope Waves', mode: 'time', group: 'Conditioning', equipment: 'Battle rope' })
  })
})
