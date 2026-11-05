import { describe, expect, it } from 'vitest'
import type { PlannedExercise } from '../types'
import { minutesFor, type WorkoutStyle } from './randomizer'
import { BY_ID, mulberry32 } from './randomUtil'
import { GEAR_PRESETS, hasGear, withGearFor } from './equipment'
import { ACTIVITIES, sessionKindsFor, type CardioSetup } from './cardioSetup'
import { workoutCalories } from './calorieTarget'
import { topSpeed } from './calories'
import { COND_GROUPS, FAST, LIFT_STYLES, makeWorkout, planRequest, requestOptions, topUpCalories, withRequestChoices, type Kind, type WarmPick, type WorkoutRequest } from './workoutRequest'

// Requests built the way Make me a workout builds them, made by the same code the sheet uses.
const COND: WorkoutStyle[] = COND_GROUPS.flatMap((g) => g.styles)
const isPiece = (p: PlannedExercise) => !p.warmup && !p.block && !!p.minutes && BY_ID.get(p.exerciseId)?.kind === 'cardio'
const base = (over: Partial<WorkoutRequest> = {}): WorkoutRequest => ({
  kinds: ['lift'], liftStyle: 'standard', condStyle: 'circuit', focus: ['Chest', 'Back'], cardio: { activities: [], where: 'out', session: 'steady', split: false },
  minutes: 60, split: {}, warm: [], goal: 'time', kcal: 500, timeLimit: null, paceIn: null, effort: 'moderate', lb: 180,
  me: { sex: 'male', birthYear: 1990, heightIn: 70 }, today: '2026-11-03', units: { weight: 'lb', distance: 'mi' }, countTotal: false,
  profileCardio: [], logs: [], gear: null, stations: { cardio: [], split: false }, ...over,
})
const make = (req: WorkoutRequest, seed = 1) => {
  const plan = planRequest(req)
  const opts = requestOptions(req, plan, { rest: 'normal', drops: false, avoid: new Set() })
  return { plan, items: withRequestChoices(req, plan, () => makeWorkout(req, plan, { ...opts, rng: mulberry32(seed) })) }
}
/** Every cardio setup the picker offers: each activity, inside or out, with each session it offers. */
const SETUPS: CardioSetup[] = [{ activities: [], where: 'out', session: 'steady', split: false }]
for (const a of ACTIVITIES) for (const where of a.in ? (['out', 'in'] as const) : (['out'] as const)) {
  const s0: CardioSetup = { activities: [a.key], where, session: 'steady', split: false }
  for (const session of sessionKindsFor(s0)) SETUPS.push({ ...s0, session, ...(session === 'tabata' ? { tabata: 'tabata', rounds: 8 } : {}) })
}
const SESSION_WORD = { steady: /Steady/, intervals: /Intervals/, tempo: /Tempo/, hills: /Hills/, tabata: /Tabata|Sprint/, trial: /Time trial/ } as const

