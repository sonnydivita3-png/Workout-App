import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { ExerciseLog } from '../types'
import { unfinished, workoutSummary } from './summary'

const B = 'Barbell_Bench_Press_-_Medium_Grip'
const lift = (date: string, weight: number, reps: number, id = B): ExerciseLog => ({ date, exerciseId: id, sets: [{ weight, reps }, { weight, reps }] })

describe('workoutSummary', () => {
  it('compares each exercise with last time and spots new bests', () => {
    const logs = [lift('2026-09-01', 145, 8), lift('2026-09-10', 135, 8), lift('2026-09-20', 150, 8), { date: '2026-09-20', exerciseId: 'Pushups', sets: [{ weight: null, reps: 20 }] }, { date: '2026-09-10', exerciseId: 'Pushups', sets: [{ weight: null, reps: 25 }] }]
    const s = workoutSummary('2026-09-20', [{ exerciseId: B, sets: 2 }, { exerciseId: 'Pushups', sets: 2 }, { exerciseId: 'Plank', sets: 2 }], logs, (id) => BUILTIN_BY_ID.get(id))
    expect(s.results.map((r) => [r.name.slice(0, 7), r.status, r.pr])).toEqual([['Bench P', 'up', true], ['Push-Up', 'down', false], ['Plank', 'skipped', false]])
    expect(s).toMatchObject({ beat: 1, compared: 2, prs: 1, liftVolume: 150 * 16, lastLiftVolume: 135 * 16 })
  })
  it('same top set but a rep more on a later set is beating last time, as the card marks it (not "matched")', () => {
    const sets = (...reps: number[]) => reps.map((r) => ({ weight: 255, reps: r }))
    const log = (date: string, ...reps: number[]): ExerciseLog => ({ date, exerciseId: 'Barbell_Squat', sets: sets(...reps) })
    const lookup = (id: string) => BUILTIN_BY_ID.get(id)
    const run = (...today: number[]) => workoutSummary('2026-11-03', [{ exerciseId: 'Barbell_Squat', sets: 3 }], [log('2026-10-28', 6, 6, 5), log('2026-11-03', ...today)], lookup)
    expect(run(6, 6, 6).results[0]).toMatchObject({ status: 'up', pr: false })
    expect(run(6, 6, 6).beat).toBe(1)
    expect(run(6, 6, 5).results[0].status).toBe('same')
    expect(run(6, 5, 5).results[0].status).toBe('down')
  })
  it('a set typed in but not ticked is not part of the result: no PR, no volume, and last time is the sets done', () => {
    const lookup = (id: string) => BUILTIN_BY_ID.get(id)
    const done = (weight: number) => ({ weight, reps: 5, done: true })
    const typed = (weight: number) => ({ weight, reps: 5, done: false, auto: false })
    const logs: ExerciseLog[] = [
      { date: '2026-09-10', exerciseId: B, sets: [done(185), done(185), typed(185)] },
      { date: '2026-09-20', exerciseId: B, sets: [done(185), done(185), typed(225)] },
    ]
    const s = workoutSummary('2026-09-20', [{ exerciseId: B, sets: 3 }], logs, lookup)
    expect(s.results[0]).toMatchObject({ status: 'same', pr: false, volume: 1850, lastVolume: 1850 })
    // Nothing ticked at all: skipped, and nothing else claims it was done.
    const none = workoutSummary('2026-09-20', [{ exerciseId: B, sets: 1 }], [logs[0], { date: '2026-09-20', exerciseId: B, sets: [typed(225)] }], lookup)
    expect(none.results[0]).toMatchObject({ status: 'skipped', pr: false, volume: 0 })
    expect(none).toMatchObject({ beat: 0, prs: 0, liftVolume: 0 })
  })
  it('first time is "new", not a PR', () => {
    const s = workoutSummary('2026-09-20', [{ exerciseId: B, sets: 2 }], [lift('2026-09-20', 100, 5)], (id) => BUILTIN_BY_ID.get(id))
    expect(s.results[0]).toMatchObject({ status: 'new', pr: false })
  })
  it('cardio is never "worse than last time": a shorter run is just done, and only real records count as bests', () => {
    const run = (date: string, distance: number, minutes: number): ExerciseLog => ({ date, exerciseId: 'running', cardio: { distance, minutes } })
    const lookup = (id: string) => BUILTIN_BY_ID.get(id)
    const easy = workoutSummary('2026-09-20', [{ exerciseId: 'running', sets: 1 }], [run('2026-09-10', 6, 54), run('2026-09-20', 3, 30)], lookup)
    expect(easy.results[0]).toMatchObject({ status: 'done', pr: false })
    expect(easy).toMatchObject({ beat: 0, compared: 0, prs: 0 })
    const fast = workoutSummary('2026-09-20', [{ exerciseId: 'running', sets: 1 }, { exerciseId: B, sets: 2 }], [run('2026-09-10', 3.1, 27), run('2026-09-20', 3.1, 25), lift('2026-09-10', 135, 8), lift('2026-09-20', 140, 8)], lookup)
    expect(fast.results.find((r) => r.exerciseId === 'running')).toMatchObject({ status: 'done', pr: true, best: 'Fastest 5K yet: 25:03' })
    expect(fast).toMatchObject({ beat: 1, compared: 1, prs: 2 })
  })
})

