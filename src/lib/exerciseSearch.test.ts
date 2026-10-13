import { describe, expect, it } from 'vitest'
import { EXERCISES } from '../data/exercises'
import { matchesSearch, searchWords } from './exerciseSearch'

const find = (q: string) => EXERCISES.filter((e) => matchesSearch(e, searchWords(q))).map((e) => e.name)

describe('searching the exercise list', () => {
  it('finds a lift by what most people call it: "dumbbell overhead press" is a dumbbell shoulder press', () => {
    const found = find('dumbbell overhead press')
    for (const name of ['Dumbbell Shoulder Press', 'Seated Dumbbell Press', 'Standing Dumbbell Press', 'Arnold Dumbbell Press']) expect(found, name).toContain(name)
    expect(found).not.toContain('Incline Dumbbell Press') // a chest press
    for (const q of ['ohp', 'overhead press', 'shoulder press', 'military press']) expect(find(q), q).toContain('Overhead Press')
  })

  it('finds the singular from a plural, and by muscle group', () => {
    expect(find('hammer curls')).toContain('Hammer Curl')
    expect(find('lunges')).toContain('Walking Lunge')
    expect(find('bicep curl')).toContain('Barbell Curl')
    expect(find('hamstring curl').some((n) => /Leg Curl/.test(n))).toBe(true)
    expect(find('abs')).toContain('Plank')
    expect(find('chest flies')).toContain('Dumbbell Fly')
  })

  it('knows skater hops, under either name', () => {
    expect(find('skater hops')).toEqual(['Skater Hops'])
    expect(find('skaters')).toContain('Skater Hops')
    expect(find('lateral bound')).toContain('Skater Hops')
  })

  it('still needs every word', () => {
    expect(find('leg press')).not.toContain('Back Squat')
    expect(find('zzz')).toEqual([])
  })
})
