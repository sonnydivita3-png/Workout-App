import { EXERCISES } from '../data/exercises'
import type { Exercise, ExerciseKind, ExerciseLog, ExerciseMode } from '../types'
import { BODY_PARTS } from './bodyParts'
import { modeOf } from './exerciseModes'
import { SYNC_KEYS } from './sync'

/** What someone fills in for an exercise of their own. */
export interface CustomExerciseInput {
  name: string
  /** A body part, or Cardio, Conditioning, Mobility or Other: the exercise list's tabs. */
  group: string
  equipment: string
  /** How sets are logged (lifting only). Left out: what suits the equipment. */
  mode?: ExerciseMode
}

/** Where it's filed, in the same order as the exercise list's tabs. Cardio makes it a cardio exercise. */
export const CUSTOM_GROUPS: string[] = [...BODY_PARTS, 'Forearms', 'Cardio', 'Conditioning', 'Mobility', 'Other']
/** The exercise list's equipment filters, and what cardio is done on. */
export const LIFT_EQUIPMENT: string[] = ['Barbell', 'Dumbbell', 'Bodyweight', 'Cable', 'Machine', 'Kettlebell', 'Bands', 'Other']
export const CARDIO_EQUIPMENT: string[] = ['Machine', 'Outdoor', 'Other']
export const MODE_CHOICES: [ExerciseMode, string][] = [['weight', 'Weight × reps'], ['reps', 'Reps only'], ['time', 'Time']]

export const kindOf = (group: string): ExerciseKind => (group === 'Cardio' ? 'cardio' : 'strength')
export const equipmentFor = (group: string | null) => (group === 'Cardio' ? CARDIO_EQUIPMENT : LIFT_EQUIPMENT)

/** How it's most likely logged: stretches by time, bodyweight moves by reps, the rest with weight. */
export const defaultMode = (group: string | null, equipment: string | null): ExerciseMode =>
  group === 'Mobility' ? 'time' : equipment === 'Bodyweight' ? 'reps' : 'weight'

/** Single spaces, and no longer than names can be when shared with friends. */
export const cleanName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, 60)

// Lowercase words without punctuation or a plural s: "Farmers carry" is "Farmer's Carry", "Push-Ups" is "Pushup".
const squash = (t: string) => t.toLowerCase().split(/[^\p{L}\p{N}]+/u).map((w) => w.replace(/s$/, '')).join('')
/** The same name, ignoring case, spaces, hyphens, plurals and the like. */
export const sameName = (a: string, b: string) => !!squash(a) && squash(a) === squash(b)

/** The library exercise, or one of their own, already called this. */
export function findDuplicate(name: string, custom: Exercise[], exceptId?: string): Exercise | undefined {
  const named = (e: Exercise) => sameName(e.name, name) || (!!e.fullName && sameName(e.fullName, name))
  return custom.find((e) => !e.retired && e.id !== exceptId && named(e)) ?? EXERCISES.find(named)
}

/** The exercise's fields from what they filled in, with anything unexpected put right. */
export function customFields(input: CustomExerciseInput): Pick<Exercise, 'name' | 'kind' | 'mode' | 'group' | 'equipment'> {
  const group = CUSTOM_GROUPS.includes(input.group) ? input.group : 'Other'
  const kind = kindOf(group)
  const equipment = equipmentFor(group).includes(input.equipment) ? input.equipment : 'Other'
  return { name: cleanName(input.name) || 'My exercise', kind, mode: kind === 'strength' ? input.mode ?? defaultMode(group, equipment) : undefined, group, equipment }
}

/** "Shoulders · Barbell · weight × reps" */
export const customDetail = (e: Exercise) =>
  [e.group, e.equipment === 'Custom' ? null : e.equipment, e.kind === 'strength' ? MODE_CHOICES.find(([m]) => m === (modeOf(e) ?? 'weight'))![1].toLowerCase() : 'time and distance'].filter(Boolean).join(' · ')

/** A fresh id for a new exercise. */
export function newCustomId(custom: Exercise[]): string {
  const base = `custom-${Date.now().toString(36)}`
  let id = base
  for (let n = 2; custom.some((e) => e.id === id); n++) id = `${base}-${n}`
  return id
}

// Saved data that belongs to the exercise itself rather than using it.
const OWN = new Set<string>(['custom', 'favorites', 'exerciseModes', 'logs'])

/**
 * What uses an exercise: the days it was logged, and whether anything saved refers to it (logs, plans, routines,
 * goals, timed workouts…). Ids are whole strings in the saved data, so finding one in its JSON finds every use.
 */
export function usageOf(data: Record<string, unknown>, id: string): { days: number; used: boolean } {
  const logs = Array.isArray(data.logs) ? (data.logs as ExerciseLog[]) : []
  const days = new Set(logs.filter((l) => l.exerciseId === id).map((l) => l.date)).size
  const needle = JSON.stringify(id)
  return { days, used: days > 0 || SYNC_KEYS.some((k) => !OWN.has(k) && JSON.stringify(data[k] ?? null).includes(needle)) }
}
