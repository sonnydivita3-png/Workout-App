import type { Exercise, ExerciseLog, PlannedExercise } from '../types'
import { partFromName } from './bodyParts'
import { addDays, parseISO, toISO, weekdayIndex } from './dates'
import { CARDIO_SESSIONS, type CardioSessionKind } from './cardioSession'
import { generateWorkout, styleInfo, type WarmupOptions, type WorkoutStyle } from './randomizer'
import { BY_ID, FULL_BODY_GROUPS, type Rng } from './randomUtil'
import { liftMinutes, type RestPref } from './timing'
import { hasData } from './stats'
import { plateau, workSets } from './progression'
import { isMainLift } from './randomUtil'

export type ProgramGoal = 'muscle' | 'strength' | 'fatloss' | 'fitness' | 'functional'

export const PROGRAM_GOALS: { id: ProgramGoal; label: string; blurb: string }[] = [
  { id: 'muscle', label: 'Build muscle', blurb: 'Body-part splits with straight sets and supersets, 8–12 reps.' },
  { id: 'strength', label: 'Get stronger', blurb: 'Heavy compound lifts, low reps, and enough rest between sessions.' },
  { id: 'fatloss', label: 'Lose fat', blurb: 'HIIT, circuits and PHA, plus cardio, with some lifting to keep muscle.' },
  { id: 'fitness', label: 'General fitness', blurb: 'A balanced mix of lifting, bodyweight, circuits and cardio.' },
  { id: 'functional', label: 'Hyrox / CrossFit', blurb: 'Hyrox-style and CrossFit-style sessions with strength work and running.' },
]

/**
 * Big muscle groups. Two days in a row never share one of these. Arms, core and cardio are
 * left out on purpose: they recover fast and show up in most sessions.
 */
export const MAJOR_GROUPS = ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings', 'Glutes']

interface DayType {
  name: string
  groups: string[] // muscle groups worked (used for recovery and, unless `generic`, as the workout focus)
  style: WorkoutStyle
  weight: number
  /** Full-body formats: generate with no body-part focus. */
  generic?: boolean
}

const FULL = FULL_BODY_GROUPS
const UPPER_BODY = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps']
const LOWER_BODY = ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core']
const ARMS = ['Biceps', 'Triceps']
const CARDIO: DayType = { name: 'Cardio', groups: [], style: 'standard', weight: 0.35 }

/**
 * Day types available for a goal. Full-body sessions touch every major muscle, so the next day can only be cardio:
 * favour them when there are few training days and split (upper/lower, body-part) sessions when there are many.
 */
