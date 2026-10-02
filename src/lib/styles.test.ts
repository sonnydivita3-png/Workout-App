import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { PlannedExercise } from '../types'
import { generateWorkout, liftsMinutes, minutesFor, plannedFor, STYLES, swapExercise, type WorkoutStyle } from './randomizer'
import { mulberry32 } from './randomUtil'
import { withGearFor } from './equipment'
import { withCardioFor } from './cardioPrefs'

const ex = (p: PlannedExercise) => BUILTIN_BY_ID.get(p.exerciseId)!
const gen = (style: WorkoutStyle, focus: string[], minutes: number, seed = 1) => generateWorkout(focus, minutes, { style, rng: mulberry32(seed) })
/** Hyrox and CrossFit sessions start with their own warm-up; most checks are about what comes after it. */
const main = (w: PlannedExercise[]) => w.filter((p) => !p.warmup)
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
  it('starts with heavy main lifts (3-6 reps, 4+ sets), then lighter accessories', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const w = gen('strength', ['Chest', 'Back', 'Legs'], 60, seed)
      const heavy = w.filter((p) => (p.reps ?? 99) <= 6 && p.sets >= 4)
      expect(heavy.length, `seed ${seed}`).toBeGreaterThanOrEqual(1)
      expect(w.indexOf(heavy[0])).toBe(0)
      for (const p of heavy) expect(ex(p).mode).toBe('weight')
      for (const p of w.slice(heavy.length)) expect(p.reps ?? 0).toBeGreaterThanOrEqual(6)
    }
  })
})

describe('workouts fill the time you ask for (realistic timing: work + rest + setup)', () => {
  const focusSets = [['Chest', 'Back', 'Legs'], ['Legs'], ['Chest', 'Arms'], ['Shoulders', 'Core']]
  for (const style of ['standard', 'strength', 'bodyweight', 'supersets'] as WorkoutStyle[]) {
    it(style, () => {
      for (const minutes of [20, 30, 45, 60, 90]) {
        for (const focus of focusSets) {
          for (let seed = 1; seed <= 8; seed++) {
            const w = gen(style, focus, minutes, seed)
            const real = liftsMinutes(w)
            const label = `${style} ${focus.join('+')} ${minutes}min seed ${seed}: ${Math.round(real)} min`
            expect(real, label).toBeGreaterThanOrEqual(minutes * 0.85)
            expect(real, label).toBeLessThanOrEqual(minutes * 1.1)
            expect(Math.abs(minutesFor(w) - real), 'estimate matches the model').toBeLessThan(0.6)
          }
        }
      }
    })
  }
  it('a 30-minute strength workout is more than two lifts of 4 sets', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = gen('strength', ['Chest', 'Legs'], 30, seed)
      expect(w.reduce((a, p) => a + p.sets, 0), `seed ${seed}`).toBeGreaterThan(8)
    }
  })
  it('shorter rest fits more work into the same time; longer rest fits less', () => {
    const sets = (rest: 'short' | 'normal' | 'long') => {
      let n = 0
      for (let seed = 1; seed <= 20; seed++) n += generateWorkout(['Chest', 'Back', 'Legs'], 45, { style: 'standard', rest, rng: mulberry32(seed) }).reduce((a, p) => a + p.sets, 0)
      return n
    }
    expect(sets('short')).toBeGreaterThan(sets('normal'))
    expect(sets('normal')).toBeGreaterThan(sets('long'))
  })
})

