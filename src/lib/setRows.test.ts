import { describe, expect, it } from 'vitest'
import type { StrengthSet } from '../types'
import { addWorkingSets, insertDropSet, removeWorkingSets, rowNumber, setRows, workingRows } from './setRows'

const set = (weight: number | null = null, extra: Partial<StrengthSet> = {}): StrengthSet => ({ weight, reps: weight ? 8 : null, ...extra })
const kinds = (rows: StrengthSet[]) => rows.map((s) => (s.warmup ? 'W' : s.drop ? 'D' : 'S')).join('')

describe('set rows with drop sets anywhere', () => {
  it('puts a drop set straight after any set, and numbers each kind on its own', () => {
    const rows = setRows({ sets: 3, warmupSets: 1 }, undefined)
    expect(kinds(rows)).toBe('WSSS')
    const afterFirst = insertDropSet(rows, 1)
    expect(kinds(afterFirst)).toBe('WSDSS')
    const chained = insertDropSet(afterFirst, 2)
    expect(kinds(chained)).toBe('WSDDSS')
    expect(chained.map((_, i) => rowNumber(chained, i))).toEqual([1, 1, 1, 2, 2, 3])
    // Logged rows keep their places when the plan counts them (3 sets, 2 drops).
    expect(kinds(setRows({ sets: 3, warmupSets: 1, dropSets: 2 }, chained))).toBe('WSDDSS')
  })

  it('a new set goes after the last one, after drop sets done with it, before ones not done yet', () => {
    const doneDrop = [set(135, { done: true }), set(110, { drop: true, done: true }), set(135, { done: true })]
    expect(kinds(addWorkingSets(doneDrop, 1))).toBe('SDSS')
    const withDoneTail = [set(135, { done: true }), set(110, { drop: true, done: true })]
    expect(kinds(addWorkingSets(withDoneTail, 1))).toBe('SDS')
    const planned = setRows({ sets: 2, dropSets: 1 }, undefined)
    expect(kinds(addWorkingSets(planned, 2))).toBe('SSSSD')
    expect(kinds(addWorkingSets([set(null, { warmup: true })], 1))).toBe('WS')
  })

  it('fewer sets drop the last working sets, keeping warm-ups and drop sets', () => {
    const rows = [set(null, { warmup: true }), set(135), set(110, { drop: true }), set(135), set(140)]
    const fewer = removeWorkingSets(rows, 2)
    expect(kinds(fewer)).toBe('WSD')
    expect(workingRows(fewer)).toHaveLength(1)
    expect(kinds(removeWorkingSets(rows, 9))).toBe('WD')
  })
})