function goalDayTypes(goal: ProgramGoal, daysPerWeek: number): DayType[] {
  const fullWeight = daysPerWeek <= 3 ? 3 : daysPerWeek === 4 ? 0.6 : 0.3
  const fw = (w: number) => w * (daysPerWeek <= 3 ? 1.6 : daysPerWeek === 4 ? 0.6 : 0.3)
  const cardio = (w: number): DayType => ({ ...CARDIO, weight: w })
  switch (goal) {
    case 'muscle':
      return [
        { name: 'Chest & arms', groups: ['Chest', ...ARMS], style: 'standard', weight: 1 },
        { name: 'Back & core', groups: ['Back', 'Core'], style: 'standard', weight: 1 },
        { name: 'Shoulders & arms', groups: ['Shoulders', ...ARMS], style: 'supersets', weight: 1 },
        { name: 'Legs & glutes', groups: LOWER_BODY, style: 'standard', weight: 1.2 },
        { name: 'Push (supersets)', groups: ['Chest', 'Shoulders', 'Triceps'], style: 'supersets', weight: 0.8 },
        { name: 'Pull', groups: ['Back', 'Biceps', 'Core'], style: 'standard', weight: 0.8 },
        { name: 'Upper body', groups: UPPER_BODY, style: 'standard', weight: 1 },
        { name: 'Lower body', groups: LOWER_BODY, style: 'standard', weight: 1 },
        { name: 'Full body', groups: FULL, style: 'standard', weight: fullWeight },
        cardio(0.35),
      ]
    case 'strength':
      return [
        { name: 'Full-body strength', groups: ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings'], style: 'strength', weight: fullWeight },
        { name: 'Upper strength', groups: ['Chest', 'Back', 'Shoulders'], style: 'strength', weight: 1 },
        { name: 'Lower strength', groups: ['Quads', 'Hamstrings', 'Glutes', 'Core'], style: 'strength', weight: 1.1 },
        { name: 'Push strength', groups: ['Chest', 'Shoulders'], style: 'strength', weight: 0.7 },
        { name: 'Pull strength', groups: ['Back', 'Biceps'], style: 'strength', weight: 0.7 },
        cardio(0.35),
      ]
    case 'fatloss':
      return [
        { name: 'Full-body HIIT', groups: FULL, style: 'circuit', weight: fw(1.2), generic: true },
        { name: 'Upper-body circuit', groups: [...UPPER_BODY, 'Core'], style: 'circuit', weight: 1 },
        { name: 'Lower-body circuit', groups: LOWER_BODY, style: 'circuit', weight: 1 },
        { name: 'PHA full body', groups: FULL, style: 'pha', weight: fw(0.9), generic: true },
        { name: 'Upper-body PHA', groups: [...UPPER_BODY, 'Core'], style: 'pha', weight: 0.7 },
        { name: 'Full-body supersets', groups: FULL, style: 'supersets', weight: fw(0.8) },
        { name: 'Upper body', groups: UPPER_BODY, style: 'standard', weight: 0.6 },
        { name: 'Lower body', groups: LOWER_BODY, style: 'standard', weight: 0.6 },
        cardio(1.1),
      ]
    case 'fitness':
      return [
        { name: 'Full body', groups: FULL, style: 'standard', weight: fw(1.2) },
        { name: 'Upper body', groups: UPPER_BODY, style: 'standard', weight: 1 },
        { name: 'Lower body', groups: LOWER_BODY, style: 'standard', weight: 1 },
        { name: 'Full-body circuit', groups: FULL, style: 'circuit', weight: fw(0.7), generic: true },
        { name: 'Bodyweight', groups: ['Chest', 'Back', 'Quads', 'Core'], style: 'bodyweight', weight: 0.7 },
        cardio(0.9),
      ]
    case 'functional':
      return [
        { name: 'Hyrox-style', groups: FULL, style: 'hyrox', weight: fw(1.6), generic: true },
        { name: 'CrossFit-style', groups: FULL, style: 'crossfit', weight: fw(1.6), generic: true },
        { name: 'Lower strength', groups: ['Quads', 'Hamstrings', 'Glutes', 'Core'], style: 'strength', weight: 0.9 },
        { name: 'Upper strength', groups: ['Chest', 'Back', 'Shoulders'], style: 'strength', weight: 0.9 },
        { name: 'Full-body HIIT', groups: FULL, style: 'circuit', weight: fw(0.7), generic: true },
        { name: 'Bodyweight', groups: ['Chest', 'Back', 'Quads', 'Core'], style: 'bodyweight', weight: 0.5 },
        { name: 'Run / cardio', groups: [], style: 'standard', weight: 0.8 },
      ]
  }
}

/** Valid goals from one goal or several (a saved value may be stale); general fitness when none. */
export const goalList = (g: ProgramGoal | ProgramGoal[] | null | undefined): ProgramGoal[] => {
  const list = [...new Set((Array.isArray(g) ? g : g ? [g] : []).filter((x) => PROGRAM_GOALS.some((p) => p.id === x)))]
  return list.length ? list : ['fitness']
}

/**
 * Day types for one or more goals. Several goals blend: each goal's sessions keep their share of the week, and day
 * types they share (cardio, upper/lower) add up. Build muscle + lose fat gives muscle splits, circuits and more cardio.
 */
function dayTypes(goals: ProgramGoal[], daysPerWeek: number): DayType[] {
  const by = new Map<string, DayType>()
  for (const g of goals) {
    for (const t of goalDayTypes(g, daysPerWeek)) {
      const w = t.weight / goals.length
      const had = by.get(t.name)
      by.set(t.name, had ? { ...had, weight: had.weight + w } : { ...t, weight: w })
    }
  }
  return [...by.values()]
}

export type SplitId = 'auto' | 'full' | 'upperlower' | 'ppl' | 'arnold' | 'bodypart'

export const SPLITS: { id: SplitId; label: string; blurb: string; fits: number[] }[] = [
  { id: 'auto', label: 'Auto', blurb: 'Picks the day types for your goal and keeps sore muscles resting.', fits: [1, 2, 3, 4, 5, 6, 7] },
  { id: 'full', label: 'Full body', blurb: 'Every workout hits the whole body.', fits: [1, 2, 3] },
  { id: 'upperlower', label: 'Upper / Lower', blurb: 'Upper body, then lower body, back and forth.', fits: [2, 3, 4, 5, 6] },
  { id: 'ppl', label: 'Push / Pull / Legs', blurb: 'Push (chest, shoulders, triceps), pull (back, biceps), then legs.', fits: [3, 5, 6] },
  { id: 'arnold', label: 'Arnold', blurb: 'Chest & back, shoulders & arms, then legs.', fits: [3, 6] },
  { id: 'bodypart', label: 'Body-part split', blurb: 'One or two muscle groups a day.', fits: [4, 5] },
]

export const splitInfo = (id: SplitId) => SPLITS.find((s) => s.id === id)!

/** The split that suits a number of training days best. */
export function bestSplit(daysPerWeek: number): SplitId {
  return daysPerWeek <= 3 ? 'full' : daysPerWeek === 4 ? 'upperlower' : daysPerWeek === 5 ? 'bodypart' : 'ppl'
}

/** Workout style for split days: the lifting style that matches the goal. */
const SPLIT_STYLE: Record<ProgramGoal, WorkoutStyle> = { muscle: 'standard', strength: 'strength', fatloss: 'supersets', fitness: 'standard', functional: 'strength' }

/** The days of a split, in the order they repeat. */
function splitRotation(split: Exclude<SplitId, 'auto'>, daysPerWeek: number, style: WorkoutStyle): DayType[] {
  const d = (name: string, groups: string[]): DayType => ({ name, groups, style, weight: 1 })
  const push = d('Push', ['Chest', 'Shoulders', 'Triceps'])
  const pull = d('Pull', ['Back', 'Biceps', 'Core'])
  const legs = d('Legs', LOWER_BODY)
  const upper = d('Upper body', UPPER_BODY)
  const lower = d('Lower body', LOWER_BODY)
  switch (split) {
    case 'full': return [d('Full body', FULL)]
    case 'upperlower': return [upper, lower]
    // Five days: a push/pull/legs round, then upper and lower.
    case 'ppl': return daysPerWeek === 5 ? [push, pull, legs, upper, lower] : [push, pull, legs]
    case 'arnold': return [d('Chest & back', ['Chest', 'Back']), d('Shoulders & arms', ['Shoulders', ...ARMS]), legs]
    case 'bodypart':
      return daysPerWeek <= 4
        ? [d('Chest & triceps', ['Chest', 'Triceps']), d('Back & biceps', ['Back', 'Biceps']), legs, d('Shoulders & core', ['Shoulders', 'Core'])]
        : [d('Chest', ['Chest']), d('Back', ['Back']), legs, d('Shoulders & core', ['Shoulders', 'Core']), d('Arms', ARMS)]
  }
}

/** Lifting days repeat week to week so the numbers can climb; conditioning formats and cardio stay varied. */
const repeats = (t: DayType) => !t.generic && t.groups.length > 0 && ['standard', 'strength', 'supersets', 'bodyweight'].includes(t.style)

/**
 * Lifts logged in the last `weeks` weeks before `before`, most recent first. A new plan starts from these, so a
 * second month carries on from the first instead of from scratch.
 */
export function familiarLifts(logs: ExerciseLog[], before: string, weeks = 8): Set<string> {
  const from = toISO(addDays(parseISO(before), -7 * weeks))
  const recent = logs.filter((l) => l.date < before && l.date >= from && !l.cardio && workSets(l).length > 0).sort((a, b) => b.date.localeCompare(a.date))
  return new Set(recent.map((l) => l.exerciseId))
}

/**
 * Accessory lifts due for a change: done for about a month (first logged 4+ weeks ago, 3+ sessions), or stuck for 3
 * sessions. New plans swap these for fresh moves. Main lifts (squat, bench, deadlift, rows, presses…) stay, since
 * they're what you measure progress on; a stalled main lift gets a lighter week instead (see `suggestNext`).
 */
export function liftsToRotate(logs: ExerciseLog[], before: string, lookup: (id: string) => Exercise | undefined, weeks = 8): Set<string> {
  const from = toISO(addDays(parseISO(before), -7 * weeks))
  const monthAgo = toISO(addDays(parseISO(before), -28))
  const byLift = new Map<string, ExerciseLog[]>()
  for (const l of logs) {
    if (l.date >= before || l.date < from || l.cardio || workSets(l).length === 0) continue
    byLift.set(l.exerciseId, [...(byLift.get(l.exerciseId) ?? []), l])
  }
  const out = new Set<string>()
  for (const [id, ls] of byLift) {
    const ex = lookup(id)
    if (!ex || isMainLift(ex)) continue
    ls.sort((a, b) => b.date.localeCompare(a.date))
    const longTime = ls.at(-1)!.date <= monthAgo && ls.length >= 3
    if (longTime || plateau(ex, ls) > 0) out.add(id)
  }
  return out
}

const majorsOf = (t: DayType) => t.groups.filter((g) => MAJOR_GROUPS.includes(g))
const isCardioDay = (t: DayType) => t.groups.length === 0

/**
 * Cardio days take turns between kinds of session instead of the same steady 45 minutes every time. Mostly easy
 * (80/20 is how endurance is usually built), with harder sessions mixed in where the goal needs them.
 */
const CARDIO_ROTATION: Record<ProgramGoal, CardioSessionKind[]> = {
  muscle: ['steady', 'intervals', 'steady'],
  strength: ['steady', 'intervals', 'steady'],
  fitness: ['steady', 'intervals', 'tempo', 'steady'],
  fatloss: ['intervals', 'steady', 'tempo', 'steady', 'hills'],
  functional: ['intervals', 'steady', 'tempo', 'hills'],
}
export const cardioKindFor = (goals: ProgramGoal[], n: number): CardioSessionKind => {
  const r = CARDIO_ROTATION[goals[0]] ?? CARDIO_ROTATION.fitness
  return r[n % r.length]
}

export interface ProgramInput {
  /** Monday the program's first week starts on. */
  anchorMonday: string
  weeks: number
  /** Skip dates before this (e.g. today, when planning the current week). Defaults to the anchor. */
  fromDate?: string
  /** Weekdays to train, 0 = Monday … 6 = Sunday. Every other day is a rest day. */
  trainWeekdays: number[]
  /** One goal, or several to blend (the first sets the lifting style on named splits). */
  goal: ProgramGoal | ProgramGoal[]
  minutes: number
  /** Major muscle groups trained the day before the first date, so the plan doesn't start with a repeat. */
  prevDayGroups?: string[]
  rng?: Rng
  /** Warm-up on lifting days (its minutes are part of the session) and how long to rest between sets. */
  warmup?: WarmupOptions
  rest?: RestPref
  /** Workout styles the person enjoys: those sessions come up more, and liked formats the goal lacks are added. */
  likedStyles?: WorkoutStyle[]
  /** Drop sets on the last two lifts of lifting days. */
  dropSets?: boolean
  /** A named split run in order (push, pull, legs, push…). 'auto' (default) picks day types for the goal. */
  split?: SplitId
  /** Lifts they've been logging (see `familiarLifts`): new plans keep them so progress carries on. */
  familiar?: Set<string>
  /** Lifts to swap for something new (see `liftsToRotate`): used only if nothing else fits. */
  rotate?: Set<string>
}

/** Sessions for liked full-body formats that a goal doesn't include on its own. */
const EXTRA_TYPES: Partial<Record<WorkoutStyle, DayType>> = {
  hyrox: { name: 'Hyrox-style', groups: FULL, style: 'hyrox', weight: 1, generic: true },
  crossfit: { name: 'CrossFit-style', groups: FULL, style: 'crossfit', weight: 1, generic: true },
  circuit: { name: 'Full-body HIIT', groups: FULL, style: 'circuit', weight: 0.9, generic: true },
  amrap: { name: 'AMRAP', groups: FULL, style: 'amrap', weight: 0.8, generic: true },
  emom: { name: 'EMOM', groups: FULL, style: 'emom', weight: 0.8, generic: true },
  fortime: { name: 'Rounds for time', groups: FULL, style: 'fortime', weight: 0.8, generic: true },
  tabata: { name: 'Tabata', groups: FULL, style: 'tabata', weight: 0.7, generic: true },
  supersets: { name: 'Full-body supersets', groups: FULL, style: 'supersets', weight: 0.6 },
  bodyweight: { name: 'Bodyweight', groups: ['Chest', 'Back', 'Quads', 'Core'], style: 'bodyweight', weight: 0.6 },
}

/** Lean the week towards what someone likes, without dropping what their goal needs. */
function withLikes(types: DayType[], liked: WorkoutStyle[] = []): DayType[] {
  if (liked.length === 0) return types
  const out = types.map((t) => (liked.includes(t.style) && t.groups.length ? { ...t, weight: t.weight * 1.6 } : t))
  for (const st of liked) {
    const extra = EXTRA_TYPES[st]
    // Liked, so it gets the same lift as the goal's own liked sessions: it should show up most weeks.
    if (extra && !out.some((t) => t.style === st)) out.push({ ...extra, weight: extra.weight * 1.6 })
  }
  return out
}

export interface ProgramDay {
  date: string
  rest: boolean
  /** Session name, e.g. "Push (supersets)" or "Cardio · Intervals". */
  name?: string
  /** For cardio days: the kind of session (steady, intervals, tempo, hills…), kept when the day is rerolled. */
  cardioKind?: CardioSessionKind
  style?: WorkoutStyle
  /** Focus used to generate the workout (empty for full-body formats and cardio days). */
  focus: string[]
  /** Muscle groups worked, for recovery checks. */
  groups: string[]
  /**
   * Which workout this is in the weekly pattern (e.g. the second "Upper body" of the week). Lifting days with the same
   * slot repeat the same exercises every week, so weights and reps build week to week.
   */
  slot?: string
  weekIndex: number
  items: PlannedExercise[]
}

const DAY_MS = 86400000
const daysBetween = (a: string, b: string) => Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / DAY_MS)