describe('warm-ups', () => {
  it('easy cardio and mobility come first and their minutes are part of the total', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = generateWorkout(['Legs'], 45, { style: 'strength', rng: mulberry32(seed), warmup: { cardio: 5, mobility: 4 } })
      const warm = w.filter((p) => p.warmup)
      expect(w.slice(0, warm.length).every((p) => p.warmup)).toBe(true)
      expect(ex(warm[0]).kind).toBe('cardio')
      expect(warm[0].minutes).toBe(5)
      expect(warm.slice(1).every((p) => ex(p).group === 'Mobility' && p.seconds === 30)).toBe(true)
      expect(minutesFor(warm)).toBeGreaterThan(8)
      expect(minutesFor(warm)).toBeLessThan(10.5)
      expect(minutesFor(w)).toBeGreaterThan(45 * 0.85)
      expect(minutesFor(w)).toBeLessThan(45 * 1.1)
      expect(new Set(w.map((p) => p.exerciseId)).size).toBe(w.length)
    }
  })
  it('mobility moves match the focus', () => {
    const upper = generateWorkout(['Chest', 'Shoulders'], 30, { style: 'standard', rng: mulberry32(2), warmup: { mobility: 6 } }).filter((p) => p.warmup)
    for (const p of upper) expect(ex(p).tags!.some((t) => t === 'upper' || t === 'full')).toBe(true)
    const lower = generateWorkout(['Legs'], 30, { style: 'standard', rng: mulberry32(2), warmup: { mobility: 6 } }).filter((p) => p.warmup)
    for (const p of lower) expect(ex(p).tags!.some((t) => t === 'lower' || t === 'full')).toBe(true)
  })
  it('warm-up sets ramp into the heavy lifts, most before the first, and count toward the time', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = generateWorkout(['Chest', 'Legs'], 45, { style: 'strength', rng: mulberry32(seed), warmup: { sets: true } })
      expect(w[0].warmupSets, `seed ${seed}`).toBe(3)
      expect(w.slice(1).every((p) => (p.warmupSets ?? 0) <= 2)).toBe(true)
      expect(liftsMinutes(w)).toBeGreaterThan(45 * 0.85)
      expect(liftsMinutes(w)).toBeLessThan(45 * 1.1)
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
    for (const p of w.filter((p) => p.block === 'circuit')) expect(['Quads', 'Hamstrings', 'Calves', 'Conditioning', 'Cardio']).toContain(ex(p).group)
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
  it('runs then stations in race order, scaled to the time, after a warm-up', () => {
    const order = ['x-skierg', 'x-sled-push', 'x-sled-pull', 'x-burpee-broad-jump', 'x-row-erg', 'x-farmers-carry', 'x-sandbag-lunges', 'x-wall-balls']
    for (const minutes of [20, 30, 45, 60, 90]) {
      const all = gen('hyrox', [], minutes)
      expect(all.some((p) => p.warmup)).toBe(minutes >= 30)
      const w = main(all)
      expect(w[0].exerciseId).toBe('running')
      const stations = w.slice(1).map((p) => p.exerciseId)
      // A subset when time is short, but always in race order.
      expect(stations).toEqual(order.filter((id) => stations.includes(id)))
      expect(stations.length).toBeGreaterThanOrEqual(3)
      expect(w.every((p) => p.note && p.blockLabel?.startsWith('Hyrox-style'))).toBe(true)
      expect(minutesFor(all)).toBeGreaterThanOrEqual(minutes * 0.85)
      expect(minutesFor(all)).toBeLessThanOrEqual(minutes + 6)
    }
  })
  it('does a full eight stations when there is time and shrinks distances when there is not', () => {
    expect(main(gen('hyrox', [], 90)).length).toBe(9) // run + 8 stations
    expect(main(gen('hyrox', [], 20)).length).toBeLessThan(9)
    const dist = (min: number) => parseInt(main(gen('hyrox', [], min))[0].note!) // "600 m run before each…"
    expect(dist(30)).toBeLessThan(dist(90))
  })
  it('a reroll gives different stations, every station comes up, and home gyms get sled stand-ins', () => {
    const seen = new Set(Array.from({ length: 30 }, (_, i) => main(gen('hyrox', [], 30, i + 1)).slice(1).map((p) => p.exerciseId)).flat())
    expect(seen.size).toBe(8)
    expect(JSON.stringify(gen('hyrox', [], 30, 1))).not.toBe(JSON.stringify(gen('hyrox', [], 30, 2)))
    const home = withGearFor(['Barbell', 'Dumbbell', 'Kettlebell', 'Bands', 'Other'], () => gen('hyrox', [], 90))
    expect(home.some((p) => /sled/.test(p.exerciseId))).toBe(false)
  })
})

