import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { PlannedExercise } from '../types'
import { generateWorkout, minutesFor, plannedFor, STYLES, swapExercise, type WorkoutStyle } from './randomizer'
import { mulberry32 } from './randomUtil'

const ex = (p: PlannedExercise) => BUILTIN_BY_ID.get(p.exerciseId)!
const gen = (style: WorkoutStyle, focus: string[], minutes: number, seed = 1) => generateWorkout(focus, minutes, { style, rng: mulberry32(seed) })
const blocks = (items: PlannedExercise[]) => {
  const out: Record<string, PlannedExercise[]> = {}
  for (const p of items) if (p.block) (out[p.block] ??= []).push(p)
  return out
}

describe('every style', () => {
  it('produces unique, known exercises within the time budget', () => {
    for (const s of STYLES) {
      for (const minutes of [20, 30, 45, 60, 90]) {
        for (let seed = 1; seed <= 25; seed++) {
          const w = gen(s.id, s.focus === 'required' ? ['Chest', 'Back', 'Legs'] : [], minutes, seed)
          expect(w.length, `${s.id} ${minutes}min seed ${seed}`).toBeGreaterThan(0)
          expect(new Set(w.map((p) => p.exerciseId)).size).toBe(w.length)
          for (const p of w) expect(BUILTIN_BY_ID.has(p.exerciseId), p.exerciseId).toBe(true)
          expect(minutesFor(w), `${s.id} ${minutes}min seed ${seed}`).toBeLessThanOrEqual(minutes + 8)
        }
      }
    }
  })
  it('is reproducible with a seed', () => {
    for (const s of STYLES) expect(gen(s.id, ['Chest', 'Legs'], 45, 7)).toEqual(gen(s.id, ['Chest', 'Legs'], 45, 7))
  })
})

describe('strength', () => {
  it('uses heavy compounds with low reps and 4+ sets', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const w = gen('strength', ['Chest', 'Back', 'Legs'], 60, seed)
      for (const p of w) {
        expect(p.sets).toBeGreaterThanOrEqual(4)
        expect(p.reps!).toBeLessThanOrEqual(6)
        expect(ex(p).mode).toBe('weight')
      }
    }
  })
})

describe('supersets', () => {
  it('pairs exercises into two-item blocks sharing a label', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const w = gen('supersets', ['Chest', 'Back', 'Arms', 'Legs'], 45, seed)
      const b = blocks(w)
      expect(Object.keys(b).length).toBeGreaterThan(0)
      for (const items of Object.values(b)) {
        expect(items).toHaveLength(2)
        expect(items[0].sets).toBe(items[1].sets)
        expect(items[0].blockLabel).toMatch(/^Superset \d/)
      }
      // pair members are adjacent in the list
      w.forEach((p, i) => { if (p.block && w[i + 1]?.block !== p.block) expect(w[i - 1]?.block).toBe(p.block) })
    }
  })
  it('prefers opposing muscle groups for a chest + back day', () => {
    let opposed = 0
    for (let seed = 1; seed <= 30; seed++) {
      for (const items of Object.values(blocks(gen('supersets', ['Chest', 'Back'], 45, seed)))) {
        if (new Set(items.map((p) => ex(p).group)).size === 2) opposed++
      }
    }
    expect(opposed).toBeGreaterThan(30)
  })
  it('uses most of the time available', () => {
    for (const minutes of [30, 45, 60]) expect(minutesFor(gen('supersets', ['Chest', 'Back', 'Legs', 'Arms'], minutes, 4))).toBeGreaterThan(minutes * 0.8)
  })
  it('fits more exercises than straight sets in the same time', () => {
    const avg = (s: WorkoutStyle) => Array.from({ length: 30 }, (_, i) => gen(s, ['Chest', 'Back', 'Legs', 'Arms'], 45, i + 1).length).reduce((a, b) => a + b, 0) / 30
    expect(avg('supersets')).toBeGreaterThan(avg('standard'))
  })
})

