import { describe, expect, it } from 'vitest'
import { cardioSession, sessionsFor, tabataMinutes, tabataRounds } from './cardioSession'
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
  it('Tabata: 20s / 10s or 30s / 90s, as many rounds as picked; warm-up and cool-down on top of the work', () => {
    // The classic by default: 8 rounds, 4 minutes of work, 5 easy before and after, whatever time was picked.
    for (const picked of [10, 30, 60]) {
      const t = cardioSession('x-air-bike', 'tabata', picked)
      expect(t.note).toBe('Tabata · 5 min easy, building up · 8 × 20s all-out / 10s easy spin (4 min) · 5 min easy')
      expect(t.minutes).toBe(14)
      expect(t.est).toBe(14)
    }
    const four = cardioSession('running', 'tabata', 30, { tabata: 'tabata', rounds: 4 })
    expect(four.note).toBe('Tabata · 5 min easy, building up · 4 × 20s all-out / 10s easy jog (2 min) · 5 min easy')
    expect(four.minutes).toBe(12)
    expect(cardioSession('running', 'tabata', 30, { rounds: 5 }).note).toContain('5 × 20s all-out / 10s easy jog (2:30)')
    // Sprints: 30 s on, 90 s easy after each but the last (4 sprints, the usual: 2 + 4.5 = 6.5 minutes).
    const sprint = cardioSession('x-row-erg', 'tabata', 30, { tabata: 'sprint' })
    expect(sprint.note).toBe('Sprint intervals · 5 min easy, building up · 4 × 30s all-out / 90s light paddle · 5 min easy')
    expect(sprint.minutes).toBe(16.5)
    expect(cardioSession('x-row-erg', 'tabata', 30, { tabata: 'sprint', rounds: 6 }).minutes).toBe(5 + 3 + 7.5 + 5)
    expect(tabataMinutes('tabata', 8)).toBe(14)
    expect(tabataMinutes('sprint', 5)).toBe(5 + 2.5 + 6 + 5)
    // Out of range or unknown: the usual for the format.
    expect(tabataRounds('tabata', 12)).toBe(8)
    expect(tabataRounds('tabata', 1)).toBe(8)
    expect(tabataRounds('sprint', 2.5)).toBe(4)
    expect(tabataRounds('bogus', 3)).toBe(3)
    expect(cardioSession('x-air-bike', 'tabata', 30, { tabata: 'bogus' as never, rounds: 99 }).minutes).toBe(14)
    // Not where it can't switch to all-out in a second: walks, swims and treadmills.
    for (const id of ['walking', 'swimming', 'Running_Treadmill']) {
      expect(sessionsFor(id), id).not.toContain('tabata')
      expect(cardioSession(id, 'tabata', 30).note, id).toMatch(/^Steady/)
    }
    for (const id of ['running', 'x-air-bike', 'x-row-erg', 'x-skierg', 'Rope_Jumping']) expect(sessionsFor(id), id).toContain('tabata')
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
