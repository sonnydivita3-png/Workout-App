import { describe, expect, it } from 'vitest'
import { generateHyrox } from './functionalStyles'
import { hyroxRoute, isHyroxBlock } from './hyrox'
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