describe('Hyrox and a run for 1000 calories (as reported: only the Hyrox showed up)', () => {
  const ask = (over: Partial<WorkoutRequest>) => base({ kinds: ['cond', 'cardio'], condStyle: 'hyrox', focus: [], cardio: { activities: ['running'], where: 'out', session: 'steady', split: false }, goal: 'calories', kcal: 1000, warm: ['cardio', 'mobility'], ...over })
  it('in a gym: the Hyrox, then the run, about 1000 calories', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { plan, items } = make(ask({}), seed)
      expect(items.filter(isPiece).map((p) => p.exerciseId)).toEqual(['running'])
      expect(items.some((p) => p.block?.endsWith('hyrox'))).toBe(true)
      expect(new Set(items.map((p) => p.exerciseId)).size).toBe(items.length)
      expect(workoutCalories(items, plan.rate, plan.mets) / 1000).toBeGreaterThan(0.9)
      expect(workoutCalories(items, plan.rate, plan.mets) / 1000).toBeLessThan(1.1)
    }
  })
  it('within 90 minutes: still both, the run quicker but never faster than most can hold', () => {
    const { items } = make(ask({ timeLimit: 90 }))
    const run = items.find(isPiece)!
    expect(run.exerciseId).toBe('running')
    expect(minutesFor(items)).toBeLessThanOrEqual(95)
    expect(run.distance! / (run.minutes! / 60)).toBeLessThanOrEqual(FAST.running)
    expect(run.note).not.toMatch(/easy, conversational/)
  })
  it('a pace they typed is the pace of the run, even well above their recent average', () => {
    const recent = [3, 4, 5].map((mi, i) => ({ id: `r${i}`, date: `2026-10-0${i + 1}`, exerciseId: 'running', cardio: { distance: mi, minutes: mi * 10 } }))
    const req = base({ kinds: ['lift', 'cardio'], focus: ['Chest', 'Back', 'Quads'], cardio: { activities: ['running'], where: 'out', session: 'steady', split: false }, goal: 'calories', kcal: 750, paceIn: 8, logs: recent })
    const { items } = make(req)
    const run = items.find(isPiece)!
    expect(run.distance! / (run.minutes! / 60)).toBeCloseTo(8, 0)
  })
  it('at home with no treadmill: one running card holds the Hyrox runs and the run on its own', () => {
    const { items } = make(ask({ gear: ['Dumbbell', 'Kettlebell'] }))
    const run = items.find((p) => p.exerciseId === 'running')!
    expect(run.extra).toBeGreaterThan(0)
    expect(new Set(items.map((p) => p.exerciseId)).size).toBe(items.length)
  })
})

