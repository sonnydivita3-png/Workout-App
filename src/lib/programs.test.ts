import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ExerciseLog, PlanOverrides, Program } from '../types'
import { useStore } from '../store'
import type { CardioDay } from './cardioPlan'
import { activePrograms, clearRange, removeProgramDays, sharedDays } from './programs'

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
  const reset = () => useStore.setState((s) => ({ overrides: {}, programs: [], logs: [], trainingPrefs: { ...s.trainingPrefs, stackOrder: undefined } }))
  // Plans added in the same millisecond (a fast machine) must still be told apart.
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-05T12:00:00Z')) })
  afterAll(() => vi.useRealTimers())
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

  // What broke for a tester: a mileage plan, then a muscle month whose lifting days end with an easy-run finisher.
  const finisher = { exerciseId: 'running', sets: 1, minutes: 15, note: 'Finisher, easy pace' }
  const runOn = (date: string) => day(date)?.filter((x) => x.exerciseId === 'running')

  it('a lifting day with its own run finisher never replaces the run plan’s run, and stops and replaces leave it', () => {
    reset()
    useStore.getState().startCardioProgram({ sessions: cardioDays(['2026-10-05', '2026-10-07']), sport: 'run', title: 'Build mileage plan', replace: false, stopSame: true, today })
    const planned = runOn('2026-10-05')!
    expect(planned).toHaveLength(1)
    useStore.getState().startProgram({ '2026-10-05': [lift, finisher], '2026-10-07': [] }, 'Month plan', today)
    expect(runOn('2026-10-05')).toContainEqual(planned[0])
    expect(runOn('2026-10-07')).toHaveLength(1)
    useStore.getState().startProgram({ '2026-10-05': [squat, finisher] }, 'Another month', today)
    expect(runOn('2026-10-05')).toContainEqual(planned[0])
    expect(runOn('2026-10-07')).toHaveLength(1)
    useStore.getState().stopProgram(useStore.getState().programs.find((p) => p.kind === 'program')!.id, today)
    expect(day('2026-10-05')).toEqual(planned) // just the run plan's run, exactly as planned
    expect(runOn('2026-10-07')).toHaveLength(1)
  })

  it('a run plan added after a lifting plan takes the place of its cardio finisher, and survives the lifting plan stopping', () => {
    reset()
    useStore.getState().startProgram({ '2026-10-05': [lift, finisher], '2026-10-06': [squat, { ...finisher, exerciseId: 'x-row-erg' }] }, 'Month plan', today)
    useStore.getState().startCardioProgram({ sessions: cardioDays(['2026-10-05', '2026-10-06']), sport: 'run', title: 'Build mileage plan', replace: false, stopSame: true, today })
    expect(ids('2026-10-05')).toEqual(['Barbell_Deadlift', 'running'])
    expect(runOn('2026-10-05')![0].minutes).toBe(30) // the plan's run, not the 15-minute finisher
    expect(ids('2026-10-06')).toEqual(['Barbell_Squat', 'running']) // no row on top of the run
    const month = useStore.getState().programs.find((p) => p.kind === 'program')!
    useStore.getState().stopProgram(month.id, today)
    expect(ids('2026-10-05')).toEqual(['running'])
    expect(ids('2026-10-06')).toEqual(['running'])
  })

  it('lift or run first: a new plan follows the saved order, and changing it reorders every upcoming day with both', () => {
    reset()
    useStore.setState((s) => ({ trainingPrefs: { ...s.trainingPrefs, stackOrder: 'cardio' } }))
    useStore.getState().startCardioProgram({ sessions: cardioDays(['2026-10-05', '2026-10-06']), sport: 'run', title: '10K plan', replace: false, stopSame: true, today })
    useStore.getState().startProgram({ '2026-10-05': [lift, squat], '2026-10-06': [] }, 'Month plan', today)
    expect(ids('2026-10-05')).toEqual(['running', 'Barbell_Deadlift', 'Barbell_Squat'])
    expect(ids('2026-10-06')).toEqual(['running'])
    useStore.getState().setStackOrder('lift', today)
    expect(useStore.getState().trainingPrefs.stackOrder).toBe('lift')
    expect(ids('2026-10-05')).toEqual(['Barbell_Deadlift', 'Barbell_Squat', 'running'])
    // A run plan added on top of lifting follows it too.
    useStore.getState().setStackOrder('cardio', today)
    useStore.getState().startCardioProgram({ sessions: cardioDays(['2026-10-05']), sport: 'run', title: '5K plan', replace: false, stopSame: true, today })
    expect(ids('2026-10-05')).toEqual(['running', 'Barbell_Deadlift', 'Barbell_Squat'])
    expect(useStore.getState().programs.map((p) => p.title)).toEqual(['Month plan', '5K plan'])
  })

  it('sharedDays: dates with a run and a workout, not a lifting rest day', () => {
    const month: Program = { id: 'm', kind: 'program', title: 'Month', createdAt: '', entries: [{ date: '2026-10-01', exerciseIds: ['x'] }, { date: '2026-10-05', exerciseIds: [] }, { date: '2026-09-28', exerciseIds: ['x'] }] }
    expect(sharedDays([cardio, month], '2026-09-30')).toEqual(['2026-10-01'])
    // A lifting plan about to be added stands in for the current one.
    expect(sharedDays([cardio, month], '2026-09-30', { kind: 'program', dates: ['2026-10-05'] })).toEqual(['2026-10-05'])
    expect(sharedDays([month], '2026-09-30', { kind: 'cardio', dates: ['2026-10-01', '2026-10-02'] })).toEqual(['2026-10-01'])
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
