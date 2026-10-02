import { afterEach, describe, expect, it } from 'vitest'
import { setOwnedGear } from './equipment'
import { BY_ID } from './randomUtil'
import { stationOf, staysPut, walkCost } from './stations'

const ex = (id: string) => {
  const e = BY_ID.get(id)
  if (!e) throw new Error(id)
  return e
}

afterEach(() => setOwnedGear(null))

describe('where exercises are done in a gym', () => {
  it('knows the station for everyday lifts', () => {
    expect(stationOf(ex('Barbell_Full_Squat'))).toBe('rack')
    expect(stationOf(ex('Barbell_Bench_Press_-_Medium_Grip'))).toBe('bench')
    expect(stationOf(ex('Bent_Over_Barbell_Row'))).toBe('platform')
    expect(stationOf(ex('Triceps_Pushdown'))).toBe('cable')
    expect(stationOf(ex('Leg_Extensions'))).toBe(stationOf(ex('Lying_Leg_Curls')))
    expect(stationOf(ex('Pullups'))).toBe('pullup')
    expect(stationOf(ex('Plank'))).toBe('floor')
    expect(stationOf(ex('Dumbbell_Bench_Press'))).toBe('dumbbells')
  })

  it('same station or a floor move: no walking; dumbbells carried over: a little; across the gym: a lot', () => {
    expect(walkCost(ex('Triceps_Pushdown'), ex('Standing_Biceps_Cable_Curl'))).toBe(0)
    expect(walkCost(ex('Leg_Extensions'), ex('Lying_Leg_Curls'))).toBe(0)
    expect(walkCost(ex('Romanian_Deadlift'), ex('Bent_Over_Barbell_Row'))).toBe(0)
    expect(walkCost(ex('Barbell_Full_Squat'), ex('Plank'))).toBe(0)
    expect(walkCost(ex('Dumbbell_Bench_Press'), ex('Seated_Cable_Rows'))).toBe(1)
    expect(walkCost(ex('Barbell_Full_Squat'), ex('Pullups'))).toBe(1)
    expect(walkCost(ex('Leg_Press'), ex('Wide-Grip_Lat_Pulldown'))).toBe(3)
    expect(walkCost(ex('Machine_Bench_Press'), ex('Seated_Cable_Rows'))).toBe(3)
  })

  it('a home gym (no machines or cables) is one setup: rack, bench and bar together', () => {
    expect(walkCost(ex('Barbell_Full_Squat'), ex('Barbell_Bench_Press_-_Medium_Grip'))).toBe(1)
    setOwnedGear(['Barbell', 'Dumbbell', 'Other'])
    expect(walkCost(ex('Barbell_Full_Squat'), ex('Barbell_Bench_Press_-_Medium_Grip'))).toBe(0)
  })

  it('a circuit stays in one area: portable gear plus one fixed station', () => {
    const picked = [ex('Dumbbell_Bench_Press'), ex('Triceps_Pushdown')]
    expect(staysPut(picked, ex('Plank'))).toBe(true)
    expect(staysPut(picked, ex('Seated_Cable_Rows'))).toBe(true)
    expect(staysPut(picked, ex('Leg_Press'))).toBe(false)
  })
})
