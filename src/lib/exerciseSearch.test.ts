import { describe, expect, it } from 'vitest'
import { EXERCISES } from '../data/exercises'
import { closestExercises, matchesSearch, searchWords } from './exerciseSearch'

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

  it('knows the equipment: "chest press machine" is a machine chest press', () => {
    const found = find('chest press machine')
    expect(found).toContain('Leverage Chest Press')
    expect(found).not.toContain('Cable Chest Press')
  })
})

describe('the closest exercises, when nothing has every word', () => {
  const closest = (q: string) => closestExercises(EXERCISES, q).map((e) => e.name)

  it('get past typos', () => {
    expect(closest('dumbell shoulder press')[0]).toBe('Dumbbell Shoulder Press')
    expect(closest('romainian deadlift')[0]).toBe('Romanian Deadlift')
    expect(closest('deadlfit')[0]).toBe('Deadlift')
    expect(closest('leg extention')[0]).toBe('Leg Extension')
    expect(closest('dumbell shoulder pres')[0]).toBe('Dumbbell Shoulder Press')
  })

  it('get past extra words and other names', () => {
    expect(closest('seated cable row machine')[0]).toBe('Seated Cable Row')
    expect(closest('split squats dumbbell bench')[0]).toBe('Dumbbell Split Squat')
    expect(closest('stationary lunge dumbbells')[0]).toBe('Dumbbell Lunges')
    expect(closest('farmers walk')[0]).toBe('Farmer\'s Carry')
    expect(closest('chinups weighted')[0]).toBe('Chin-Up')
    expect(closest('bicep curl with dumbells')[0]).toBe('Dumbbell Curl')
  })

  it('offer what is nearest for something the list doesn\'t have, at most five, and nothing for gibberish', () => {
    const near = closest('landmine press')
    expect(near.length).toBeGreaterThan(0)
    expect(near.length).toBeLessThanOrEqual(5)
    expect(near.every((n) => /landmine|press/i.test(n))).toBe(true)
    expect(closest('zzzz')).toEqual([])
    expect(closest('  ')).toEqual([])
  })

  it('keep the order they were given in for equally close ones (favorites and recent ones first in the list)', () => {
    const squats = EXERCISES.filter((e) => /^(Box|Hack) Squat$/.test(e.name))
    expect(closestExercises(squats, 'sqaut').map((e) => e.name)).toEqual(squats.map((e) => e.name))
    expect(closestExercises([...squats].reverse(), 'sqaut').map((e) => e.name)).toEqual([...squats].reverse().map((e) => e.name))
  })
})