/** Progressive overload for a 4-week block: one extra set in week 3, a lighter deload in week 4. */
export function applyProgression(items: PlannedExercise[], weekIndex: number, weeks: number): PlannedExercise[] {
  if (weeks !== 4 || weekIndex < 2) return items
  const delta = weekIndex === 2 ? 1 : -1
  return items.map((p) => {
    if (p.block || p.minutes || p.sets <= 1 || (p.seconds === undefined && p.reps === undefined)) return p
    const sets = Math.max(2, Math.min(5, p.sets + delta))
    if (sets === p.sets) return p
    const next = { ...p, sets }
    return { ...next, est: Math.round(liftMinutes(next, BY_ID.get(p.exerciseId)) * 10) / 10 }
  })
}

export function generateProgram(input: ProgramInput): ProgramDay[] {
  const { anchorMonday, weeks, trainWeekdays, goal, minutes, rng = Math.random } = input
  const first = input.fromDate && input.fromDate > anchorMonday ? input.fromDate : anchorMonday
  const total = weeks * 7
  const dpw = new Set(trainWeekdays).size
  const goals = goalList(goal)
  const types = withLikes(dayTypes(goals, dpw), input.likedStyles)
  const split = input.split && input.split !== 'auto' ? splitRotation(input.split, dpw, SPLIT_STYLE[goals[0]]) : null

  const lastTrained = new Map<string, number>() // group -> day offset it was last trained
  let cardioDays = 0
  const firstOffset = daysBetween(anchorMonday, first)
  let prevMajors = new Set((input.prevDayGroups ?? []).filter((g) => MAJOR_GROUPS.includes(g)))
  for (const g of prevMajors) lastTrained.set(g, firstOffset - 1)
  const recentTypes: string[] = [] // names of the last few session types
  const recent: string[][] = []
  const out: ProgramDay[] = []
  // Lifting workouts by slot, so each week repeats them (with the block's extra set / deload) instead of starting over.
  const templates = new Map<string, PlannedExercise[]>()
  const slotCount = new Map<string, number>()
  // A split starts on the first day that doesn't hit what was trained yesterday, then runs in order.
  let turn = split ? Math.max(0, split.findIndex((t) => !majorsOf(t).some((g) => prevMajors.has(g)))) : 0

  for (let offset = firstOffset; offset < total; offset++) {
    const date = toISO(addDays(parseISO(anchorMonday), offset))
    const weekIndex = Math.floor(offset / 7)
    if (!trainWeekdays.includes(weekdayIndex(parseISO(date)))) {
      out.push({ date, rest: true, focus: [], groups: [], weekIndex, items: [] })
      prevMajors = new Set()
      continue
    }

    // Never repeat a major muscle group from yesterday. Cardio days have none, so a choice always exists.
    const allowed = types.filter((t) => !majorsOf(t).some((g) => prevMajors.has(g)))
    const stale = (t: DayType) => {
      const m = majorsOf(t)
      if (m.length === 0) return 3
      return m.reduce((a, g) => a + Math.min(offset - (lastTrained.get(g) ?? -99), 7), 0) / m.length
    }
    const scored = allowed.map((t) => ({ t, s: t.weight * stale(t) * (0.85 + rng() * 0.3) * 0.5 ** recentTypes.filter((n) => n === t.name).length }))
    const type = split ? split[turn++ % split.length] : scored.reduce((a, b) => (b.s > a.s ? b : a)).t

    const focus = isCardioDay(type) ? ['Cardio'] : type.generic ? [] : type.groups
    const cardioKind = isCardioDay(type) ? cardioKindFor(goals, cardioDays++) : undefined
    const avoid = new Set([...recent.flat(), ...(input.rotate ?? [])])
    if (offset % 7 === 0) slotCount.clear()
    const nth = slotCount.get(type.name) ?? 0
    slotCount.set(type.name, nth + 1)
    const slot = repeats(type) ? `${type.name}#${nth}` : undefined
    let base = slot ? templates.get(slot) : undefined
    if (!base) {
      base = generateWorkout(focus, minutes, { style: type.style, rng, avoid, rest: input.rest, warmup: isCardioDay(type) ? undefined : input.warmup, dropSets: input.dropSets, familiar: input.familiar, ...(cardioKind ? { cardio: { kind: cardioKind } } : {}) })
      if (slot) templates.set(slot, base)
    }
    const items = applyProgression(base.map((p) => ({ ...p })), weekIndex, weeks)
    recent.push(items.map((p) => p.exerciseId))
    if (recent.length > 6) recent.shift()

    for (const g of majorsOf(type)) lastTrained.set(g, offset)
    prevMajors = new Set(majorsOf(type))
    recentTypes.push(type.name)
    if (recentTypes.length > 3) recentTypes.shift()
    // A cardio day says what kind of session it is ("Cardio · Intervals"), so the week reads like a real plan.
    const name = cardioKind ? `${type.name} · ${CARDIO_SESSIONS.find((k) => k.id === cardioKind)!.label}` : type.name
    out.push({ date, rest: items.length === 0, name, style: type.style, focus, groups: type.groups, weekIndex, items, slot, cardioKind })
  }
  return out
}

