import { describe, expect, it } from 'vitest'
import { formatDuration, paceAt, parseDuration, trainingPaces, vdot } from './paces'

describe('VDOT', () => {
  it('matches published Daniels values (within a point)', () => {
    expect(vdot(3.10686, 19 + 57 / 60)).toBeCloseTo(50, 0) // 5K in 19:57 is VDOT 50
    expect(vdot(6.21371, 41 + 21 / 60)).toBeGreaterThan(49) // 10K in 41:21 ≈ VDOT 50
    expect(vdot(6.21371, 41 + 21 / 60)).toBeLessThan(51)
    expect(vdot(26.2188, 3 * 60 + 10)).toBeGreaterThan(49) // 3:10 marathon ≈ VDOT 50
    expect(vdot(26.2188, 3 * 60 + 10)).toBeLessThan(52)
  })
  it('is consistent across distances for one runner', () => {
    const a = vdot(3.10686, 25)
    const b = vdot(6.21371, 25 * 2.09) // similar-fitness 10K
    expect(Math.abs(a - b)).toBeLessThan(2)
  })
})

describe('training paces', () => {
  const p = trainingPaces(3.10686, 25)!
  it('orders easy < marathon < threshold < interval < repetition (slower to faster)', () => {
    expect(p.easy[0]).toBeGreaterThan(p.easy[1])
    expect(p.easy[1]).toBeGreaterThan(p.marathon)
    expect(p.marathon).toBeGreaterThan(p.threshold)
    expect(p.threshold).toBeGreaterThan(p.interval)
    expect(p.interval).toBeGreaterThan(p.repetition)
  })
  it('gives sensible numbers for a 25:00 5K runner', () => {
    expect(p.vdot).toBeGreaterThan(37)
    expect(p.vdot).toBeLessThan(40)
    expect(p.easy[0]).toBeGreaterThan(10.5) // slow end of easy, min/mile
    expect(p.easy[0]).toBeLessThan(12)
    expect(p.interval).toBeGreaterThan(7.6) // ≈ 5K pace (8:02)
    expect(p.interval).toBeLessThan(8.2)
    expect(p.threshold).toBeGreaterThan(8.6)
    expect(p.threshold).toBeLessThan(9.4)
  })
  it('faster goals mean faster paces and rejects nonsense', () => {
    expect(trainingPaces(3.10686, 20)!.easy[1]).toBeLessThan(p.easy[1])
    expect(paceAt(50, 0.8)).toBeLessThan(paceAt(40, 0.8))
    expect(trainingPaces(3.1, 1)).toBeNull()
    expect(trainingPaces(26.2, 1000)).toBeNull()
  })
})

describe('durations', () => {
  it('parses and formats', () => {
    expect(parseDuration('3:45:00')).toBe(225)
    expect(parseDuration('24:30')).toBeCloseTo(24.5)
    expect(parseDuration('45')).toBe(45)
    expect(parseDuration('abc')).toBeNull()
    expect(parseDuration('-5')).toBeNull()
    expect(formatDuration(225)).toBe('3:45:00')
    expect(formatDuration(24.5)).toBe('24:30')
  })
})
