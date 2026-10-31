import { describe, expect, it } from 'vitest'
import { inclineOf, sessionOf, type CardioSetup } from './cardioSetup'

const setup = (p: Partial<CardioSetup>): CardioSetup => ({ activities: ['running'], where: 'out', session: 'steady', split: false, ...p })

describe('the cardio session actually picked', () => {
  it('is the saved one only where it is offered, else steady (what the picker shows)', () => {
    expect(sessionOf(setup({ session: 'tabata' }))).toBe('tabata')
    // Tabata picked for an outside run, then moved to the treadmill: steady, not a Tabata note.
    expect(sessionOf(setup({ session: 'tabata', where: 'in' }))).toBe('steady')
    expect(sessionOf(setup({ activities: ['walking'], session: 'tabata' }))).toBe('steady')
    // Several activities share steady time; any activity can't do hills.
    expect(sessionOf(setup({ activities: ['running', 'cycling'], session: 'intervals' }))).toBe('steady')
    expect(sessionOf(setup({ activities: [], session: 'hills' }))).toBe('steady')
    expect(sessionOf(setup({ activities: [], session: 'tabata' }))).toBe('tabata')
  })
  it('a treadmill incline counts unless the session is really hills', () => {
    expect(inclineOf(setup({ where: 'in', incline: 6 }))).toBe(6)
    expect(inclineOf(setup({ where: 'in', incline: 6, session: 'hills' }))).toBe(0)
    expect(inclineOf(setup({ where: 'out', incline: 6 }))).toBe(0)
  })
})
