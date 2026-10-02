import { afterEach, describe, expect, it } from 'vitest'
import { generateWorkout, pairScore } from './randomizer'
import { BY_ID, familyOf, mulberry32 } from './randomUtil'
import { fixedStations, walkCost } from './stations'
import { matchesMove, movePrefsSummary, setMovePrefs, type MovePrefs, type MoveType } from './movePrefs'
import type { PlannedExercise } from '../types'

const ex = (id: string) => BY_ID.get(id)!
const FOCUS = [['Chest', 'Back'], ['Quads', 'Hamstrings', 'Glutes'], ['Shoulders', 'Biceps', 'Triceps'], ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings', 'Glutes', 'Biceps', 'Triceps', 'Calves', 'Core']]

const pairsOf = (w: PlannedExercise[]) => {
  const out: [PlannedExercise, PlannedExercise][] = []
  for (let i = 0; i < w.length - 1; i++) if (w[i].block?.startsWith('ss') && w[i + 1].block === w[i].block) out.push([w[i], w[++i]])
  return out
}

afterEach(() => setMovePrefs({}))

describe('supersets you can do in one spot', () => {
  it('pairs rarely need a walk across the gym, and say where to do them', () => {
    let pairs = 0
    let far = 0
    let labelled = 0
    for (let seed = 1; seed <= 120; seed++) {
      const w = generateWorkout(FOCUS[seed % 4], 45, { style: 'supersets', rng: mulberry32(seed) })
      for (const [a, b] of pairsOf(w)) {
        pairs++
        if (walkCost(ex(a.exerciseId), ex(b.exerciseId)) >= 3) far++
        if (/stay at|take your|one barbell|just your|no equipment|stay by/.test(a.blockLabel ?? '')) labelled++
      }
    }
    expect(pairs).toBeGreaterThan(300)
    expect(far / pairs).toBeLessThan(0.03)
    expect(labelled / pairs).toBeGreaterThan(0.6)
  })

  it('prefers opposing muscles at the same station over walking, and never the same muscle twice', () => {
    expect(pairScore(ex('Triceps_Pushdown'), ex('Standing_Biceps_Cable_Curl'))).toBeGreaterThan(pairScore(ex('Triceps_Pushdown'), ex('Bent_Over_Barbell_Row')))
    expect(pairScore(ex('Leg_Extensions'), ex('Lying_Leg_Curls'))).toBeGreaterThan(pairScore(ex('Leg_Press'), ex('Lying_Leg_Curls')))
    expect(pairScore(ex('Dumbbell_Bench_Press'), ex('Barbell_Bench_Press_-_Medium_Grip'))).toBeLessThan(0)
  })
})

describe('circuits that stay in one area', () => {
  it('HIIT and PHA use portable gear and floor moves plus at most one fixed station', () => {
    for (const style of ['pha', 'circuit'] as const) {
      for (let seed = 1; seed <= 60; seed++) {
        const w = generateWorkout(FOCUS[seed % 3], 40, { style, rng: mulberry32(seed) }).filter((p) => p.block === style)
        const strength = w.map((p) => ex(p.exerciseId)).filter((e) => e.kind === 'strength')
        expect(fixedStations(strength).size, `${style} ${seed}`).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('timed workouts that stay in one area', () => {
  it('AMRAP, EMOM, for time, Tabata and CrossFit WODs: one fixed station at most, no movement twice', () => {
    for (const style of ['amrap', 'emom', 'fortime', 'tabata', 'crossfit'] as const) {
      for (let seed = 1; seed <= 60; seed++) {
        const w = generateWorkout([[], ['Chest', 'Back'], ['Quads', 'Hamstrings', 'Glutes']][seed % 3], 40, { style, rng: mulberry32(seed) })
        const pieces = new Map<string, string[]>()
        for (const p of w) if (p.wod || p.block === 'tabata') pieces.set(p.block!, [...(pieces.get(p.block!) ?? []), p.exerciseId])
        for (const ids of pieces.values()) {
          const moves = ids.map(ex).filter((e) => e.kind === 'strength')
          expect(fixedStations(moves).size, `${style} ${seed}`).toBeLessThanOrEqual(1)
          const fams = moves.map(familyOf).filter(Boolean)
          expect(new Set(fams).size, `${style} ${seed}`).toBe(fams.length)
        }
      }
    }
  })
})

describe('exercise types you prefer', () => {
  const share = (prefs: MovePrefs, kind: MoveType) => {
    setMovePrefs(prefs)
    let n = 0
    let total = 0
    for (let seed = 1; seed <= 80; seed++) {
      for (const style of ['standard', 'supersets'] as const) {
        for (const p of generateWorkout(FOCUS[seed % 4], 50, { style, rng: mulberry32(seed) })) {
          const e = ex(p.exerciseId)
          if (e.kind !== 'strength') continue
          total++
          if (matchesMove(kind, e)) n++
        }
      }
    }
    return n / total
  }

  it('"Less" machines and cables leaves them out when there are other options', () => {
    expect(share({}, 'machine') + share({}, 'cable')).toBeGreaterThan(0.1)
    expect(share({ machine: -1, cable: -1 }, 'machine')).toBe(0)
    expect(share({ machine: -1, cable: -1 }, 'cable')).toBe(0)
  })

  it('"More" leans towards a kind without taking over', () => {
    const before = share({}, 'unilateral')
    const after = share({ unilateral: 1 }, 'unilateral')
    expect(after).toBeGreaterThan(before * 3)
    expect(after).toBeLessThan(0.65)
    expect(share({ compound: 1, isolation: -1 }, 'isolation')).toBeLessThan(share({}, 'isolation'))
    expect(share({ bodyweight: 1 }, 'bodyweight')).toBeGreaterThan(share({}, 'bodyweight') * 2)
  })

  it('ignores unknown or broken saved values, and sums up the choice', () => {
    setMovePrefs({ nonsense: 1, free: 5, machine: -1 } as unknown as MovePrefs)
    expect(share({ ...({ nonsense: 1 } as MovePrefs) }, 'free')).toBeGreaterThan(0)
    expect(movePrefsSummary({ free: 1, unilateral: 1, machine: -1 })).toBe('More free weights, one arm / one leg · less machines')
    expect(movePrefsSummary({ cable: -1 })).toBe('Less cables')
    expect(movePrefsSummary({ free: 0 })).toBeNull()
  })
})