describe('every conditioning style with every cardio choice', () => {
  it('both parts are there, the cardio is the one picked, its session is as picked and its note matches its length', () => {
    let checked = 0
    for (const condStyle of COND) {
      for (const cardio of SETUPS) {
        for (const goal of ['time', 'calories'] as const) {
          const req = base({ kinds: ['cond', 'cardio'], condStyle, cardio, goal, kcal: 750, focus: [] })
          const { plan, items } = make(req, 3)
          const tag = `${condStyle} + ${cardio.activities.join('+') || 'any'}/${cardio.where}/${cardio.session} by ${goal}`
          expect(new Set(items.map((p) => p.exerciseId)).size, tag).toBe(items.length)
          expect(items.some((p) => !p.warmup && p.block), tag).toBe(true)
          const pieces = items.filter(isPiece)
          const merged = items.filter((p) => p.extra)
          expect(pieces.length + merged.length, tag).toBeGreaterThan(0)
          if (plan.one && pieces.length) {
            expect(pieces.map((p) => p.exerciseId), tag).toContain(plan.one)
            expect(pieces.some((p) => SESSION_WORD[plan.sessionKind].test(p.note ?? '')), `${tag}: ${pieces.map((p) => p.note)}`).toBe(true)
          }
          for (const p of pieces) {
            const steady = /^Steady · (\d+) min/.exec(p.note ?? '')
            if (steady) expect(Number(steady[1]), `${tag}: ${p.note}`).toBe(p.minutes)
            if (p.distance) expect(p.distance / (p.minutes! / 60), tag).toBeLessThanOrEqual(Math.min(topSpeed(p.exerciseId) ?? Infinity, FAST[p.exerciseId] ?? Infinity) + 0.01)
          }
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(400)
  }, 60000)
})

describe('any request Make me a workout can make', () => {
  const KINDS: Kind[][] = [['lift'], ['cond'], ['cardio'], ['lift', 'cond'], ['lift', 'cardio'], ['cond', 'cardio'], ['lift', 'cond', 'cardio']]
  const FOCI = [[], ['Chest', 'Back'], ['Quads', 'Hamstrings', 'Glutes'], ['Biceps'], ['Core']]
  const WARMS: WarmPick[][] = [[], ['cardio', 'mobility'], ['sets'], ['mobility']]
  it('never repeats an exercise, keeps every part asked for and the equipment, and lands a calorie target (or offers the rest)', () => {
    const r = mulberry32(2026)
    const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]
    for (let n = 0; n < 1500; n++) {
      const goal = r() < 0.5 ? 'calories' : 'time'
      const req = base({
        kinds: pick(KINDS), liftStyle: pick(LIFT_STYLES), condStyle: pick(COND), focus: pick(FOCI), cardio: pick(SETUPS), minutes: pick([20, 30, 45, 60, 75, 90, 120, 150, 180]),
        warm: pick(WARMS), goal, kcal: pick([300, 500, 750, 1000]), timeLimit: r() < 0.5 ? null : pick([45, 60, 75, 90, 120, 150, 180]), gear: pick(GEAR_PRESETS).gear,
      })
      const plan = planRequest(req)
      if (!plan.canGenerate) continue
      const { items } = make(req, n)
      const tag = `#${n} ${JSON.stringify({ kinds: req.kinds, lift: req.liftStyle, cond: req.condStyle, focus: req.focus, cardio: req.cardio, goal, kcal: req.kcal, limit: req.timeLimit, gear: req.gear })}`
      expect(items.length, tag).toBeGreaterThan(0)
      expect(new Set(items.map((p) => p.exerciseId)).size, tag).toBe(items.length)
      const main = items.filter((p) => !p.warmup)
      if (plan.has('cond')) expect(main.some((p) => p.block), tag).toBe(true)
      if (plan.has('cardio')) expect(items.some(isPiece) || items.some((p) => p.extra), tag).toBe(true)
      withGearFor(req.gear, () => { for (const p of main) { const e = BY_ID.get(p.exerciseId)!; if (e.kind === 'strength') expect(hasGear(e), `${tag}: ${e.name}`).toBe(true) } })
      // A pace worked out to fit a time limit is one most people can hold (13.8 mph on a treadmill was planned).
      for (const p of items.filter(isPiece)) if (p.distance) expect(p.distance / (p.minutes! / 60), tag).toBeLessThanOrEqual(Math.min(topSpeed(p.exerciseId) ?? Infinity, FAST[p.exerciseId] ?? Infinity) + 0.01)
      // (Lifting under a time limit it can't burn the target in: the setup says which style would, before it's made.)
      if (plan.goal === 'calories' && plan.cal && !plan.tooHard && !(plan.timed && !plan.cardioFlex)) {
        let kcal = workoutCalories(items, plan.rate, plan.mets)
        if (kcal < req.kcal! * 0.9 && !(req.timeLimit && minutesFor(items) >= req.timeLimit - 5)) kcal = workoutCalories(withRequestChoices(req, plan, () => topUpCalories(items, req, plan)), plan.rate, plan.mets)
        // Low targets with fixed parts can come in over (the parts alone burn more), never far under.
        expect(kcal / req.kcal!, `${tag}: ${kcal}`).toBeGreaterThan(0.75)
      }
    }
  }, 120000)
})

describe('short sessions', () => {
  it('a part is never planned shorter than it can be made (a PHA takes 15 minutes, a cardio session 10)', () => {
    const req = base({ kinds: ['cond', 'cardio'], condStyle: 'pha', focus: [], minutes: 20, warm: ['cardio', 'mobility'], cardio: { activities: ['row'], where: 'out', session: 'steady', split: false } })
    const plan = planRequest(req)
    expect(plan.partMin('pha')).toBeGreaterThanOrEqual(15)
    expect(plan.partMin('cardio')).toBeGreaterThanOrEqual(10)
    const { items } = make(req)
    expect(minutesFor(items) / plan.totalMin).toBeLessThan(1.2)
  })
})

describe('a time limit is the most it may take', () => {
  it('a target their usual pace reaches sooner is done sooner, not stretched (lifting would overshoot)', () => {
    const req = base({ kinds: ['lift'], liftStyle: 'supersets', goal: 'calories', kcal: 300, timeLimit: 120 })
    const plan = planRequest(req)
    expect(plan.inLimit).toBe(true)
    expect(plan.cal!.totalMinutes).toBeLessThan(120)
    const { items } = make(req)
    const kcal = workoutCalories(items, plan.rate, plan.mets)
    expect(kcal / 300).toBeGreaterThan(0.85)
    expect(kcal / 300).toBeLessThan(1.2)
  })
})