describe('HIIT circuit', () => {
  it('is one timed block with rounds, intervals and a full-body mix by default', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const w = gen('circuit', [], 30, seed)
      expect(new Set(w.map((p) => p.block))).toEqual(new Set(['circuit']))
      expect(w.length).toBeGreaterThanOrEqual(4)
      expect(new Set(w.map((p) => p.sets)).size).toBe(1) // same rounds for every station
      expect(w[0].blockLabel).toMatch(/HIIT circuit · \d rounds · 40s on \/ 20s off/)
      expect(new Set(w.map((p) => ex(p).group)).size).toBeGreaterThan(2)
      for (let i = 1; i < w.length; i++) if (w.length > 4) expect(ex(w[i]).group === ex(w[i - 1]).group, `back-to-back same group, seed ${seed}`).toBe(false)
    }
  })
  it('respects a chosen body part and adds cardio when asked', () => {
    const w = gen('circuit', ['Legs', 'Cardio'], 45, 3)
    expect(ex(w.at(-1)!).kind).toBe('cardio')
    for (const p of w.filter((p) => p.block === 'circuit')) expect(['Legs', 'Conditioning']).toContain(ex(p).group)
  })
})

describe('PHA', () => {
  const upper = new Set(['Chest', 'Back', 'Shoulders', 'Arms'])
  it('strictly alternates upper and lower body, with roughly equal halves', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const w = gen('pha', ['Chest', 'Back', 'Legs', 'Glutes'], 45, seed)
      expect(w.every((p) => p.block === 'pha' && p.note === 'no rest')).toBe(true)
      expect(w[0].blockLabel).toMatch(/^PHA circuit · \d rounds/)
      const seq = w.map((p) => (upper.has(ex(p).group) ? 'U' : 'L'))
      for (let i = 1; i < seq.length; i++) expect(seq[i], `seed ${seed}: ${seq.join('')}`).not.toBe(seq[i - 1])
    }
  })
  it('uses most of the time available', () => {
    for (const minutes of [30, 45, 60]) expect(minutesFor(gen('pha', [], minutes, 5))).toBeGreaterThan(minutes * 0.8)
  })
})

describe('Hyrox-style', () => {
  it('runs then stations in the real order, scaled to the time', () => {
    const order = ['x-skierg', 'x-sled-push', 'x-sled-pull', 'x-burpee-broad-jump', 'x-row-erg', 'x-farmers-carry', 'x-sandbag-lunges', 'x-wall-balls']
    for (const minutes of [20, 30, 45, 60, 90]) {
      const w = gen('hyrox', [], minutes)
      expect(w[0].exerciseId).toBe('running')
      const stations = w.slice(1).map((p) => p.exerciseId)
      expect(stations).toEqual(order.slice(0, stations.length))
      expect(stations.length).toBeGreaterThanOrEqual(3)
      expect(w.every((p) => p.note && p.blockLabel?.startsWith('Hyrox-style'))).toBe(true)
      expect(minutesFor(w)).toBeLessThanOrEqual(minutes + 6)
    }
  })
  it('does a full eight stations when there is time and shrinks distances when there is not', () => {
    expect(gen('hyrox', [], 90).length).toBe(9) // run + 8 stations
    expect(gen('hyrox', [], 20).length).toBeLessThan(9)
    const dist = (min: number) => parseInt(gen('hyrox', [], min).find((p) => p.exerciseId === 'x-skierg')!.note!)
    expect(dist(30)).toBeLessThan(dist(90))
  })
})

describe('CrossFit-style', () => {
  it('has a WOD block with a clear format, and a strength primer for long sessions', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const short = gen('crossfit', [], 30, seed)
      expect(short.some((p) => /AMRAP|EMOM|rounds for time/.test(p.blockLabel ?? ''))).toBe(true)
      expect(short.some((p) => p.block === 'primer')).toBe(false)
      const long = gen('crossfit', [], 60, seed)
      expect(long[0].block).toBe('primer')
      expect(ex(long[0]).equipment).toBe('Barbell')
      expect(long.filter((p) => p.block !== 'primer').length).toBeGreaterThanOrEqual(3)
    }
  })
  it('EMOM assigns one movement per minute', () => {
    const emoms = Array.from({ length: 80 }, (_, i) => gen('crossfit', [], 30, i + 1)).filter((w) => /EMOM/.test(w[0].blockLabel ?? ''))
    expect(emoms.length).toBeGreaterThan(0)
    for (const w of emoms) w.forEach((p, i) => expect(p.note).toContain(`minute ${i + 1} of ${w.length}`))
  })
})

