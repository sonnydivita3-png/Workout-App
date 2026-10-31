import { afterEach, describe, expect, it } from 'vitest'
import { setFavorites } from './favorites'
import { generateWorkout, pairScore, swapExercise, type WorkoutStyle } from './randomizer'
import { BY_ID, customPool, familyOf, mulberry32, ONE_ONLY, setCustomExercises } from './randomUtil'
import type { Exercise, PlannedExercise } from '../types'

const ex = (p: PlannedExercise) => BY_ID.get(p.exerciseId)!
const lifts = (w: PlannedExercise[]) => w.filter((p) => !p.warmup).map(ex).filter((e) => e.kind === 'strength')
const families = (w: PlannedExercise[]) => lifts(w).map(familyOf).filter((f): f is string => !!f)
const count = <T>(list: T[], x: T) => list.filter((y) => y === x).length
const names = (w: PlannedExercise[]) => w.map((p) => ex(p).name).join(', ')
const gen = (focus: string[], minutes: number, style: WorkoutStyle, seed: number) => generateWorkout(focus, minutes, { style, rng: mulberry32(seed) })

const LOWER = ['Quads', 'Hamstrings', 'Glutes', 'Calves']
const UPPER = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps']

afterEach(() => { setCustomExercises([]); setFavorites([]) })

describe('one of each movement (programs are built from distinct movement patterns)', () => {
  it('never two squats, deadlifts, bench presses, overhead presses or hip thrusts, whatever the style or body parts', () => {
    const focuses = [LOWER, UPPER, ['Chest', 'Back'], ['Back', 'Biceps'], ['Quads'], ['Glutes'], ['Chest'], [...LOWER, ...UPPER, 'Core']]
    for (const style of ['standard', 'strength', 'supersets', 'bodyweight', 'circuit', 'pha'] as WorkoutStyle[]) {
      for (const focus of focuses) {
        for (const minutes of [30, 60, 90]) {
          for (let seed = 1; seed <= 5; seed++) {
            const w = gen(focus, minutes, style, seed)
            const f = families(w)
            for (const big of ONE_ONLY) expect(count(f, big), `${big}: ${style} ${focus.join('+')} ${minutes} min seed ${seed}: ${names(w)}`).toBeLessThanOrEqual(1)
          }
        }
      }
    }
  })

  it('a lower-body day squats once and deadlifts once (a deadlift, RDL or good morning), with no movement twice', () => {
    for (const style of ['standard', 'strength', 'supersets'] as WorkoutStyle[]) {
      let hinged = 0
      for (let seed = 1; seed <= 40; seed++) {
        const w = gen(LOWER, 45, style, seed)
        const f = families(w)
        const label = `${style} seed ${seed}: ${names(w)}`
        expect(count(f, 'hinge'), label).toBeLessThanOrEqual(1)
        expect(new Set(f).size, label).toBe(f.length)
        if (style !== 'supersets') expect(count(f, 'squat'), label).toBe(1)
        if (count(f, 'hinge') === 1) hinged++
      }
      // Straight sets always; supersets nearly always (a pair that fits the time better can leave it out).
      expect(hinged, style).toBeGreaterThanOrEqual(style === 'supersets' ? 36 : 40)
    }
  })

  it('deadlifts stay off chest-and-back, upper-body and push days', () => {
    for (const focus of [['Chest', 'Back'], UPPER, ['Chest', 'Shoulders', 'Triceps']]) {
      // (Not PHA: it always alternates upper and lower body, so it has its own lower-body moves.)
      for (const style of ['standard', 'strength', 'supersets', 'bodyweight', 'circuit'] as WorkoutStyle[]) {
        for (let seed = 1; seed <= 15; seed++) {
          const w = gen(focus, 60, style, seed)
          expect(count(families(w), 'hinge'), `${style} ${focus.join('+')} seed ${seed}: ${names(w)}`).toBe(0)
        }
      }
    }
  })

  it('each part starts with its main lift: a squat, a hip hinge, a chest press, a row or pull-down, an overhead press', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const lower = families(gen(LOWER, 45, 'standard', seed))
      expect(lower, `lower seed ${seed}`).toEqual(expect.arrayContaining(['squat', 'hinge']))
      const upper = families(gen(UPPER, 45, 'standard', seed))
      expect(upper.some((f) => f === 'bench' || f === 'incline'), `upper seed ${seed}: ${upper}`).toBe(true)
      expect(upper.some((f) => f === 'row' || f === 'vertical pull'), `upper seed ${seed}: ${upper}`).toBe(true)
      expect(upper, `upper seed ${seed}`).toContain('overhead')
    }
  })

  it('bigger muscles get the extra exercises first: a lower-body day never has more calf raises than quad or hamstring work', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const w = gen(LOWER, 45, 'standard', seed)
      const parts = lifts(w).map((e) => e.group)
      for (const big of ['Quads', 'Hamstrings']) expect(count(parts, 'Calves'), `seed ${seed}: ${names(w)}`).toBeLessThanOrEqual(count(parts, big))
    }
  })
})

