import { describe, expect, it } from 'vitest'
import { cardioSession, sessionsFor } from './cardioSession'
import { generateWorkout, type WorkoutStyle } from './randomizer'
import { BY_ID, mulberry32 } from './randomUtil'

describe('cardio sessions', () => {
  it('writes intervals, tempo, hills and time trials for the activity, filling the time', () => {
    const iv = cardioSession('Running_Treadmill', 'intervals', 30)
    expect(iv).toMatchObject({ exerciseId: 'Running_Treadmill', minutes: 30 })
    expect(iv.note).toBe('Intervals · 6 min easy · 4 × 2 min hard (about 5K race effort) / 2 min easy jog or walk · 8 min easy')
    expect(cardioSession('running', 'hills', 40).note).toMatch(/× 60s hard up a hill/)
    expect(cardioSession('Running_Treadmill', 'hills', 40).note).toMatch(/at 6–8% incline/)
    expect(cardioSession('x-row-erg', 'trial', 20).note).toMatch(/2,000 m for time/)
    expect(cardioSession('running', 'trial', 45).note).toMatch(/5K for time/)
    expect(cardioSession('running', 'tempo', 45).note).toMatch(/^Tempo · 9 min easy · 2 × \d+ min comfortably hard/)
    expect(cardioSession('swimming', 'steady', 30).note).toMatch(/swimming/)
  })
  it('only offers hills where there is a hill, incline or resistance', () => {
    expect(sessionsFor('running')).toContain('hills')
    expect(sessionsFor('x-row-erg')).not.toContain('hills')
    expect(cardioSession('x-row-erg', 'hills', 30).note).toMatch(/^Steady/)
  })
})

describe('cardio on its own is always cardio', () => {
  // The bug: Cardio + Timed made a bodyweight circuit with one cardio station instead of a run.
  const styles: WorkoutStyle[] = ['standard', 'strength', 'supersets', 'bodyweight', 'circuit', 'pha', 'amrap', 'emom', 'fortime', 'tabata']
  it.each(styles)('Cardio with %s and no body parts gives a cardio session', (style) => {
    for (let seed = 1; seed <= 5; seed++) {
      const w = generateWorkout(['Cardio'], 30, { style, rng: mulberry32(seed), cardio: { exerciseId: 'running' } })
      expect(w.length).toBeGreaterThan(0)
      expect(w.every((p) => BY_ID.get(p.exerciseId)?.kind === 'cardio')).toBe(true)
      expect(w[0].exerciseId).toBe('running')
    }
  })
  it('timed and HIIT styles become intervals, "for time" a time trial', () => {
    expect(generateWorkout(['Cardio'], 30, { style: 'emom', rng: mulberry32(1) })[0].note).toMatch(/^Intervals/)
    expect(generateWorkout(['Cardio'], 30, { style: 'fortime', rng: mulberry32(1) })[0].note).toMatch(/^Time trial/)
  })
  it('a chosen session type is used as a finisher after lifting too', () => {
    const w = generateWorkout(['Chest', 'Cardio'], 50, { styles: ['standard'], rng: mulberry32(2), cardioMinutes: 20, minutesByStyle: { standard: 30 }, cardio: { exerciseId: 'x-row-erg', kind: 'intervals' } })
    const last = w.at(-1)!
    expect(last).toMatchObject({ exerciseId: 'x-row-erg', minutes: 20 })
    expect(last.note).toMatch(/^Intervals/)
  })
})
