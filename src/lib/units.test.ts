import { describe, expect, it } from 'vitest'
import { cardioLine, formatCardioTime, formatMinutes, formatPace, formatPaceFor, formatSeconds, showDistance, showDistanceIn, showWeight, storeDistanceIn, storeWeight } from './units'

const lb = { weight: 'lb', distance: 'mi' } as const
const kg = { weight: 'kg', distance: 'km' } as const

describe('unit conversions (stored in lb and miles)', () => {
  it('kg and km both ways', () => {
    expect(showWeight(220.462262, kg)).toBe(100)
    expect(storeWeight(100, kg)).toBeCloseTo(220.462, 3)
    expect(showDistance(3.10686, kg)).toBe(5)
    expect(showWeight(null, kg)).toBeNull()
  })
  it('meters and yards for ergs and swims', () => {
    expect(showDistanceIn(storeDistanceIn(2000, 'm'), 'm')).toBe(2000)
    expect(showDistanceIn(storeDistanceIn(500, 'yd'), 'yd')).toBe(500)
  })
})

describe('pace', () => {
  it('per mile or km, rounding 59.5 s up to the next minute', () => {
    expect(formatPace(3, 30, lb)).toBe('10:00 /mi')
    expect(formatPace(3.10686, 25, kg)).toBe('5:00 /km')
    expect(formatPace(1, 7.9999, lb)).toBe('8:00 /mi')
    expect(formatPace(0, 30, lb)).toBeNull()
  })
  it('per 500 m on a rower, per 100 m swimming', () => {
    const units = { ...lb, byExercise: {} }
    expect(formatPaceFor(storeDistanceIn(2000, 'm'), 8, 'x-row-erg', units)).toBe('2:00 /500m')
    expect(formatPaceFor(storeDistanceIn(1000, 'm'), 20, 'swimming', units)).toBe('2:00 /100m')
  })
})

describe('time formatting rounds before splitting', () => {
  it('never shows 60 seconds or 60 minutes', () => {
    expect(formatSeconds(179.7)).toBe('3:00')
    expect(formatSeconds(89.6)).toBe('1:30')
    expect(formatSeconds(45)).toBe('45s')
    expect(formatMinutes(119.6)).toBe('2h 00m')
    expect(formatMinutes(59.6)).toBe('1h 00m')
    expect(formatMinutes(45)).toBe('45 min')
  })
  it('cardio times show seconds only when there are some', () => {
    expect(formatCardioTime(30)).toBe('30 min')
    expect(formatCardioTime(7 + 32 / 60)).toBe('7:32')
    expect(formatCardioTime(65 + 20 / 60)).toBe('1:05:20')
    expect(cardioLine({ distance: null, minutes: null }, 'running', lb)).toBe('–')
  })
})
