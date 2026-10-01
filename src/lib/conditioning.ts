import type { Exercise, ExerciseLog, PlannedExercise, PlanOverrides, TimedLog, WeekPlan } from '../types'
import { cardioTypeOf } from './cardioPrefs'
import { addDays, mondayOf, parseISO, toISO } from './dates'
import { dayPlanOf } from './plan'
import { tabataOf, wodSignature } from './wod'

/** Monday–Sunday of the week `weeksAgo` before the one holding `date`. */
export function weekOf(date: string, weeksAgo = 0): [string, string] {
  const mon = addDays(mondayOf(parseISO(date)), -7 * weeksAgo)
  return [toISO(mon), toISO(addDays(mon, 6))]
}

const inRange = (d: string, [from, to]: [string, string]) => d >= from && d <= to

/** Movements that were part of a timed result or a Hyrox session that day: counted as conditioning, not cardio. */
function conditioningMoves(timedLogs: TimedLog[]): Set<string> {
  return new Set(timedLogs.flatMap((t) => t.movements.map((id) => `${t.date}|${id}`)))
}

export interface CardioWeek {
  /** Minutes per kind of cardio (Running, Rower…), most first. */
  byType: { label: string; minutes: number }[]
  minutes: number
  /** Miles. */
  distance: number
}

/** Steady cardio logged in a week. Runs and rows inside a timed workout or Hyrox count as conditioning instead. */
export function cardioWeek(logs: ExerciseLog[], timedLogs: TimedLog[], range: [string, string], lookup: (id: string) => Exercise | undefined): CardioWeek {
  const skip = conditioningMoves(timedLogs)
  const by = new Map<string, number>()
  let minutes = 0
  let distance = 0
  for (const l of logs) {
    if (!l.cardio || !inRange(l.date, range) || skip.has(`${l.date}|${l.exerciseId}`)) continue
    const m = l.cardio.minutes ?? 0
    const label = cardioTypeOf(l.exerciseId)?.label ?? lookup(l.exerciseId)?.name ?? 'Cardio'
    if (m) by.set(label, (by.get(label) ?? 0) + m)
    minutes += m
    distance += l.cardio.distance ?? 0
  }
  return { byType: [...by].map(([label, m]) => ({ label, minutes: m })).sort((a, b) => b.minutes - a.minutes), minutes, distance }
}

/** How long a timed result took: the finishing time when there is one, else the format's length. */
export function timedMinutes(t: TimedLog): number {
  if (t.seconds != null && !t.capped) return t.seconds / 60
  if (t.wod.kind === 'tabata') return tabataOf(t.wod, t.movements.length).total / 60
  return t.wod.minutes
}

export type ConditioningKind = 'Hyrox' | 'AMRAP' | 'EMOM' | 'For time' | 'Tabata' | 'Circuits'
const KIND_LABEL: Record<TimedLog['wod']['kind'], ConditioningKind> = { amrap: 'AMRAP', emom: 'EMOM', fortime: 'For time', tabata: 'Tabata' }

export interface ConditioningWeek {
  byKind: { label: ConditioningKind; minutes: number }[]
  minutes: number
  sessions: number
}

/**
 * Hard, mixed work in a week: timed results (AMRAP, EMOM, for time, Tabata), Hyrox sessions with a finish time, and
 * HIIT / PHA circuits that were logged (their planned length, since circuits have no clock of their own).
 */
export function conditioningWeek(
  timedLogs: TimedLog[],
  logs: ExerciseLog[],
  plan: WeekPlan,
  overrides: PlanOverrides,
  range: [string, string],
): ConditioningWeek {
  const by = new Map<ConditioningKind, number>()
  let sessions = 0
  const add = (k: ConditioningKind, m: number) => { by.set(k, (by.get(k) ?? 0) + m); sessions++ }
  for (const t of timedLogs) if (inRange(t.date, range)) add(t.hyrox ? 'Hyrox' : KIND_LABEL[t.wod.kind], timedMinutes(t))
  for (let d = range[0]; d <= range[1]; d = toISO(addDays(parseISO(d), 1))) {
    const circuit = dayPlanOf(plan, overrides, d).filter((p) => p.block === 'circuit' || p.block === 'pha')
    const done = circuit.filter((p) => logs.some((l) => l.date === d && l.exerciseId === p.exerciseId && (l.sets?.some((s) => s.reps || s.seconds || s.weight) || l.cardio)))
    if (done.length) add('Circuits', circuit.reduce((a, p) => a + (p.est ?? 0), 0))
  }
  const byKind = [...by].map(([label, minutes]) => ({ label, minutes })).sort((a, b) => b.minutes - a.minutes)
  return { byKind, minutes: byKind.reduce((a, k) => a + k.minutes, 0), sessions }
}

/** Results for the same workout (same format and movements; Hyrox by its layout), oldest first. */
export function resultsFor(timedLogs: TimedLog[], like: { kind: TimedLog['wod']['kind']; movements: string[]; title?: string; hyrox?: boolean }): TimedLog[] {
  const sig = wodSignature(like.kind, like.movements)
  return timedLogs
    .filter((t) => (like.hyrox ? t.hyrox && t.title === like.title : !t.hyrox && wodSignature(t.wod.kind, t.movements) === sig))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * One number per result, to chart and compare: AMRAP rounds (extra reps as a fraction of a round), intervals for EMOM
 * and Tabata, minutes for for-time (lower is better). A capped for-time result has no time, so it isn't charted.
 */
export function resultScore(t: TimedLog, items?: PlannedExercise[]): number | null {
  if (t.wod.kind === 'amrap') {
    const perRound = items?.reduce((a, p) => a + (p.reps ?? 0), 0) || 0
    return (t.rounds ?? 0) + (t.reps ? (perRound ? Math.min(0.99, t.reps / perRound) : 0) : 0)
  }
  if (t.wod.kind === 'emom' || t.wod.kind === 'tabata') return t.intervals ?? 0
  return t.capped || t.seconds == null ? null : t.seconds / 60
}

/** Lower is better only for timed finishes. */
export const lowerIsBetter = (t: Pick<TimedLog, 'wod'>) => t.wod.kind === 'fortime'

/** Average run pace in a Hyrox session (minutes per mile), from that day's run log. */
export function hyroxRunPace(t: TimedLog, logs: ExerciseLog[], lookup: (id: string) => Exercise | undefined): number | null {
  const run = logs.find((l) => l.date === t.date && t.movements.includes(l.exerciseId) && l.cardio && /run/i.test(lookup(l.exerciseId)?.name ?? ''))
  const { distance, minutes } = run?.cardio ?? {}
  return distance && minutes ? minutes / distance : null
}

/** Moderate-intensity cardio guideline (minutes a week); 75 vigorous minutes count the same. */
export const CARDIO_GUIDE = 150
