import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { TimedLog } from '../types'
import { buildWodItems, circuitSegments, derivedLogs, emomIntervals, formatResult, makeTabata, parseCircuit, tabataOf, wodOf, wodTitle } from './wod'

const lookup = (id: string) => BUILTIN_BY_ID.get(id)
const items = (kind: 'amrap' | 'emom' | 'fortime') =>
  buildWodItems({
    wod: kind === 'amrap' ? { kind, minutes: 12 } : kind === 'emom' ? { kind, minutes: 10 } : { kind, minutes: 20, rounds: 4 },
    moves: [{ exerciseId: 'Pushups', reps: 10 }, { exerciseId: 'Bodyweight_Squat', reps: 15 }, { exerciseId: 'Plank', seconds: 30 }],
    block: 'wod',
  })
const log = (t: Partial<TimedLog> & Pick<TimedLog, 'wod'>): TimedLog => ({ id: 't', date: '2026-10-01', block: 'wod', title: '', movements: [], ...t })

describe('timed workouts', () => {
  it('titles and helpers', () => {
    expect(wodTitle({ kind: 'amrap', minutes: 20 })).toBe('AMRAP 20 min')
    expect(wodTitle({ kind: 'emom', minutes: 12 })).toBe('EMOM 12 min')
    expect(wodTitle({ kind: 'emom', minutes: 12, interval: 2 })).toBe('E2MOM 12 min')
    expect(wodTitle({ kind: 'fortime', minutes: 15, rounds: 5 })).toBe('5 rounds for time · 15 min cap')
    expect(emomIntervals({ kind: 'emom', minutes: 12, interval: 2 })).toBe(6)
    expect(wodOf(items('amrap'))?.kind).toBe('amrap')
    expect(items('emom').map((i) => i.note)).toEqual(['minute 1 of 3', 'minute 2 of 3', 'minute 3 of 3'])
  })

  it('formats results', () => {
    const w = { kind: 'amrap', minutes: 12 } as const
    expect(formatResult({ wod: w, rounds: 7, reps: 5 })).toBe('7 rounds + 5 reps')
    expect(formatResult({ wod: w, rounds: 1 })).toBe('1 round')
    expect(formatResult({ wod: { kind: 'emom', minutes: 10 }, intervals: 9 })).toBe('9 of 10 intervals')
    expect(formatResult({ wod: { kind: 'fortime', minutes: 20, rounds: 4 }, seconds: 872 })).toBe('14:32')
    expect(formatResult({ wod: { kind: 'fortime', minutes: 20, rounds: 4 }, capped: true, rounds: 3 })).toBe('Time cap · 3 of 4 rounds')
  })

  it('AMRAP counts each completed round, plus extra reps on the first move', () => {
    const d = derivedLogs(log({ wod: { kind: 'amrap', minutes: 12 }, rounds: 5, reps: 4 }), items('amrap'), lookup)
    expect(d.map((l) => [l.exerciseId, l.sets![0].reps ?? l.sets![0].seconds])).toEqual([['Pushups', 54], ['Bodyweight_Squat', 75], ['Plank', 150]])
  })

  it('EMOM movements take turns; for time uses all rounds unless capped', () => {
    const e = derivedLogs(log({ wod: { kind: 'emom', minutes: 10 }, intervals: 10 }), items('emom'), lookup)
    expect(e.map((l) => l.sets![0].reps ?? l.sets![0].seconds)).toEqual([40, 45, 90]) // 4,3,3 turns
    const f = derivedLogs(log({ wod: { kind: 'fortime', minutes: 20, rounds: 4 }, seconds: 700 }), items('fortime'), lookup)
    expect(f[0].sets![0].reps).toBe(40)
    const c = derivedLogs(log({ wod: { kind: 'fortime', minutes: 20, rounds: 4 }, capped: true, rounds: 2 }), items('fortime'), lookup)
    expect(c[0].sets![0].reps).toBe(20)
    expect(derivedLogs(log({ wod: { kind: 'amrap', minutes: 12 }, rounds: 0 }), items('amrap'), lookup)).toEqual([])
  })
})

describe('tabata', () => {
  it('works out totals and titles', () => {
    const w = makeTabata(4)
    expect(w).toMatchObject({ kind: 'tabata', work: 20, rest: 10, rounds: 8, gap: 60, intervals: 32 })
    expect(tabataOf(w, 4).total).toBe(4 * 240 + 3 * 60) // 19 minutes
    expect(w.minutes).toBe(19)
    expect(wodTitle(w)).toBe('Tabata 20s/10s × 8')
    expect(wodTitle(makeTabata(2, { work: 40, rest: 20, rounds: 5 }))).toBe('Tabata 40s/20s × 5')
  })
  it('logs intervals to movements in order, and counts reps', () => {
    const w = makeTabata(3)
    const its = buildWodItems({ wod: w, moves: [{ exerciseId: 'Pushups', reps: 10 }, { exerciseId: 'Bodyweight_Squat' }, { exerciseId: 'Plank' }], block: 'tabata' })
    expect(formatResult(log({ wod: w, intervals: 20, reps: 180 }))).toBe('20 of 24 intervals · 180 reps')
    const d = derivedLogs(log({ wod: w, intervals: 20, reps: 180 }), its, lookup)
    // 8 intervals on the first, 8 on the second, 4 on the third
    expect(d[0].sets![0].reps).toBe(80) // 10 reps x 8 rounds
    expect(d[1].sets![0].reps).toBe(Math.round((180 * 8) / 20)) // no target reps: share of the total
    expect(d[2].sets![0].seconds).toBe(80) // plank: 20s x 4
    expect(derivedLogs(log({ wod: w, intervals: 0 }), its, lookup)).toEqual([])
  })
})

describe('circuit timer', () => {
  it('reads the randomizer’s circuit description and lays out work/rest segments', () => {
    const its = [{ exerciseId: 'a', sets: 3, note: '40s on / 20s off', block: 'circuit', blockLabel: 'HIIT circuit · 3 rounds · 40s on / 20s off · 1 min rest between rounds' }, { exerciseId: 'b', sets: 3, note: '40s on / 20s off' }]
    const c = parseCircuit(its[0].blockLabel, its)!
    expect(c).toEqual({ rounds: 3, work: 40, rest: 20, roundRest: 60 })
    const seg = circuitSegments(['A', 'B'], c)
    expect(seg.map((s) => `${s.phase}:${s.seconds}`)).toEqual(['work:40', 'rest:20', 'work:40', 'rest:60', 'work:40', 'rest:20', 'work:40', 'rest:60', 'work:40', 'rest:20', 'work:40'])
    expect(seg.reduce((a, s) => a + s.seconds, 0)).toBe(3 * 2 * 40 + 3 * 20 + 2 * 60)
    expect(parseCircuit('Superset 1', its)).toBeNull()
  })
})
