import type { Exercise } from '../types'
import raw from './exercises.json'

// Built from free-exercise-db (public domain): [id, name, group, equipment, isCardio, suggest]
type Row = [string, string, string, string, number, number]

export const EXERCISES: Exercise[] = (raw as Row[]).map(([id, name, group, equipment, cardio, suggest]) => ({
  id,
  name,
  group,
  equipment,
  kind: cardio ? 'cardio' : 'strength',
  suggest: !!suggest,
}))

export const BUILTIN_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))
