import { afterEach, describe, expect, it } from 'vitest'
import { findExercise, useStore } from '../store'
import type { Exercise } from '../types'
import { customDetail, customFields, defaultMode, findDuplicate, usageOf } from './customExercises'
import { setChosenModes } from './exerciseModes'

const store = () => useStore.getState()
const data = () => store() as unknown as Record<string, unknown>

afterEach(() => {
  setChosenModes({})
  useStore.setState({ custom: [], logs: [], favorites: [], exerciseModes: {}, overrides: {}, routines: [], goals: [] })
})

describe('making your own exercise', () => {
  it('saves the name, body part, equipment and how it is logged', () => {
    const e = store().createCustom({ name: '  Landmine   Press ', group: 'Shoulders', equipment: 'Barbell', mode: 'weight' })
    expect(e).toMatchObject({ name: 'Landmine Press', kind: 'strength', mode: 'weight', group: 'Shoulders', equipment: 'Barbell', custom: true })
    expect(e.id).toMatch(/^custom-/)
    expect(store().custom).toEqual([e])
    expect(findExercise(store().custom, e.id)).toEqual(e)
    expect(customDetail(e)).toBe('Shoulders · Barbell · weight × reps')
  })

  it('logs bodyweight moves as reps and stretches by time unless told otherwise; Cardio makes a cardio exercise', () => {
    expect(defaultMode('Hamstrings', 'Bodyweight')).toBe('reps')
    expect(defaultMode('Mobility', 'Other')).toBe('time')
    expect(defaultMode('Chest', 'Dumbbell')).toBe('weight')
    expect(customFields({ name: 'Nordic curl band', group: 'Hamstrings', equipment: 'Bodyweight' }).mode).toBe('reps')
    const logs = store().logs
    expect(store().createCustom({ name: 'Nordic curl band', group: 'Hamstrings', equipment: 'Bodyweight' }).mode).toBe('reps')
    expect(store().logs).toBe(logs) // nothing logged with it yet, so the log is left alone
    const bike = store().createCustom({ name: 'Assault bike', group: 'Cardio', equipment: 'Machine', mode: 'weight' })
    expect(bike).toMatchObject({ kind: 'cardio', mode: undefined, group: 'Cardio', equipment: 'Machine' })
    expect(customDetail(bike)).toBe('Cardio · Machine · time and distance')
    // Anything unexpected is put right rather than saved as is.
    expect(customFields({ name: ' ', group: 'Wings', equipment: 'Rocket' })).toMatchObject({ name: 'My exercise', group: 'Other', equipment: 'Other', kind: 'strength' })
    expect(customFields({ name: 'Rowing', group: 'Cardio', equipment: 'Bodyweight' }).equipment).toBe('Other')
  })

  it('gives each one its own id, even when made at the same moment', () => {
    const a = store().createCustom({ name: 'One', group: 'Core', equipment: 'Other' })
    const b = store().createCustom({ name: 'Two', group: 'Core', equipment: 'Other' })
    expect(a.id).not.toBe(b.id)
  })

  it('spots a name already in the list: the library (short or full name) or one of yours', () => {
    expect(findDuplicate('bench press', [])?.id).toBe('Barbell_Bench_Press_-_Medium_Grip')
    expect(findDuplicate('Barbell Bench Press - Medium Grip', [])?.name).toBe('Bench Press')
    expect(findDuplicate('Lateral  raise', [])?.name).toBe('Lateral Raise')
    expect(findDuplicate('Farmers carry', [])?.name).toBe("Farmer's Carry")
    expect(findDuplicate('zercher squat', [])?.name).toBe('Zercher Squats')
    expect(findDuplicate('pushups', [])?.name).toBe('Push-Up')
    expect(findDuplicate('Bench', [])).toBeUndefined()
    const mine: Exercise = { id: 'custom-a', name: 'Landmine Press', kind: 'strength', group: 'Shoulders', custom: true }
    expect(findDuplicate('landmine-press', [mine])).toBe(mine)
    // Not itself while being edited, not one they deleted, and not an empty name.
    expect(findDuplicate('Landmine Press', [mine], mine.id)).toBeUndefined()
    expect(findDuplicate('Landmine Press', [{ ...mine, retired: true }])).toBeUndefined()
    expect(findDuplicate('  ', [])).toBeUndefined()
  })
})

