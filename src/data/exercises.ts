import type { Exercise } from '../types'
import raw from './exercises.json'

// Built from free-exercise-db (public domain): [id, name, group, equipment, isCardio, suggest, mode 0=weight 1=reps 2=timed]
type Row = [string, string, string, string, number, number, number]

const MODES = ['weight', 'reps', 'time'] as const

export const EXERCISES: Exercise[] = (raw as Row[]).map(([id, name, group, equipment, cardio, suggest, mode]) => ({
  id,
  name,
  group,
  equipment,
  kind: cardio ? 'cardio' : 'strength',
  mode: cardio ? undefined : MODES[mode],
  suggest: !!suggest,
}))

export const BUILTIN_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))