describe('strength days', () => {
  it('lead with the classic heavy lifts in order (squat then deadlift; bench, row, overhead press), at 3-6 reps', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const lower = gen(LOWER, 45, 'strength', seed)
      expect(lower.slice(0, 2).map((p) => familyOf(ex(p))), `seed ${seed}: ${names(lower)}`).toEqual(['squat', 'hinge'])
      const upper = gen(UPPER, 45, 'strength', seed)
      const [press, pull, overhead] = upper.slice(0, 3).map((p) => familyOf(ex(p)))
      expect(['bench', 'incline'], `seed ${seed}: ${names(upper)}`).toContain(press)
      expect(['row', 'vertical pull'], `seed ${seed}: ${names(upper)}`).toContain(pull)
      expect(overhead, `seed ${seed}: ${names(upper)}`).toBe('overhead')
      for (const p of [...lower.slice(0, 2), ...upper.slice(0, 3)]) expect(p.reps, names(upper)).toBeLessThanOrEqual(6)
    }
  })

  it('a hip thrust leads only when there is no squat or deadlift to lead the legs', () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(familyOf(ex(gen(['Glutes'], 45, 'strength', seed)[0]))).toBe('bridge')
      expect(familyOf(ex(gen(['Quads', 'Glutes'], 45, 'strength', seed)[0]))).toBe('squat')
    }
  })
})

describe('supersets', () => {
  it('pair a heavy squat or deadlift with lighter work, while a heavy press and row can share a pair', () => {
    const squat = BY_ID.get('Barbell_Squat')!
    expect(pairScore(squat, BY_ID.get('Romanian_Deadlift')!)).toBeLessThan(0)
    expect(pairScore(squat, BY_ID.get('Plank')!)).toBeGreaterThan(pairScore(squat, BY_ID.get('Romanian_Deadlift')!))
    expect(pairScore(BY_ID.get('Barbell_Bench_Press_-_Medium_Grip')!, BY_ID.get('Bent_Over_Barbell_Row')!)).toBeGreaterThan(0)
    const big = (e: Exercise) => e.equipment === 'Barbell' && (familyOf(e) === 'squat' || familyOf(e) === 'hinge')
    for (const focus of [LOWER, ['Chest', 'Back', 'Quads', 'Hamstrings'], ['Quads', 'Hamstrings']]) {
      for (const minutes of [20, 45]) {
        for (let seed = 1; seed <= 20; seed++) {
          const w = gen(focus, minutes, 'supersets', seed)
          for (let i = 0; i < w.length - 1; i++) {
            if (!w[i].block?.startsWith('ss') || w[i + 1].block !== w[i].block) continue
            expect(big(ex(w[i])) && big(ex(w[i + 1])), `${focus.join('+')} ${minutes} min seed ${seed}: ${names(w)}`).toBe(false)
            i++
          }
        }
      }
    }
  })
})

describe('swapping an exercise', () => {
  const day = (...ids: string[]): PlannedExercise[] => ids.map((exerciseId) => ({ exerciseId, sets: 3, reps: 10 }))

  it('brings in a movement the workout doesn\'t already have: no second deadlift for the leg curl', () => {
    const w = day('Barbell_Squat', 'Romanian_Deadlift', 'Lying_Leg_Curls')
    for (let seed = 1; seed <= 40; seed++) {
      const next = swapExercise(w, 2, mulberry32(seed))
      expect(count(families(next), 'hinge'), names(next)).toBe(1)
      expect(ex(next[2]).group).toBe('Hamstrings')
    }
  })

  it('never swaps a deadlift onto a chest and back day', () => {
    const w = day('Barbell_Bench_Press_-_Medium_Grip', 'Bent_Over_Barbell_Row')
    for (let seed = 1; seed <= 40; seed++) expect(familyOf(ex(swapExercise(w, 1, mulberry32(seed))[1])), `seed ${seed}`).not.toBe('hinge')
  })
})