describe('changing and deleting your own exercises', () => {
  it('changes the name, body part, equipment and logging, and the form beats an earlier ⋯ choice', () => {
    const e = store().createCustom({ name: 'Sandbag squat', group: 'Quads', equipment: 'Other', mode: 'weight' })
    useStore.setState({
      exerciseModes: { [e.id]: 'weight' },
      logs: [{ date: '2026-10-01', exerciseId: e.id, sets: [{ weight: 0, reps: 10 }, { weight: 60, reps: 8 }] }],
    })
    const changed = store().updateCustom(e.id, { name: 'Sandbag Zercher squat', group: 'Glutes', equipment: 'Bodyweight', mode: 'reps' })
    expect(changed).toMatchObject({ id: e.id, name: 'Sandbag Zercher squat', group: 'Glutes', equipment: 'Bodyweight', mode: 'reps' })
    expect(store().exerciseModes).toEqual({})
    expect(findExercise(store().custom, e.id)?.mode).toBe('reps')
    // As when choosing bodyweight from the card: 0 lb sets become reps only.
    expect(store().logs[0].sets).toEqual([{ weight: null, reps: 10 }, { weight: 60, reps: 8 }])
  })

  it('stays lifting (or cardio) once it is logged or planned', () => {
    const e = store().createCustom({ name: 'Prowler', group: 'Conditioning', equipment: 'Other', mode: 'time' })
    expect(store().updateCustom(e.id, { name: 'Prowler', group: 'Cardio', equipment: 'Other' })?.kind).toBe('cardio')
    store().updateCustom(e.id, { name: 'Prowler', group: 'Conditioning', equipment: 'Other', mode: 'time' })
    useStore.setState({ overrides: { '2026-10-12': [{ exerciseId: e.id, sets: 3, seconds: 30 }] } })
    expect(usageOf(data(), e.id)).toEqual({ days: 0, used: true })
    expect(store().updateCustom(e.id, { name: 'Prowler run', group: 'Cardio', equipment: 'Other' })).toMatchObject({ kind: 'strength', name: 'Prowler' })
    expect(store().updateCustom(e.id, { name: 'Prowler push', group: 'Quads', equipment: 'Other', mode: 'time' })?.name).toBe('Prowler push')
  })

  it('deleting one nothing uses removes it completely', () => {
    const e = store().createCustom({ name: 'Typo pres', group: 'Chest', equipment: 'Barbell' })
    useStore.setState({ favorites: [e.id, 'Hammer_Curls'], exerciseModes: { [e.id]: 'reps' } })
    expect(usageOf(data(), e.id)).toEqual({ days: 0, used: false })
    store().removeCustom(e.id)
    expect(store().custom).toEqual([])
    expect(store().favorites).toEqual(['Hammer_Curls'])
    expect(store().exerciseModes).toEqual({})
  })

  it('deleting one you have logged only hides it, so history keeps its name; making it again brings it back', () => {
    const e = store().createCustom({ name: 'Sandbag Zercher carry', group: 'Quads', equipment: 'Other' })
    useStore.setState({
      favorites: [e.id],
      logs: [
        { date: '2026-10-01', exerciseId: e.id, sets: [{ weight: 135, reps: 8 }] },
        { date: '2026-10-05', exerciseId: e.id, sets: [{ weight: 145, reps: 6 }] },
      ],
    })
    expect(usageOf(data(), e.id)).toEqual({ days: 2, used: true })
    store().removeCustom(e.id)
    expect(store().custom).toEqual([{ ...e, retired: true }])
    expect(store().favorites).toEqual([])
    expect(findExercise(store().custom, e.id)?.name).toBe('Sandbag Zercher carry')
    expect(findDuplicate('Sandbag Zercher carry', store().custom)).toBeUndefined()
    // The same name again (any case): the old one returns with the new details, and its history with it.
    const again = store().createCustom({ name: 'sandbag zercher carry', group: 'Glutes', equipment: 'Other' })
    expect(again.id).toBe(e.id)
    expect(again.retired).toBeUndefined()
    expect(store().custom).toHaveLength(1)
    expect(store().custom[0]).toMatchObject({ id: e.id, name: 'sandbag zercher carry', group: 'Glutes' })
  })
})