/** Regenerate one day with the same session type (used by "reroll this day"). */
export function rerollDay(day: ProgramDay, minutes: number, weeks: number, avoidIds: Set<string>, rng: Rng = Math.random, opts: { warmup?: WarmupOptions; rest?: RestPref; dropSets?: boolean } = {}): ProgramDay {
  if (day.rest || !day.style) return day
  const cardioDay = day.focus.length === 1 && day.focus[0] === 'Cardio'
  const items = applyProgression(generateWorkout(day.focus, minutes, { style: day.style, rng, avoid: avoidIds, rest: opts.rest, warmup: cardioDay ? undefined : opts.warmup, dropSets: opts.dropSets, ...(day.cardioKind ? { cardio: { kind: day.cardioKind } } : {}) }), day.weekIndex, weeks)
  return { ...day, items }
}

/** Reroll a day and every other week's copy of it (same slot), keeping each week's extra set or deload. */
export function rerollSlot(days: ProgramDay[], date: string, minutes: number, weeks: number, avoidIds: Set<string>, rng: Rng = Math.random, opts: { warmup?: WarmupOptions; rest?: RestPref; dropSets?: boolean } = {}): ProgramDay[] {
  const day = days.find((d) => d.date === date)
  if (!day) return days
  if (!day.slot) return days.map((d) => (d === day ? rerollDay(d, minutes, weeks, avoidIds, rng, opts) : d))
  const base = rerollDay({ ...day, weekIndex: 0 }, minutes, weeks, avoidIds, rng, opts).items
  return days.map((d) => (d.slot === day.slot ? { ...d, items: applyProgression(base.map((p) => ({ ...p })), d.weekIndex, weeks) } : d))
}

