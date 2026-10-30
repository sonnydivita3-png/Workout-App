import { afterEach, describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import { findExercise, useStore } from '../store'
import type { Exercise } from '../types'
import { modeOf, needsGear, setChosenModes, timedWithWeight, withChosenMode } from './exerciseModes'
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

describe('timed sets', () => {
  it('log a weight with free weights, cables and machines, not with bodyweight or a rowing erg', () => {
    const ex = (id: string) => BUILTIN_BY_ID.get(id)!
    expect(timedWithWeight(ex('x-farmers-carry'))).toBe(true)
    expect(timedWithWeight(ex('Dumbbell_Bicep_Curl'))).toBe(true)
    expect(timedWithWeight(ex('Leg_Extensions'))).toBe(true)
    expect(timedWithWeight(ex('Plank'))).toBe(false)
    expect(timedWithWeight(ex('x-row-erg'))).toBe(false)
    expect(timedWithWeight(ex('Lateral_Bound'))).toBe(false)
  })
})

describe('repairState', () => {
  it('keeps only known modes', () => {
    const fixed = repairState({ exerciseModes: { a: 'reps', b: 'weight', c: 'heavy', d: 3 } }, { exerciseModes: {} })
    expect(fixed.exerciseModes).toEqual({ a: 'reps', b: 'weight' })
    expect(repairState({ exerciseModes: [1, 2] }, { exerciseModes: {} }).exerciseModes).toEqual({})
  })
})

describe('what adds the weight to a bodyweight move made weighted', () => {
  const pullup = BUILTIN_BY_ID.get('Pullups')!
  afterEach(() => useStore.setState({ exerciseGear: {} }))

  it('asks only for bodyweight moves, and files the answer under that equipment while it is weighted', () => {
    expect(pullup.equipment).toBe('Bodyweight')
    expect(needsGear(pullup)).toBe(true)
    expect(needsGear(BUILTIN_BY_ID.get('Dumbbell_Lunges')!)).toBe(false)
    useStore.getState().setExerciseMode(pullup.id, 'weight')
    useStore.getState().setExerciseGear(pullup.id, 'Cable')
    const e = findExercise([], pullup.id)!
    expect(e).toMatchObject({ mode: 'weight', equipment: 'Cable' })
    expect(needsGear(pullup)).toBe(false)
    // The library itself is untouched.
    expect(pullup.equipment).toBe('Bodyweight')
    // Back to bodyweight: back under bodyweight, and the answer is forgotten.
    useStore.getState().setExerciseMode(pullup.id, 'reps')
    expect(findExercise([], pullup.id)!.equipment).toBe('Bodyweight')
    expect(useStore.getState().exerciseGear).toEqual({})
  })
  it('their own exercise just changes its equipment', () => {
    const own: Exercise = { id: 'c-1', name: 'Ring Dip', kind: 'strength', mode: 'weight', group: 'Triceps', equipment: 'Bodyweight', custom: true }
    useStore.setState({ custom: [own] })
    useStore.getState().setExerciseGear('c-1', 'Other')
    expect(useStore.getState().custom[0].equipment).toBe('Other')
    expect(useStore.getState().exerciseGear).toEqual({})
  })
  it('a restored backup keeps only real answers', () => {
    const fixed = repairState({ exerciseGear: { Pullups: 'Dumbbell', Bench_Dips: 'Rocket', Dips: 5, __proto__: 'Machine' } }, { exerciseGear: {} as Record<string, string>, logs: [] as unknown[] })
    expect(fixed.exerciseGear).toEqual({ Pullups: 'Dumbbell' })
  })
})
