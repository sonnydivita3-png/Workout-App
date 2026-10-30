import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import { placeWarmups } from './warmups'

const look = (id: string) => BUILTIN_BY_ID.get(id)
const ws = (items: { exerciseId: string; warmupSets?: number }[]) => items.map((p) => p.warmupSets ?? 0)

describe('warm-up sets', () => {
  it('stay with the first two weight lifts when the day is reordered', () => {
    const day = [
      { exerciseId: 'Barbell_Squat', sets: 3, warmupSets: 3 },
      { exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', sets: 3, warmupSets: 2 },
      { exerciseId: 'Dumbbell_Bicep_Curl', sets: 3 },
    ]
    expect(ws(placeWarmups(day, look))).toEqual([3, 2, 0])
    expect(ws(placeWarmups([day[2], day[0], day[1]], look))).toEqual([3, 2, 0]) // curl moved first gets them
  })

  it('never go on bodyweight moves or core', () => {
    const day = [
      { exerciseId: 'Pushups', sets: 3 },
      { exerciseId: 'Plank', sets: 3 },
      { exerciseId: 'Cable_Crunch', sets: 3, warmupSets: 2 },
      { exerciseId: 'Barbell_Squat', sets: 3 },
      { exerciseId: 'Bent_Over_Barbell_Row', sets: 3 },
    ]
    expect(ws(placeWarmups(day, look))).toEqual([0, 0, 0, 2, 1])
  })

  it('leave days without warm-ups alone', () => {
    const day = [{ exerciseId: 'Barbell_Squat', sets: 3 }]
    expect(placeWarmups(day, look)).toBe(day)
  })
})

describe('drop sets in generated workouts', () => {
  const day = (...ids: string[]) => ids.map((exerciseId) => ({ exerciseId, sets: 3 }))
  const dropped = (items: { exerciseId: string; dropSets?: number }[]) => items.filter((p) => p.dropSets).map((p) => p.exerciseId)

  it('rank lifts by how safe they are to take to failure: machines, cables, Smith, dumbbells; never a barbell or balance lift', async () => {
    const { dropSafety } = await import('./warmups')
    const safety = (id: string) => dropSafety(look(id))
    expect(safety('Leg_Press')).toBeGreaterThan(safety('Triceps_Pushdown'))
    expect(safety('Triceps_Pushdown')).toBeGreaterThan(safety('Smith_Machine_Bench_Press'))
    expect(safety('Smith_Machine_Bench_Press')).toBeGreaterThan(safety('Dumbbell_Bicep_Curl'))
    expect(safety('Dumbbell_Bicep_Curl')).toBeGreaterThan(0)
    for (const id of ['Barbell_Squat', 'Barbell_Bench_Press_-_Medium_Grip', 'Smith_Machine_Squat', 'Goblet_Squat', 'Pushups', 'Cable_Crunch']) expect(safety(id), id).toBe(0)
  })
  it('go on the biggest muscles, never two lifts for the same or overlapping muscles, machines and cables first', async () => {
    const { addDropSets } = await import('./warmups')
    // Not the last two (a curl and a pushdown): leg press and lat pulldown.
    expect(dropped(addDropSets(day('Barbell_Squat', 'Leg_Press', 'Wide-Grip_Lat_Pulldown', 'Leverage_Chest_Press', 'Dumbbell_Bicep_Curl', 'Triceps_Pushdown'), look))).toEqual(['Leg_Press', 'Wide-Grip_Lat_Pulldown'])
    // An upper day: chest press and pulldown, not chest press and shoulder press (both pressing).
    expect(dropped(addDropSets(day('Barbell_Bench_Press_-_Medium_Grip', 'Leverage_Chest_Press', 'Leverage_Shoulder_Press', 'Wide-Grip_Lat_Pulldown', 'Triceps_Pushdown'), look))).toEqual(['Leverage_Chest_Press', 'Wide-Grip_Lat_Pulldown'])
    // Leg day: one quad lift (the compound) and the hamstrings, never two quad lifts.
    expect(dropped(addDropSets(day('Barbell_Squat', 'Leg_Press', 'Leg_Extensions', 'Seated_Leg_Curl'), look))).toEqual(['Leg_Press', 'Seated_Leg_Curl'])
    // A push day has only overlapping groups: still two different ones.
    expect(dropped(addDropSets(day('Barbell_Bench_Press_-_Medium_Grip', 'Leverage_Chest_Press', 'Leverage_Shoulder_Press', 'Triceps_Pushdown'), look))).toEqual(['Leverage_Chest_Press', 'Leverage_Shoulder_Press'])
    // Dumbbells only when nothing safer; nothing at all for barbell, bodyweight and core.
    expect(dropped(addDropSets(day('Barbell_Squat', 'Dumbbell_Bench_Press', 'One-Arm_Dumbbell_Row'), look))).toEqual(['Dumbbell_Bench_Press', 'One-Arm_Dumbbell_Row'])
    expect(dropped(addDropSets(day('Barbell_Squat', 'Barbell_Bench_Press_-_Medium_Grip', 'Pushups', 'Cable_Crunch'), look))).toEqual([])
  })
  it('come with the randomizer option, on safe lifts for two different big muscles, and still fit the time', async () => {
    const { generateWorkout, liftsMinutes } = await import('./randomizer')
    const { mulberry32 } = await import('./randomUtil')
    const { dropSafety } = await import('./warmups')
    const focuses = [['Chest', 'Back', 'Biceps', 'Triceps'], ['Quads', 'Chest', 'Back', 'Hamstrings', 'Shoulders', 'Biceps', 'Triceps'], ['Quads', 'Hamstrings', 'Glutes', 'Calves'], ['Chest', 'Shoulders', 'Triceps']]
    for (const focus of focuses) for (let seed = 1; seed <= 10; seed++) {
      const plain = generateWorkout(focus, 60, { rng: mulberry32(seed) })
      const w = generateWorkout(focus, 60, { rng: mulberry32(seed), dropSets: true })
      const drops = w.filter((p) => p.dropSets).map((p) => look(p.exerciseId)!)
      const at = `${focus.join('/')} seed ${seed}`
      expect(drops.length, at).toBe(2)
      expect(new Set(drops.map((e) => e.group)).size, at).toBe(2)
      for (const e of drops) expect(dropSafety(e), `${at}: ${e.name}`).toBeGreaterThanOrEqual(3)
      // The day's main lift is never swapped for a machine.
      expect(w.find((p) => !p.warmup)?.exerciseId, at).toBe(plain.find((p) => !p.warmup)?.exerciseId)
      expect(liftsMinutes(w)).toBeLessThanOrEqual(66)
      expect(liftsMinutes(w)).toBeGreaterThanOrEqual(51)
    }
  })
  it('use dumbbells in a home gym without machines, and skip drop sets rather than use a barbell', async () => {
    const { generateWorkout } = await import('./randomizer')
    const { mulberry32 } = await import('./randomUtil')
    const { setOwnedGear } = await import('./equipment')
    try {
      setOwnedGear(['Barbell', 'Dumbbell'])
      const w = generateWorkout(['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'], 60, { rng: mulberry32(3), dropSets: true })
      const drops = w.filter((p) => p.dropSets).map((p) => look(p.exerciseId)!)
      expect(drops.length).toBe(2)
      expect(drops.every((e) => e.equipment === 'Dumbbell')).toBe(true)
      setOwnedGear(['Barbell'])
      expect(generateWorkout(['Chest', 'Back', 'Quads'], 60, { rng: mulberry32(3), dropSets: true }).some((p) => p.dropSets)).toBe(false)
    } finally {
      setOwnedGear(null)
    }
  })
})
