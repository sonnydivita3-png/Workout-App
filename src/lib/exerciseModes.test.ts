import { afterEach, describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import { findExercise, useStore } from '../store'
import type { Exercise } from '../types'
import { modeOf, setChosenModes, withChosenMode } from './exerciseModes'
import { repairState } from './migrate'
import { takesWarmup } from './warmups'

const dip = BUILTIN_BY_ID.get('Dips_-_Chest_Version')!

afterEach(() => {
  setChosenModes({})
  useStore.setState({ exerciseModes: {}, logs: [], custom: [] })
})

describe('chosen exercise modes', () => {
  it('uses the library mode until the person chooses', () => {
    expect(dip.mode).toBe('weight')
    expect(withChosenMode(dip)).toBe(dip)
    setChosenModes({ [dip.id]: 'reps' })
    expect(modeOf(dip)).toBe('reps')
    const mine = withChosenMode(dip)
    expect(mine.mode).toBe('reps')
    expect(mine.name).toBe(dip.name)
    // The same copy each time, so per-exercise caches and React keep working.
    expect(withChosenMode(dip)).toBe(mine)
    // The library itself is untouched.
    expect(dip.mode).toBe('weight')
  })

  it('never changes cardio', () => {
    const run = BUILTIN_BY_ID.get('running')!
    setChosenModes({ running: 'reps' })
    expect(withChosenMode(run)).toBe(run)
  })

  it('a bodyweight choice means no warm-up sets', () => {
    const lunge = BUILTIN_BY_ID.get('Dumbbell_Lunges')!
    expect(takesWarmup(lunge)).toBe(true)
    setChosenModes({ [lunge.id]: 'reps' })
    expect(takesWarmup(lunge)).toBe(false)
  })
})

describe('setExerciseMode', () => {
  it('going bodyweight turns 0 lb sets into reps-only sets and sticks for next time', () => {
    useStore.setState({
      logs: [
        { date: '2026-10-01', exerciseId: dip.id, sets: [{ weight: 0, reps: 12 }, { weight: 25, reps: 8 }] },
        { date: '2026-10-08', exerciseId: dip.id, sets: [{ weight: 0, reps: 10, done: true }] },
        { date: '2026-10-08', exerciseId: 'Barbell_Squat', sets: [{ weight: 0, reps: 5 }] },
      ],
    })
    useStore.getState().setExerciseMode(dip.id, 'reps')
    const s = useStore.getState()
    expect(s.exerciseModes).toEqual({ [dip.id]: 'reps' })
    expect(s.logs[0].sets).toEqual([{ weight: null, reps: 12 }, { weight: 25, reps: 8 }])
    expect(s.logs[1].sets).toEqual([{ weight: null, reps: 10, done: true }])
    // Other exercises are left alone.
    expect(s.logs[2].sets).toEqual([{ weight: 0, reps: 5 }])
    expect(findExercise(s.custom, dip.id)?.mode).toBe('reps')
  })

  it('"no, it’s weighted" is remembered and changes nothing else', () => {
    const logs = [{ date: '2026-10-01', exerciseId: dip.id, sets: [{ weight: 0, reps: 12 }] }]
    useStore.setState({ logs })
    useStore.getState().setExerciseMode(dip.id, 'weight')
    expect(useStore.getState().exerciseModes).toEqual({ [dip.id]: 'weight' })
    expect(useStore.getState().logs).toBe(logs)
    expect(findExercise([], dip.id)).toBe(dip)
  })

  it('changes a custom exercise itself, so it shares the right way too', () => {
    const mine: Exercise = { id: 'custom-1', name: 'Sandbag carry squat', kind: 'strength', mode: 'weight', group: 'Quads', equipment: 'Custom', custom: true }
    useStore.setState({ custom: [mine] })
    useStore.getState().setExerciseMode(mine.id, 'reps')
    expect(useStore.getState().custom[0].mode).toBe('reps')
  })
})

describe('repairState', () => {
  it('keeps only known modes', () => {
    const fixed = repairState({ exerciseModes: { a: 'reps', b: 'weight', c: 'heavy', d: 3 } }, { exerciseModes: {} })
    expect(fixed.exerciseModes).toEqual({ a: 'reps', b: 'weight' })
    expect(repairState({ exerciseModes: [1, 2] }, { exerciseModes: {} }).exerciseModes).toEqual({})
  })
})
