export type ExerciseKind = 'strength' | 'cardio'

export interface Exercise {
  id: string
  name: string
  kind: ExerciseKind
  group: string // muscle group (strength) or "Cardio"
  equipment?: string
  custom?: boolean
  suggest?: boolean // sensible for the randomizer to pick
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
  reps?: number // target reps per set (lifting)
  minutes?: number // target duration (cardio)
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

export type NotificationType = 'goal-reached' | 'goal-close' | 'pr' | 'planned'

export interface AppNotification {
  id: string // deterministic, so the same event is never announced twice
  type: NotificationType
  title: string
  body: string
  ts: number
  read: boolean
}

export interface NotifPrefs {
  system: boolean // also send OS-level notifications (needs browser permission)
  goals: boolean
  pbs: boolean
  daily: boolean
  reminderTime: string // HH:MM, local
}
