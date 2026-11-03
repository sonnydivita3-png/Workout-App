import { describe, expect, it } from 'vitest'
import { shownLabels } from './blockLabels'

describe('superset headings on a day', () => {
  it('two workouts that each start at "Superset 1" read 1 and 2, in order', () => {
    expect(shownLabels(['Superset 1 · alternate the two', undefined, 'Superset 1 · squat + pull'])).toEqual(['Superset 1 · alternate the two', undefined, 'Superset 2 · squat + pull'])
  })
  it('a run already in order is left as it is, and other blocks keep their own labels', () => {
    const day = ['Superset 1 · squat + pull', 'HIIT circuit · 5 rounds', 'Superset 2 · hinge + push']
    expect(shownLabels(day)).toEqual(day)
  })
  it('supersets made by hand ("Superset") get numbers once there are two', () => {
    expect(shownLabels(['Superset', 'Superset · 3 exercises (giant set)'])).toEqual(['Superset 1', 'Superset 2 · 3 exercises (giant set)'])
  })
  it('one superset keeps its label', () => {
    expect(shownLabels(['Superset', undefined])).toEqual(['Superset', undefined])
  })
})
