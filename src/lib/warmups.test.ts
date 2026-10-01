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
