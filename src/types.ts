export type ExerciseKind = 'strength' | 'cardio'

export interface Exercise {
  id: string
  name: string
  kind: ExerciseKind
  group: string // muscle group (strength) or "Cardio"
  equipment?: string
  custom?: boolean
}

/** All weights are stored in pounds and distances in miles; units only affect display. */
export interface StrengthSet {
  weight: number | null
  reps: number | null
}

export interface CardioEntry {
  distance: number | null
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

export interface Units {
  weight: 'lb' | 'kg'
  distance: 'mi' | 'km'
}

export interface BodyweightEntry {
  date: string
  lb: number
}

export interface Routine {
  id: string
  name: string
  items: PlannedExercise[]
}

/** Weights are stored in pounds, like everything else. */
export type Goal =
  | { id: string; type: 'workouts'; perWeek: number }
  | { id: string; type: 'bodyweight'; target: number; start: number | null }
  | { id: string; type: 'lift'; exerciseId: string; target: number }

export type NewGoal = Goal extends infer G ? (G extends Goal ? Omit<G, 'id'> : never) : never
