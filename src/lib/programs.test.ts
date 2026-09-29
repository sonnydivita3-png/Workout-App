import { describe, expect, it } from 'vitest'
import type { ExerciseLog, PlanOverrides, Program } from '../types'
import { activePrograms, clearRange, removeProgramDays } from './programs'

const run = { exerciseId: 'running', sets: 1 }
const lift = { exerciseId: 'Barbell_Deadlift', sets: 3 }
const cardio: Program = { id: 'p', kind: 'cardio', title: 'Marathon', sport: 'run', createdAt: '', entries: ['2026-09-28', '2026-10-01', '2026-10-05'].map((date) => ({ date, exerciseId: 'running' })) }

describe('removeProgramDays', () => {
  it('removes only the run from upcoming days, keeps other exercises, and never touches the past', () => {
    const overrides: PlanOverrides = { '2026-09-28': [run], '2026-10-01': [run, lift], '2026-10-05': [run] }
    const r = removeProgramDays(cardio, overrides, [], '2026-09-30')
    expect(r.overrides['2026-09-28']).toEqual([run])
    expect(r.overrides['2026-10-01']).toEqual([lift])
    expect(r.overrides['2026-10-05']).toBeUndefined() // back to the weekly plan, not a rest day
    expect(r.count).toBe(2)
  })

  it('keeps days you already logged', () => {
    const logs: ExerciseLog[] = [{ date: '2026-10-01', exerciseId: 'running', cardio: { distance: 3, minutes: 30 } }]
    const r = removeProgramDays(cardio, { '2026-10-01': [run], '2026-10-05': [run] }, logs, '2026-09-30')
    expect(r.overrides['2026-10-01']).toEqual([run])
    expect(r.count).toBe(1)
  })

  it('a whole-day program (week/month) drops its overrides, including rest days', () => {
    const p: Program = { id: 'q', kind: 'program', title: 'Month', createdAt: '', entries: [{ date: '2026-10-01' }, { date: '2026-10-02' }] }
    const r = removeProgramDays(p, { '2026-10-01': [lift], '2026-10-02': [] }, [], '2026-09-30')
    expect(r.overrides).toEqual({})
    expect(r.count).toBe(2)
  })
})

describe('clearRange and activePrograms', () => {
  it('clears only dates in range without logs', () => {
    const logs: ExerciseLog[] = [{ date: '2026-10-02', exerciseId: 'Barbell_Deadlift', sets: [{ weight: 100, reps: 5 }] }]
    const r = clearRange({ '2026-09-29': [lift], '2026-10-01': [lift], '2026-10-02': [lift], '2026-10-20': [lift] }, logs, '2026-09-30', '2026-10-10')
    expect(Object.keys(r.overrides).sort()).toEqual(['2026-09-29', '2026-10-02', '2026-10-20'])
    expect(r.count).toBe(1)
  })
  it('a program is active until its last day passes', () => {
    expect(activePrograms([cardio], '2026-10-05')).toHaveLength(1)
    expect(activePrograms([cardio], '2026-10-06')).toHaveLength(0)
  })
})
