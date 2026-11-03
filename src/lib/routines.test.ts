import { afterEach, describe, expect, it } from 'vitest'
import { useStore } from '../store'
import { groupByBlock } from './describe'
import type { PlannedExercise } from '../types'

const BP = 'Barbell_Bench_Press_-_Medium_Grip'
const empty = () => Array.from({ length: 7 }, () => [] as PlannedExercise[])
afterEach(() => useStore.setState({ plan: empty(), overrides: {}, routines: [], programs: [], logs: [] }))

describe('a plan day made your own', () => {
  // Week 4 of a month plan: a lighter deload week, tagged with the plan that put it there.
  const deload: PlannedExercise[] = [
    { exerciseId: BP, sets: 2, reps: 8, deload: true, plan: 'pr-1', keepSets: true },
    { exerciseId: 'Barbell_Squat', sets: 2, reps: 5, deload: true, plan: 'pr-1' },
  ]
  const plain = [{ exerciseId: BP, sets: 2, reps: 8 }, { exerciseId: 'Barbell_Squat', sets: 2, reps: 5 }]
  const strip = (items: PlannedExercise[]) => items.map(({ warmupSets: _w, ...p }) => p)

  it('saved as a routine is a normal workout wherever it is loaded, not that plan’s deload', () => {
    useStore.setState({ overrides: { '2026-10-26': deload } })
    useStore.getState().saveRoutine('Push', deload)
    const [r] = useStore.getState().routines
    expect(r.items).toEqual(plain)
    useStore.getState().loadRoutine('2026-11-09', r.id)
    expect(strip(useStore.getState().overrides['2026-11-09'])).toEqual(plain)
  })

  it('a routine saved before is cleaned up when it is loaded', () => {
    useStore.setState({ routines: [{ id: 'r1', name: 'Old', items: deload }] })
    useStore.getState().loadRoutine('2026-11-09', 'r1')
    expect(strip(useStore.getState().overrides['2026-11-09'])).toEqual(plain)
  })

  it('repeated every week, it is the usual week, not a deload week every week', () => {
    useStore.setState({ overrides: { '2026-10-26': deload } }) // a Monday
    useStore.getState().setUsualDay('2026-10-26')
    expect(strip(useStore.getState().plan[0])).toEqual(plain)
  })
})

describe('a routine with a superset loaded onto a day with one', () => {
  it('stays its own superset instead of joining the day’s into one giant set', () => {
    const ss = (exerciseId: string): PlannedExercise => ({ exerciseId, sets: 3, reps: 10, block: 'ss1', blockLabel: 'Superset 1' })
    useStore.setState({ overrides: { '2026-11-09': [ss(BP), ss('Bent_Over_Barbell_Row')] }, routines: [{ id: 'r', name: 'Arms', items: [ss('Dumbbell_Bicep_Curl'), ss('Triceps_Pushdown')] }] })
    useStore.getState().loadRoutine('2026-11-09', 'r')
    expect(groupByBlock(useStore.getState().overrides['2026-11-09']).map((g) => g.items.length)).toEqual([2, 2])
  })
})