describe('CrossFit-style', () => {
  it('has a WOD block with a clear format, and a strength primer for long sessions', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const short = main(gen('crossfit', [], 30, seed))
      expect(short.some((p) => /AMRAP|EMOM|rounds for time/.test(p.blockLabel ?? ''))).toBe(true)
      expect(short.some((p) => p.block === 'primer')).toBe(false)
      const all = gen('crossfit', [], 60, seed)
      const long = main(all)
      expect(long[0].block).toBe('primer')
      expect(ex(long[0]).equipment).toBe('Barbell')
      expect(long.filter((p) => p.block !== 'primer').length).toBeGreaterThanOrEqual(3)
      // The time asked for is used: warm-up, primer and WOD(s), nothing reserved for a warm-up that never appears.
      expect(minutesFor(all)).toBeGreaterThanOrEqual(52)
    }
  })
  it('EMOM assigns one movement per minute', () => {
    const emoms = Array.from({ length: 80 }, (_, i) => main(gen('crossfit', [], 30, i + 1)).filter((p) => p.block === 'wod')).filter((w) => /EMOM/.test(w[0].blockLabel ?? ''))
    expect(emoms.length).toBeGreaterThan(0)
    for (const w of emoms) w.forEach((p, i) => expect(p.note).toContain(`minute ${i + 1} of ${w.length}`))
  })
})

describe('strength lifts and primers are classic main lifts', () => {
  it('no isolation or odd variants', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const w = gen('strength', ['Chest', 'Back', 'Legs', 'Shoulders'], 60, seed)
      const mains = w.filter((p) => (p.reps ?? 99) <= 6 && p.sets >= 4)
      for (const p of mains) expect(ex(p).name).toMatch(/squat|deadlift|press|row|pull|chin|thrust|lunge|dip/i)
      for (const p of w) expect(ex(p).name, 'strength days stay compound').not.toMatch(/curl|raise|fly|flye|kickback|crossover|pushdown/i)
      const primer = main(gen('crossfit', [], 60, seed))[0]
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
    const h = main(gen('hyrox', [], 45))
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
      for (const p of w) expect(['Quads', 'Hamstrings', 'Calves']).toContain(ex(p).group)
    }
  })
})

describe('tabata', () => {
  it('makes 2-6 movements with the classic 20/10 x 8 timing', () => {
    for (const minutes of [10, 20, 30, 60]) {
      for (let seed = 1; seed <= 15; seed++) {
        const w = gen('tabata', [], minutes, seed)
        expect(w.length).toBeGreaterThanOrEqual(2)
        expect(w.length).toBeLessThanOrEqual(6)
        expect(w[0].wod).toMatchObject({ kind: 'tabata', work: 20, rest: 10, rounds: 8, intervals: w.length * 8 })
        expect(minutesFor(w)).toBeLessThanOrEqual(minutes + 3)
      }
    }
  })
})

