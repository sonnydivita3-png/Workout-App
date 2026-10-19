import { describe, expect, it } from 'vitest'
import type { ExerciseLog, PlanOverrides, Program } from '../types'
import { useStore } from '../store'
import type { CardioDay } from './cardioPlan'
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

  it('an older whole-day program (week/month) drops its overrides, including rest days', () => {
    const p: Program = { id: 'q', kind: 'program', title: 'Month', createdAt: '', entries: [{ date: '2026-10-01' }, { date: '2026-10-02' }] }
    const r = removeProgramDays(p, { '2026-10-01': [lift], '2026-10-02': [] }, [], '2026-09-30')
    expect(r.overrides).toEqual({})
    expect(r.count).toBe(2)
  })
})

describe('a lifting plan on top of a run plan', () => {
  const day = (date: string) => useStore.getState().overrides[date]
  const ids = (date: string) => day(date)?.map((x) => x.exerciseId)
  const squat = { exerciseId: 'Barbell_Squat', sets: 3 }
  const bench = { exerciseId: 'Barbell_Bench_Press', sets: 3 }
  const cardioDays = (dates: string[]) => dates.map((date) => ({ date, weekIndex: 0, role: 'easy', title: 'Easy', note: '', minutes: 30 })) as CardioDay[]
  const reset = () => useStore.setState({ overrides: {}, programs: [], logs: [] })
  const today = '2026-10-05'

  it('keeps the runs on its lifting days and its rest days', () => {
    reset()
    useStore.getState().startCardioProgram({ sessions: cardioDays(['2026-10-05', '2026-10-06', '2026-10-08']), sport: 'run', title: '10K plan', replace: false, stopSame: true, today })
    useStore.getState().startProgram({ '2026-10-05': [lift], '2026-10-06': [], '2026-10-07': [squat] }, 'Month plan', today)
    expect(ids('2026-10-05')).toEqual(['Barbell_Deadlift', 'running'])
    expect(ids('2026-10-06')).toEqual(['running']) // the lifting rest day keeps its run
    expect(ids('2026-10-07')).toEqual(['Barbell_Squat'])
    expect(ids('2026-10-08')).toEqual(['running'])
    expect(useStore.getState().programs.map((p) => p.title)).toEqual(['10K plan', 'Month plan'])
  })

  it('a new lifting plan replaces the old one but not the runs', () => {
    useStore.getState().startProgram({ '2026-10-05': [bench], '2026-10-07': [] }, 'Week plan', today)
    expect(ids('2026-10-05')).toEqual(['Barbell_Bench_Press', 'running'])
    expect(ids('2026-10-06')).toEqual(['running'])
    expect(day('2026-10-07')).toEqual([])
    expect(useStore.getState().programs.map((p) => p.title)).toEqual(['10K plan', 'Week plan'])
  })

  it('stopping either plan leaves the other', () => {
    const [run10k, week] = useStore.getState().programs
    expect(useStore.getState().stopProgram(week.id, today)).toBe(2)
    expect(ids('2026-10-05')).toEqual(['running'])
    expect(day('2026-10-07')).toBeUndefined() // back to the weekly plan
    useStore.getState().startProgram({ '2026-10-05': [bench], '2026-10-06': [] }, 'Week plan', today)
    expect(useStore.getState().stopProgram(run10k.id, today)).toBe(3)
    expect(ids('2026-10-05')).toEqual(['Barbell_Bench_Press'])
    expect(day('2026-10-06')).toEqual([]) // still the lifting plan's rest day
    expect(day('2026-10-08')).toBeUndefined()
  })

  it('a run plan added after a lifting plan sits alongside it, and a stop keeps a day already logged', () => {
    reset()
    useStore.getState().startProgram({ '2026-10-05': [lift, squat], '2026-10-06': [] }, 'Month plan', today)
    useStore.getState().startCardioProgram({ sessions: cardioDays(['2026-10-05', '2026-10-06']), sport: 'run', title: '10K plan', replace: false, stopSame: true, today })
    expect(ids('2026-10-05')).toEqual(['Barbell_Deadlift', 'Barbell_Squat', 'running'])
    useStore.setState({ logs: [{ date: '2026-10-05', exerciseId: 'running', cardio: { distance: 3, minutes: 30 } }] })
    const month = useStore.getState().programs[0]
    expect(useStore.getState().stopProgram(month.id, today)).toBe(1)
    expect(ids('2026-10-05')).toEqual(['running']) // the run was logged, the lifts weren't
    expect(ids('2026-10-06')).toEqual(['running'])
  })

  it('an older whole-day entry keeps what another plan put on that day', () => {
    const p: Program = { id: 'q', kind: 'program', title: 'Month', createdAt: '', entries: [{ date: '2026-10-01' }] }
    const r = removeProgramDays(p, { '2026-10-01': [lift, run] }, [], '2026-09-30', [cardio])
    expect(r.overrides['2026-10-01']).toEqual([run])
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

describe('deleteLogs', () => {
  it('removes one session or all sessions of an exercise, nothing else', async () => {
    const { useStore } = await import('../store')
    const set = (l: ExerciseLog[]) => useStore.setState({ logs: l })
    const mk = (date: string, exerciseId: string): ExerciseLog => ({ date, exerciseId, sets: [{ weight: 100, reps: 5 }] })
    set([mk('2026-09-01', 'a'), mk('2026-09-02', 'a'), mk('2026-09-02', 'b')])
    useStore.getState().deleteLogs('a', '2026-09-01')
    expect(useStore.getState().logs.map((l) => l.date + l.exerciseId)).toEqual(['2026-09-02a', '2026-09-02b'])
    useStore.getState().deleteLogs('a')
    expect(useStore.getState().logs.map((l) => l.exerciseId)).toEqual(['b'])
  })
})
