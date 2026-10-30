import { existsSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EXERCISES } from '../data/exercises'
import { demoIds, hasDemo } from './moveDemos'

describe('warm-up move demos', () => {
  it('every mobility move a warm-up can pick has a start and end picture, bundled with the app', () => {
    const mobility = EXERCISES.filter((e) => e.tags?.includes('mobility')).map((e) => e.id)
    expect(mobility.length).toBeGreaterThan(10)
    for (const id of mobility) expect(hasDemo(id), id).toBe(true)
    for (const id of demoIds()) for (const n of [0, 1]) {
      const file = `public/moves/${id}-${n}.webp`
      expect(existsSync(file), file).toBe(true)
      // Small enough to keep offline (the service worker caches them).
      expect(statSync(file).size, file).toBeLessThan(40_000)
    }
  })
})
