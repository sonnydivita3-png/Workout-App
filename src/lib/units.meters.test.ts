import { describe, expect, it } from 'vitest'
import { cardioLine, distanceUnitFor, distanceUnitsFor, formatCardioTime, formatDistanceFor, formatPaceFor, showDistanceIn, storeDistanceIn } from './units'

const mi = { weight: 'lb', distance: 'mi' } as const
const km = { weight: 'kg', distance: 'km' } as const

describe('rowers and ergs use meters', () => {
  it('rower, SkiErg and BikeErg in meters whatever the setting; runs follow the setting', () => {
    expect(distanceUnitFor('x-row-erg', mi)).toBe('m')
    expect(distanceUnitFor('x-skierg', km)).toBe('m')
    expect(distanceUnitFor('x-bike-erg', mi)).toBe('m')
    expect(distanceUnitFor('running', mi)).toBe('mi')
    expect(distanceUnitFor('running', km)).toBe('km')
  })

  it('stores miles and shows whole meters, both ways', () => {
    const stored = storeDistanceIn(2000, 'm')!
    expect(stored).toBeCloseTo(1.2427, 3)
    expect(showDistanceIn(stored, 'm')).toBe(2000)
    expect(showDistanceIn(storeDistanceIn(5, 'km'), 'km')).toBe(5)
  })

  it('pace per 500 m on a rower: 2,000 m in 7:32 is 1:53', () => {
    const d = storeDistanceIn(2000, 'm')
    const t = 7 + 32 / 60
    expect(formatPaceFor(d, t, 'x-row-erg', mi)).toBe('1:53 /500m')
    expect(formatDistanceFor(d, 'x-row-erg', mi)).toBe('2,000 m')
    expect(cardioLine({ distance: d, minutes: t }, 'x-row-erg', mi)).toBe('2,000 m · 7:32 · 1:53 /500m')
    expect(cardioLine({ distance: 3, minutes: 27 }, 'running', mi)).toBe('3 mi · 27 min · 9:00 /mi')
  })

  it('times show seconds when they have them', () => {
    expect(formatCardioTime(30)).toBe('30 min')
    expect(formatCardioTime(7 + 32 / 60)).toBe('7:32')
    expect(formatCardioTime(65 + 20 / 60)).toBe('1:05:20')
    expect(formatCardioTime(null)).toBeNull()
  })
})

describe('each cardio exercise can pick its own unit', () => {
  it('a choice on the card wins over the default; a unit the exercise does not offer is ignored', () => {
    expect(distanceUnitFor('x-row-erg', { ...mi, byExercise: { 'x-row-erg': 'km' } })).toBe('km')
    expect(distanceUnitFor('running', { ...mi, byExercise: { running: 'm' } })).toBe('m')
    expect(distanceUnitFor('running', { ...mi, byExercise: { running: 'yd' } })).toBe('mi')
    expect(distanceUnitFor('running', { ...mi, byExercise: { cycling: 'km' } })).toBe('mi')
    expect(distanceUnitsFor('swimming')).toContain('yd')
    expect(distanceUnitsFor('running')).not.toContain('yd')
  })

  it('swimming: meters by default, pace per 100 m, or yards and pace per 100 yd', () => {
    expect(distanceUnitFor('swimming', km)).toBe('m')
    const d = storeDistanceIn(1500, 'm')
    expect(cardioLine({ distance: d, minutes: 30 }, 'swimming', mi)).toBe('1,500 m · 30 min · 2:00 /100m')
    const yd = { ...mi, byExercise: { swimming: 'yd' as const } }
    const y = storeDistanceIn(1000, 'yd')
    expect(showDistanceIn(y, 'yd')).toBe(1000)
    expect(cardioLine({ distance: y, minutes: 20 }, 'swimming', yd)).toBe('1,000 yd · 20 min · 2:00 /100yd')
  })

  it('a rower switched to km shows km and pace per km; a run in meters shows pace per km', () => {
    const d = storeDistanceIn(5, 'km')
    expect(cardioLine({ distance: d, minutes: 20 }, 'x-row-erg', { ...mi, byExercise: { 'x-row-erg': 'km' } })).toBe('5 km · 20 min · 4:00 /km')
    expect(formatPaceFor(storeDistanceIn(400, 'm'), 1.5, 'running', { ...mi, byExercise: { running: 'm' } })).toBe('3:45 /km')
  })
})
