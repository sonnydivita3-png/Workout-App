import { describe, expect, it } from 'vitest'
import { generateHyrox } from './functionalStyles'
import { hyroxRoute, isHyroxBlock, runsAs } from './hyrox'
import { mulberry32 } from './randomUtil'

describe('the Hyrox route', () => {
  it('is the run card and the stations in order, a run before each, once through', () => {
    const items = generateHyrox(60, mulberry32(1))
    const { run, runM, stations } = hyroxRoute(items.map((item, index) => ({ item, index })))
    expect(run?.index).toBe(0)
    expect(stations).toHaveLength(items.length - 1)
    expect(runM).toBeGreaterThanOrEqual(200)
    expect(items[0].blockLabel).toContain(`${stations.length} × (${runM} m run + station)`)
  })
  it('works for older or hand-made blocks that just start with a run, and spots Hyrox parts of mixed workouts', () => {
    const label = 'Hyrox-style · 2 × (500 m run + station)'
    const items = [{ exerciseId: 'running', sets: 1, minutes: 5, blockLabel: label }, { exerciseId: 'x-row-erg', sets: 1, note: '500 m', blockLabel: label }]
    expect(hyroxRoute(items.map((item, index) => ({ item, index })))).toMatchObject({ runM: 500, stations: [{ index: 1 }] })
    expect(isHyroxBlock('hyrox')).toBe(true)
    expect(isHyroxBlock('hyrox-hyrox')).toBe(true)
    expect(isHyroxBlock('ss1')).toBe(false)
  })
})

describe('a long Hyrox (past a full race)', () => {
  const run = (items: ReturnType<typeof generateHyrox>) => hyroxRoute(items.map((item, index) => ({ item, index })))
  it('fills 2.5 hours with longer runs and bigger stations, still 8 stations once through', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const items = generateHyrox(142, mulberry32(seed))
      const { runM, stations } = run(items)
      expect(stations).toHaveLength(8)
      expect(runM).toBeGreaterThan(1000)
      expect(runM).toBeLessThanOrEqual(2500)
      const mins = items.reduce((a, p) => a + (p.est ?? 0), 0)
      expect(mins).toBeGreaterThan(130)
      expect(mins).toBeLessThan(150)
      // Stations at most half again their race size: 150 wall balls, not 300.
      expect(items.find((p) => p.exerciseId === 'x-wall-balls')?.note).toMatch(/^1[0-5]\d reps$/)
      expect(new Set(items.map((p) => p.exerciseId)).size).toBe(items.length)
    }
  })
  it('stays race size at about a race length, and shrinks for shorter ones as before', () => {
    expect(run(generateHyrox(77, mulberry32(1))).runM).toBe(1000)
    expect(run(generateHyrox(40, mulberry32(1))).runM).toBeLessThan(1000)
  })
})

describe('how the runs are done', () => {
  it('says where, not a list of two kinds of run', () => {
    expect(runsAs('Running')).toBe('running')
    expect(runsAs('Running, Treadmill')).toBe('running on a treadmill')
    expect(runsAs('Jogging, Treadmill')).toBe('jogging on a treadmill')
  })
})
