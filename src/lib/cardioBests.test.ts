import { describe, expect, it } from 'vitest'
import type { ExerciseLog, Units } from '../types'
import { cardioRecords, newCardioBests, raceTime } from './cardioBests'

const mi: Units = { weight: 'lb', distance: 'mi' }
const km: Units = { weight: 'kg', distance: 'km' }
const M = 1609.344
const log = (exerciseId: string, date: string, distance: number | null, minutes: number | null): ExerciseLog => ({ date, exerciseId, cardio: { distance, minutes } })
const run = (date: string, distance: number | null, minutes: number | null) => log('running', date, distance, minutes)
const titles = (logs: ExerciseLog[], id: string, date: string, units: Units = mi) => {
  const today = logs.find((l) => l.exerciseId === id && l.date === date)!.cardio
  return newCardioBests(logs, id, today, date, units).map((b) => `${b.title}: ${b.value} (was ${b.was})`)
}

describe('cardio personal bests', () => {
  it('a shorter or slower run than last time is just a run: no target, nothing to beat', () => {
    const logs = [run('2026-09-01', 6, 54), run('2026-09-03', 3, 30)]
    expect(titles(logs, 'running', '2026-09-03')).toEqual([])
  })
  it('a quick short run is not a speed record: paces only compare over the same distance', () => {
    // 1.5 mi at 7:00/mi after 5Ks at 8:00/mi: faster pace, but no mile or 5K was run.
    const logs = [run('2026-09-01', 3.11, 24.9), run('2026-09-03', 1.5, 10.5)]
    expect(titles(logs, 'running', '2026-09-03')).toEqual([])
  })
  it('longest ever, by distance', () => {
    const logs = [run('2026-09-01', 6.2, 60), run('2026-09-05', 4, 36), run('2026-09-08', 8, 76)]
    expect(titles(logs, 'running', '2026-09-08')).toEqual(['Longest run yet: 8 mi (was 6.2 mi)'])
  })
  it('fastest 5K, even when the GPS read a little long (scaled to the exact distance, and not a "longest")', () => {
    const logs = [run('2026-09-01', 3.1, 27), run('2026-09-05', 3.15, 26)]
    expect(titles(logs, 'running', '2026-09-05')).toEqual(['Fastest 5K yet: 25:39 (was 27:04)'])
  })
  it('no record on a first session, or for repeating the same thing', () => {
    expect(titles([run('2026-09-01', 3.1, 27)], 'running', '2026-09-01')).toEqual([])
    expect(titles([run('2026-09-01', 3.1, 27), run('2026-09-02', 3.1, 27)], 'running', '2026-09-02')).toEqual([])
  })
  it('later sessions never count against an earlier one', () => {
    const logs = [run('2026-09-01', 3.1, 27), run('2026-09-05', 3.1, 25), run('2026-09-10', 3.1, 22)]
    expect(titles(logs, 'running', '2026-09-05')).toEqual(['Fastest 5K yet: 25:03 (was 27:04)'])
  })
  it('a 2,000 m row and a 400 m swim (or 500 yd) are their own standards', () => {
    const rows = [log('x-row-erg', '2026-09-01', 2000 / M, 7.75), log('x-row-erg', '2026-09-08', 2000 / M, 7.5)]
    expect(titles(rows, 'x-row-erg', '2026-09-08')).toEqual(['Fastest 2,000 m yet: 7:30 (was 7:45)'])
    const swims = [log('swimming', '2026-09-01', 400 / M, 9), log('swimming', '2026-09-08', 400 / M, 8.5)]
    expect(titles(swims, 'swimming', '2026-09-08')).toEqual(['Fastest 400 m yet: 8:30 (was 9:00)'])
    const yd: Units = { ...mi, byExercise: { swimming: 'yd' } }
    const pool = [log('swimming', '2026-09-01', 500 / 1760, 10), log('swimming', '2026-09-08', 500 / 1760, 9.5)]
    expect(titles(pool, 'swimming', '2026-09-08', yd)).toEqual(['Fastest 500 yd yet: 9:30 (was 10:00)'])
  })
  it('machines without a distance: the longest session', () => {
    const logs = [log('Elliptical_Trainer', '2026-09-01', null, 30), log('Elliptical_Trainer', '2026-09-03', null, 45)]
    expect(titles(logs, 'Elliptical_Trainer', '2026-09-03')).toEqual(['Longest session yet: 45 min (was 30 min)'])
  })
  it('rides use 10 / 25 mi, or 20 / 40 km', () => {
    const rides = [log('cycling', '2026-09-01', 10, 36), log('cycling', '2026-09-08', 10.3, 34)]
    expect(titles(rides, 'cycling', '2026-09-08')).toEqual(['Longest ride yet: 10.3 mi (was 10 mi)', 'Fastest 10 mi yet: 33:01 (was 36:00)'])
    const metric = [log('cycling', '2026-09-01', 20000 / M, 40), log('cycling', '2026-09-08', 20000 / M, 38)]
    expect(titles(metric, 'cycling', '2026-09-08', km)).toEqual(['Fastest 20 km yet: 38:00 (was 40:00)'])
  })
  it('lists every record for the Progress page, marking ones the latest session set', () => {
    const logs = [run('2026-09-01', 1, 8.5), run('2026-09-03', 3.107, 27), run('2026-09-08', 6.214, 56), run('2026-09-12', 3.15, 26)]
    expect(cardioRecords(logs, 'running', mi)).toEqual([
      { label: 'Longest', value: '6.21 mi', date: '2026-09-08', fresh: false },
      { label: 'Longest time', value: '56 min', date: '2026-09-08', fresh: false },
      { label: 'Fastest 1 mile', value: '8:30', date: '2026-09-01', fresh: false },
      { label: 'Fastest 5K', value: '≈25:39', date: '2026-09-12', fresh: true },
      { label: 'Fastest 10K', value: '56:00', date: '2026-09-08', fresh: false },
    ])
    expect(cardioRecords([], 'running', mi)).toEqual([])
  })
  it('formats race times', () => {
    expect(raceTime(24.85)).toBe('24:51')
    expect(raceTime(112.1166)).toBe('1:52:07')
  })
})