describe('strength lifts and primers are classic main lifts', () => {
  it('no isolation or odd variants', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const p of gen('strength', ['Chest', 'Back', 'Legs', 'Shoulders'], 60, seed)) expect(ex(p).name).toMatch(/squat|deadlift|press|row|pull|chin|thrust|lunge|dip/i)
      const primer = gen('crossfit', [], 60, seed)[0]
      expect(primer.block).toBe('primer')
      expect(ex(primer).name).toMatch(/squat|deadlift|press|row|pull|chin|thrust|lunge|dip/i)
      expect(ex(primer).name).not.toMatch(/rear delt|curl|raise|fly/i)
    }
  })
})

describe('bodyweight', () => {
  it('has sane rep targets (no 20 pull-ups) and skips advanced moves', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const p of gen('bodyweight', ['Chest', 'Back', 'Legs', 'Core'], 45, seed)) {
        expect(ex(p).name).not.toMatch(/single-arm|one-arm|pistol|freehand jump/i)
        if (/pull-?up|chin-?up|dip/i.test(ex(p).name)) expect(p.reps!).toBeLessThanOrEqual(10)
      }
    }
  })
  it('uses no equipment', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const p of gen('bodyweight', ['Chest', 'Back', 'Legs', 'Core', 'Shoulders'], 45, seed)) {
        expect(ex(p).equipment, ex(p).name).toBe('Bodyweight')
        expect(ex(p).mode).not.toBe('weight')
      }
    }
  })
})

describe('editing structured workouts', () => {
  it('replacing a superset member keeps the block, and a circuit keeps its interval note', () => {
    const ss = gen('supersets', ['Chest', 'Back'], 45)
    const r = swapExercise(ss, 0, mulberry32(3))
    expect(r[0].block).toBe(ss[0].block)
    expect(r[0].blockLabel).toBe(ss[0].blockLabel)
    expect(r[0].exerciseId).not.toBe(ss[0].exerciseId)

    const c = gen('circuit', [], 30)
    const swapped = plannedFor(BUILTIN_BY_ID.get('Pushups')!, c[0], mulberry32(1))
    expect(swapped.note).toBe('40s on / 20s off')
    expect(swapped.block).toBe('circuit')
    expect(swapped.reps).toBeUndefined()
  })
  it('a Hyrox station swap does not inherit the old distance', () => {
    const h = gen('hyrox', [], 45)
    const s = plannedFor(BUILTIN_BY_ID.get('Pushups')!, h[1], mulberry32(1))
    expect(s.note).toBeUndefined()
    expect(s.block).toBe('hyrox')
  })
})

describe('AMRAP, EMOM and for time', () => {
  it('produce timed blocks whose items all carry the same format', () => {
    for (const kind of ['amrap', 'emom', 'fortime'] as const) {
      for (const minutes of [10, 20, 45, 75]) {
        for (let seed = 1; seed <= 15; seed++) {
          const w = gen(kind, [], minutes, seed)
          expect(w.every((p) => p.wod?.kind === kind), `${kind} ${minutes}`).toBe(true)
          for (const items of Object.values(blocks(w))) {
            expect(new Set(items.map((p) => JSON.stringify(p.wod))).size).toBe(1)
            expect(items.length).toBeGreaterThanOrEqual(2)
          }
          if (kind === 'emom') for (const items of Object.values(blocks(w))) expect(items[0].wod!.minutes % items.length).toBe(0)
          if (kind === 'fortime') expect(w[0].wod!.rounds).toBeGreaterThanOrEqual(3)
        }
      }
    }
  })
  it('respects body-part focus when there is one', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = gen('amrap', ['Legs'], 20, seed)
      expect(w.length).toBeGreaterThan(1)
      for (const p of w) expect(ex(p).group).toBe('Legs')
    }
  })
})