describe('their own exercises in workouts made for them', () => {
  const landmine: Exercise = { id: 'custom-landmine', name: 'Viking Press', kind: 'strength', mode: 'weight', group: 'Shoulders', equipment: 'Barbell', custom: true }
  const airplane: Exercise = { id: 'custom-airplane', name: 'Banded Hip Airplane', kind: 'strength', mode: 'reps', group: 'Glutes', equipment: 'Bodyweight', custom: true }
  const sandbag: Exercise = { id: 'custom-sandbag', name: 'Sandbag Shouldering', kind: 'strength', mode: 'reps', group: 'Conditioning', equipment: 'Bodyweight', custom: true }
  const share = (id: string, focus: string[], style: WorkoutStyle, n = 60) => {
    let hits = 0
    for (let seed = 1; seed <= n; seed++) if (gen(focus, 45, style, seed).some((p) => p.exerciseId === id)) hits++
    return hits / n
  }

  it('turn up in workouts for their body part (starred: most of them), and nowhere else', () => {
    setCustomExercises([landmine, airplane])
    expect(share(landmine.id, ['Shoulders', 'Triceps'], 'standard')).toBeGreaterThan(0.03)
    expect(share(airplane.id, ['Glutes', 'Hamstrings'], 'standard')).toBeGreaterThan(0.2)
    expect(share(landmine.id, ['Quads', 'Hamstrings'], 'standard')).toBe(0)
    setFavorites([landmine.id])
    expect(share(landmine.id, ['Shoulders', 'Triceps'], 'standard')).toBeGreaterThan(0.5)
  })

  it('are in strength, supersets, circuits, PHA and timed pieces too; deleted ones and their cardio never are', () => {
    setCustomExercises([landmine, airplane, sandbag, { ...airplane, id: 'custom-gone', name: 'Old Hip Thing', retired: true }, { id: 'custom-ruck', name: 'Rucking', kind: 'cardio', group: 'Cardio', equipment: 'Outdoor', custom: true }])
    setFavorites([landmine.id, airplane.id])
    expect(share(landmine.id, ['Shoulders', 'Chest'], 'strength')).toBeGreaterThan(0.3)
    expect(share(airplane.id, LOWER, 'supersets')).toBeGreaterThan(0.3)
    expect(share(airplane.id, ['Glutes'], 'circuit')).toBeGreaterThan(0.3)
    expect(share(airplane.id, ['Glutes', 'Chest'], 'pha')).toBeGreaterThan(0.3)
    expect(share(airplane.id, ['Glutes'], 'amrap')).toBeGreaterThan(0.1)
    expect(share(sandbag.id, [], 'circuit')).toBeGreaterThan(0)
    for (const style of ['standard', 'supersets', 'circuit', 'amrap'] as WorkoutStyle[]) {
      expect(share('custom-gone', ['Glutes'], style, 30), style).toBe(0)
      expect(share('custom-ruck', ['Glutes', 'Cardio'], style, 30), style).toBe(0)
    }
  })

  it('follow what they save: new, changed and deleted ones (a deleted one is still found for old plans)', async () => {
    const { useStore } = await import('../store')
    useStore.setState({ custom: [landmine] })
    expect(customPool().map((e) => e.name)).toEqual(['Viking Press'])
    useStore.setState({ custom: [{ ...landmine, name: 'Landmine Push Press' }] })
    expect(customPool().map((e) => e.name)).toEqual(['Landmine Push Press'])
    useStore.setState({ custom: [{ ...landmine, retired: true }] })
    expect(customPool()).toEqual([])
    expect(BY_ID.get(landmine.id)?.group).toBe('Shoulders')
    useStore.setState({ custom: [] })
  })

  it('can be swapped in', () => {
    setCustomExercises([airplane])
    const w: PlannedExercise[] = [{ exerciseId: 'Barbell_Hip_Thrust', sets: 3, reps: 10 }]
    const got = new Set<string>()
    for (let seed = 1; seed <= 60; seed++) got.add(swapExercise(w, 0, mulberry32(seed))[0].exerciseId)
    expect(got).toContain(airplane.id)
  })
})
