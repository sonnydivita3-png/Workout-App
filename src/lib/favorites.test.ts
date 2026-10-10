import { afterEach, describe, expect, it } from 'vitest'
import { BODY_PARTS } from './bodyParts'
import { favoriteIds, setFavorites } from './favorites'
import { setMovePrefs } from './movePrefs'
import { generateWorkout } from './randomizer'
import { EXERCISES } from '../data/exercises'
import { BY_ID, mulberry32 } from './randomUtil'

const LEGS = ['Quads', 'Hamstrings', 'Glutes', 'Calves']
/** Share of `n` generated workouts that include `id`. */
const rate = (id: string, focus: string[], minutes = 50, n = 120) => {
  let hits = 0
  for (let seed = 1; seed <= n; seed++) if (generateWorkout(focus, minutes, { style: 'standard', rng: mulberry32(seed) }).some((p) => p.exerciseId === id)) hits++
  return hits / n
}

afterEach(() => { setFavorites([]); setMovePrefs({}) })

describe('favorite exercises in generated workouts', () => {
  it('turn up in most workouts that train their body part, but not every one', () => {
    const before = rate('Leg_Press', LEGS)
    setFavorites(['Leg_Press'])
    const legs = rate('Leg_Press', LEGS)
    expect(legs).toBeGreaterThan(Math.max(0.6, before + 0.4))
    expect(legs).toBeLessThan(0.97)
    // Full body (one exercise per part): a favorite beats the part's usual lift most times.
    const full = rate('Leg_Press', [...BODY_PARTS])
    expect(full).toBeGreaterThan(0.55)
    expect(full).toBeLessThan(0.97)
    // Not in a workout that doesn't train that part.
    expect(rate('Leg_Press', ['Chest', 'Back'])).toBe(0)
  })

  it('are in the running even when random workouts wouldn\'t usually pick them', () => {
    const odd = EXERCISES.find((e) => e.id === 'Drag_Curl')!
    expect(odd.suggest).toBe(false)
    expect(rate(odd.id, ['Biceps'], 30, 40)).toBe(0)
    setFavorites([odd.id])
    expect(rate(odd.id, ['Biceps'], 30, 40)).toBeGreaterThan(0.5)
  })

  it('a favorite still turns up when its kind is marked "Less"', () => {
    setMovePrefs({ machine: -1 })
    expect(rate('Leg_Press', LEGS, 50, 60)).toBe(0)
    setFavorites(['Leg_Press'])
    expect(rate('Leg_Press', LEGS, 50, 60)).toBeGreaterThan(0.5)
  })

  it('keeps only real ids, once each', () => {
    setFavorites(['Leg_Press', 'Leg_Press'])
    expect([...favoriteIds()]).toEqual(['Leg_Press'])
    setFavorites(undefined)
    expect(favoriteIds().size).toBe(0)
    expect(BY_ID.get('Leg_Press')?.equipment).toBe('Machine')
  })
})

describe('saved favorites', () => {
  it('the store stars and unstars, and repair keeps only ids, once each', async () => {
    const { useStore } = await import('../store')
    const { repairState } = await import('./migrate')
    useStore.setState({ favorites: [] })
    useStore.getState().toggleFavorite('Leg_Press')
    useStore.getState().toggleFavorite('Pullups')
    expect(useStore.getState().favorites).toEqual(['Leg_Press', 'Pullups'])
    expect([...favoriteIds()]).toEqual(['Leg_Press', 'Pullups'])
    useStore.getState().toggleFavorite('Leg_Press')
    expect(useStore.getState().favorites).toEqual(['Pullups'])
    useStore.setState({ favorites: [] })
    expect(repairState({ favorites: ['a', 'a', 3, null, 'b'] }, { favorites: [] }).favorites).toEqual(['a', 'b'])
    expect(repairState({ favorites: 'a' }, { favorites: [] }).favorites).toEqual([])
  })
})