describe('unfinished', () => {
  it('lists lifts short of their planned sets and cardio with nothing logged', () => {
    const items = [
      { exerciseId: B, sets: 3 },
      { exerciseId: 'Pushups', sets: 2 },
      { exerciseId: 'running', sets: 1 },
      { exerciseId: 'Plank', sets: 2, warmup: true },
    ]
    const logs = [
      { date: 'd', exerciseId: B, sets: [{ weight: 135, reps: 8 }, { weight: 135, reps: 8 }] },
      { date: 'd', exerciseId: 'Pushups', sets: [{ weight: null, reps: 20 }, { weight: null, reps: 18 }] },
    ]
    const u = unfinished('d', items, logs, (id) => BUILTIN_BY_ID.get(id))
    expect(u.map((x) => [x.exerciseId, x.done, x.planned])).toEqual([[B, 2, 3], ['running', 0, 1]])
  })
})

describe('ticked sets', () => {
  it('counts ticked sets, and older sets with numbers; typed but unticked sets are not done yet', () => {
    const items = [{ exerciseId: 'Pushups', sets: 4 }]
    const sets = [
      { weight: null, reps: 10, done: true },
      { weight: null, reps: 10 }, // saved before ticks existed
      { weight: null, reps: 12, done: false }, // typed, not ticked
      { weight: null, reps: null, done: false },
    ]
    const u = unfinished('d', items, [{ date: 'd', exerciseId: 'Pushups', sets }], (id) => BUILTIN_BY_ID.get(id))
    expect(u.map((x) => [x.done, x.planned])).toEqual([[2, 4]])
  })
})

describe('warm-ups you add yourself', () => {
  const lookup = (id: string) => BUILTIN_BY_ID.get(id)
  const work = (n: number) => Array.from({ length: n }, () => ({ weight: 185, reps: 5, done: true }))
  const warm = { weight: 95, reps: 8, warmup: true, done: true }

  it('two extra sets made into warm-ups: 2 warm-ups + 4 working sets, nothing missing', () => {
    const items = [{ exerciseId: 'Barbell_Squat', sets: 6, reps: 5 }]
    const logs = [{ date: 'd', exerciseId: 'Barbell_Squat', sets: [warm, warm, ...work(4)] }]
    expect(unfinished('d', items, logs, lookup)).toEqual([])
  })

  it('planned warm-ups plus working sets: only working sets are counted', () => {
    const items = [{ exerciseId: 'Barbell_Squat', sets: 4, warmupSets: 2 }]
    expect(unfinished('d', items, [{ date: 'd', exerciseId: 'Barbell_Squat', sets: [warm, warm, ...work(3)] }], lookup)).toEqual([
      { exerciseId: 'Barbell_Squat', name: 'Back Squat', done: 3, planned: 4, cardio: false },
    ])
    expect(unfinished('d', items, [{ date: 'd', exerciseId: 'Barbell_Squat', sets: [warm, warm, ...work(4)] }], lookup)).toEqual([])
  })

  it('a planned warm-up made into a working set counts as one', () => {
    const items = [{ exerciseId: 'Barbell_Squat', sets: 3, warmupSets: 1 }]
    const asWork = { weight: 135, reps: 5, warmup: false, done: true }
    expect(unfinished('d', items, [{ date: 'd', exerciseId: 'Barbell_Squat', sets: [asWork, ...work(3)] }], lookup)).toEqual([])
    expect(unfinished('d', items, [{ date: 'd', exerciseId: 'Barbell_Squat', sets: [asWork, ...work(2)] }], lookup)[0]).toMatchObject({ done: 3, planned: 4 })
  })

  it('logged sets past the plan still count (the plan changed after logging)', () => {
    const items = [{ exerciseId: 'Barbell_Squat', sets: 4 }] // its 2 planned warm-ups moved to another lift
    expect(unfinished('d', items, [{ date: 'd', exerciseId: 'Barbell_Squat', sets: [warm, warm, ...work(4)] }], lookup)).toEqual([])
  })
})

describe('finish summary with bodyweight sets', () => {
  const lookup = (id: string) => BUILTIN_BY_ID.get(id)
  const items = [{ exerciseId: 'Dips_-_Chest_Version', sets: 3 }]
  const day = (date: string, sets: { weight: number | null; reps: number | null; done?: boolean }[]) => ({ date, exerciseId: 'Dips_-_Chest_Version', sets })

  it('0 lb sets with reps are done, not skipped, and compare by reps', () => {
    const logs = [day('a', [{ weight: 0, reps: 10 }]), day('b', [{ weight: 0, reps: 12 }, { weight: null, reps: 11 }])]
    expect(workoutSummary('b', items, logs, lookup).results[0]).toMatchObject({ status: 'up', score: 12, lastScore: 10, pr: true })
    expect(workoutSummary('a', items, logs, lookup).results[0].status).toBe('new')
  })

  it('weighted last time, bodyweight today: logged, not compared', () => {
    const logs = [day('a', [{ weight: 25, reps: 8 }]), day('b', [{ weight: 0, reps: 15 }])]
    const r = workoutSummary('b', items, logs, lookup)
    expect(r.results[0].status).toBe('done')
    expect(r.compared).toBe(0)
  })

  it('a ticked set with nothing typed still counts as done; nothing at all is skipped', () => {
    expect(workoutSummary('b', items, [day('b', [{ weight: null, reps: null, done: true }])], lookup).results[0].status).toBe('new')
    expect(workoutSummary('b', items, [day('b', [{ weight: null, reps: null, done: false }])], lookup).results[0].status).toBe('skipped')
  })
})