describe('several styles in one workout', () => {
  const mixed = (styles: WorkoutStyle[], focus: string[], minutes: number, seed: number) =>
    generateWorkout(focus, minutes, { styles, style: styles[0], rng: mulberry32(seed) })
  it('runs them in order (lifting, then conditioning), with cardio last and no repeats', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const w = mixed(['circuit', 'strength'], ['Chest', 'Back', 'Legs', 'Cardio'], 60, seed)
      const ids = w.map((p) => p.exerciseId)
      expect(new Set(ids).size).toBe(ids.length)
      const firstCircuit = w.findIndex((p) => p.block?.startsWith('circuit-'))
      const lastStrength = w.map((p) => !p.block && ex(p).kind === 'strength').lastIndexOf(true)
      expect(w.some((p) => !p.block && ex(p).mode === 'weight')).toBe(true) // strength lifts
      expect(firstCircuit).toBeGreaterThan(-1)
      expect(lastStrength).toBeLessThan(firstCircuit)
      const cardioAt = w.map((p) => ex(p).kind).lastIndexOf('strength')
      expect(ex(w.at(-1)!).kind, `seed ${seed}`).toBe('cardio')
      expect(cardioAt).toBeLessThan(w.length - 1)
      expect(minutesFor(w)).toBeLessThanOrEqual(60 + 10)
    }
  })
  it('keeps timed blocks from different styles separate', () => {
    const w = mixed(['amrap', 'emom'], [], 40, 3)
    const kinds = new Set(w.map((p) => `${p.block}|${p.wod?.kind}`))
    for (const k of kinds) { const [b, kind] = k.split('|'); expect(b.startsWith(kind)).toBe(true) }
    expect(new Set(w.map((p) => p.wod?.kind))).toEqual(new Set(['amrap', 'emom']))
  })
  it('a single-item list behaves like that style', () => {
    expect(mixed(['strength'], ['Chest', 'Legs'], 45, 5)).toEqual(gen('strength', ['Chest', 'Legs'], 45, 5))
  })
})

describe('time per part', () => {
  it('gives each style and the cardio its own minutes', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const w = generateWorkout(['Chest', 'Back', 'Legs', 'Cardio'], 75, { styles: ['strength'], minutesByStyle: { strength: 45 }, cardioMinutes: 30, rng: mulberry32(seed) })
      const cardio = w.filter((p) => ex(p).kind === 'cardio')
      const lifts = w.filter((p) => ex(p).kind === 'strength')
      expect(cardio.reduce((a, p) => a + (p.minutes ?? 0), 0), `seed ${seed}`).toBeGreaterThanOrEqual(25)
      expect(minutesFor(lifts)).toBeGreaterThan(30)
      expect(minutesFor(lifts)).toBeLessThanOrEqual(53)
      expect(ex(w.at(-1)!).kind).toBe('cardio')
    }
  })
  it('splits between styles as asked', () => {
    const w = generateWorkout(['Chest', 'Legs'], 60, { styles: ['strength', 'circuit'], minutesByStyle: { strength: 40, circuit: 20 }, rng: mulberry32(4) })
    const circuit = w.filter((p) => p.block?.startsWith('circuit-'))
    expect(minutesFor(circuit)).toBeLessThanOrEqual(24)
    expect(minutesFor(w.filter((p) => !p.block))).toBeGreaterThan(28)
  })
})

describe('Hyrox and CrossFit fit the person', () => {
  it('Hyrox runs go on the treadmill when that is the running they do', () => {
    const w = withCardioFor(['treadmill'], false, () => main(gen('hyrox', [], 45)))
    expect(w[0].exerciseId).toBe('Running_Treadmill')
    expect(main(gen('hyrox', [], 45))[0].exerciseId).toBe('running')
  })
  it('CrossFit fills the time with any equipment, and never has jump rope twice', () => {
    for (const gear of [null, ['Barbell', 'Dumbbell', 'Kettlebell', 'Bands', 'Other'], []] as (string[] | null)[]) {
      for (const minutes of [30, 45, 60]) {
        for (let seed = 1; seed <= 10; seed++) {
          const w = withGearFor(gear, () => gen('crossfit', [], minutes, seed))
          expect(minutesFor(w), `${JSON.stringify(gear)} ${minutes}`).toBeGreaterThanOrEqual(minutes * 0.85)
          expect(minutesFor(w)).toBeLessThanOrEqual(minutes + 5)
          const rope = w.filter((p) => !p.warmup && /rope|double.?under/i.test(BUILTIN_BY_ID.get(p.exerciseId)?.name ?? p.exerciseId))
          for (const b of new Set(rope.map((p) => p.block))) expect(rope.filter((p) => p.block === b).length).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})
