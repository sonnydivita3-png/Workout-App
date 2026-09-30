import { describe, expect, it } from 'vitest'
import type { PlannedExercise } from '../types'
import { combine, moveInGroup, moveUnit, removeFromGroup, ungroup, unitsOf } from './arrange'

const p = (id: string, extra: Partial<PlannedExercise> = {}): PlannedExercise => ({ exerciseId: id, sets: 3, ...extra })
const ids = (items: PlannedExercise[]) => items.map((x) => x.exerciseId).join(',')
const shape = (items: PlannedExercise[]) => unitsOf(items).map((u) => u.items.map((x) => x.item.exerciseId).join('+')).join(' | ')

describe('arranging a day', () => {
  const day = [p('a'), p('b'), p('c'), p('d')]

  it('moves exercises up and down, and not past the ends', () => {
    expect(ids(moveUnit(day, 2, -1))).toBe('a,c,b,d')
    expect(ids(moveUnit(day, 0, -1))).toBe('a,b,c,d')
    expect(ids(moveUnit(day, 3, 1))).toBe('a,b,c,d')
  })

  it('combines any number of exercises into a superset where the first one was', () => {
    const two = combine(day, [1, 3])
    expect(shape(two)).toBe('a | b+d | c')
    expect(two[1].blockLabel).toBe('Superset')
    const four = combine(day, [0, 1, 2, 3])
    expect(shape(four)).toBe('a+b+c+d')
    expect(four[0].blockLabel).toMatch(/4 exercises/)
    expect(ids(combine(day, [2]))).toBe('a,b,c,d')
  })

  it('adds more exercises to an existing superset, and keeps block ids unique', () => {
    const ss = combine(day, [0, 1])
    const bigger = combine(ss, [0, 2]) // the superset (unit 0) plus d
    expect(shape(bigger)).toBe('a+b+d | c')
    const second = combine(combine(day, [0, 1]), [1, 2])
    expect(new Set(second.map((x) => x.block).filter(Boolean)).size).toBe(2)
  })

  it('moves a superset as a whole, and reorders inside it', () => {
    const ss = combine(day, [1, 2]) // a | b+c | d
    expect(shape(moveUnit(ss, 1, 1))).toBe('a | d | b+c')
    expect(shape(moveInGroup(ss, 1, 0, 1))).toBe('a | c+b | d')
  })

  it('ungroups, and takes single exercises out', () => {
    const ss = combine(day, [0, 1, 2]) // a+b+c | d
    expect(shape(ungroup(ss, 0))).toBe('a | b | c | d')
    expect(ungroup(ss, 0)[0].block).toBeUndefined()
    const out = removeFromGroup(ss, 0, 1)
    expect(shape(out)).toBe('a+c | b | d')
    expect(out[0].blockLabel).toBe('Superset')
    expect(shape(removeFromGroup(out, 0, 0))).toBe('c | a | b | d')
  })

  it('leaves warm-ups and timed blocks out of supersets', () => {
    const mixed = [p('w', { warmup: true, block: 'warmup' }), p('x'), p('t', { block: 'amrap', wod: { kind: 'amrap', minutes: 10 } }), p('y')]
    expect(shape(combine(mixed, [0, 1]))).toBe('w | x | t | y')
    expect(shape(combine(mixed, [1, 2, 3]))).toBe('w | x+y | t')
  })
})
