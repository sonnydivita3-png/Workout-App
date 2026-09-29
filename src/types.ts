export type ExerciseKind = 'strength' | 'cardio'

export interface Exercise {
  id: string
  name: string
  kind: ExerciseKind
  group: string // muscle group (strength) or modality (cardio)
  equipment?: string
}

export interface StrengthSet {
  weight: number | null
  reps: number | null
}

export interface CardioEntry {
  distance: number | null // miles
  minutes: number | null
}

/** One planned exercise on a weekday template. */
export interface PlannedExercise {
  exerciseId: string
  sets: number // ignored for cardio
}

/** Plan is a weekly template: 0 = Monday ... 6 = Sunday. */
export type WeekPlan = PlannedExercise[][]

export interface ExerciseLog {
  exerciseId: string
  date: string // YYYY-MM-DD
  sets?: StrengthSet[]
  cardio?: CardioEntry
}