/** Major muscle groups logged on a date, for recovery-aware planning. */
export function majorGroupsLogged(logs: ExerciseLog[], date: string, lookup: (id: string) => Exercise | undefined): string[] {
  const groups = new Set<string>()
  for (const l of logs) {
    if (l.date !== date || !hasData(l)) continue
    const ex = lookup(l.exerciseId)
    const g = ex && partFromName(ex.group, ex.name)
    if (g && MAJOR_GROUPS.includes(g)) groups.add(g)
  }
  return [...groups]
}

export const goalInfo = (id: ProgramGoal) => PROGRAM_GOALS.find((g) => g.id === id)!
export const styleLabel = (s?: WorkoutStyle) => (s ? styleInfo(s).label : '')

/** Sensible default training days for N days a week, spread out so rest days land between sessions. */
export function defaultWeekdays(n: number): number[] {
  const presets: Record<number, number[]> = {
    1: [2], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 3, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6],
  }
  return presets[Math.min(7, Math.max(1, n))]
}

/** Training days for endurance plans: a weekend long session, with the hard midweek session well away from it. */
export function cardioWeekdays(n: number): number[] {
  const presets: Record<number, number[]> = {
    2: [3, 5], 3: [1, 3, 5], 4: [1, 2, 3, 5], 5: [0, 1, 3, 4, 5], 6: [0, 1, 2, 3, 4, 5],
  }
  return presets[Math.min(6, Math.max(2, n))]
}

/** Someone's saved goals: the list, or the single goal saved before goals could be combined. */
export const savedGoals = (p: { goals?: ProgramGoal[]; goal?: ProgramGoal | null }): ProgramGoal[] =>
  (Array.isArray(p.goals) ? p.goals : p.goal ? [p.goal] : []).filter((g) => PROGRAM_GOALS.some((x) => x.id === g))

/** "Build muscle + Lose fat". */
export const goalsLabel = (goals: ProgramGoal[]) => goals.map((g) => goalInfo(g).label).join(' + ')
