export type ExerciseKind = 'strength' | 'cardio'

/** How a lifting exercise is measured: weight × reps, reps only (bodyweight), or a timed hold. */
export type ExerciseMode = 'weight' | 'reps' | 'time'

export interface Exercise {
  id: string
  name: string
  /** The library's full name when `name` is a shorter everyday one (e.g. "Barbell Bench Press - Medium Grip"). */
  fullName?: string
  kind: ExerciseKind
  mode?: ExerciseMode // lifting only; missing means 'weight'
  group: string // muscle group (strength) or "Cardio"
  equipment?: string
  custom?: boolean
  suggest?: boolean // sensible for the randomizer to pick
  tags?: string[] // 'hiit' | 'crossfit' | 'hyrox' — which workout styles can draw on it
}

/** All weights are stored in pounds and distances in miles; units only affect display. */
export interface StrengthSet {
  weight: number | null
  reps: number | null
  seconds?: number | null // timed exercises
  /** Warm-up sets don't count toward records, volume or progress. */
  warmup?: boolean
  /** How hard it felt, 1-10 (10 = nothing left). */
  rpe?: number | null
  /** Ticked ✓ (false = unticked on purpose). Older sets without it count as ticked when they have numbers. */
  done?: boolean
  /** The numbers came from ✓ filling in the target, so unticking clears them again. */
  auto?: boolean
}

export interface CardioEntry {
  distance: number | null
  minutes: number | null
}

/** Time-based workout formats: as many rounds as possible, every minute on the minute, or a fixed amount of work against the clock. */
export type WodKind = 'amrap' | 'emom' | 'fortime' | 'tabata'

export interface Wod {
  kind: WodKind
  /** AMRAP: the time cap. EMOM: total minutes. For time: the time cap. */
  minutes: number
  /** EMOM: minutes per interval (1 = every minute on the minute). */
  interval?: number
  /** For time: how many rounds to finish. Tabata: rounds per movement. */
  rounds?: number
  /** Tabata: seconds of work and rest in each round (classically 20 on / 10 off). */
  work?: number
  rest?: number
  /** Tabata: seconds of rest between movements. */
  gap?: number
  /** Tabata: total work intervals across all movements (movements × rounds). */
  intervals?: number
}

/** A logged result for a whole timed block (the exercises in it are also logged, so history and streaks keep working). */
export interface TimedLog {
  id: string
  date: string
  block: string
  wod: Wod
  title: string
  /** Exercise ids in the block, in order. */
  movements: string[]
  /** AMRAP: full rounds. For time: rounds completed. */
  rounds?: number
  /** AMRAP: extra reps on top of the last full round. */
  reps?: number
  /** EMOM / Tabata: intervals completed. */
  intervals?: number
  /** For time: finishing time in seconds. */
  seconds?: number
  /** For time: stopped by the time cap instead of finishing. */
  capped?: boolean
}

/** One planned exercise on a weekday template. */
export interface PlannedExercise {
  exerciseId: string
  sets: number // ignored for cardio
  reps?: number // target reps per set (weights / bodyweight)
  seconds?: number // target hold per set (timed exercises)
  minutes?: number // target duration (cardio)
  // Structured workouts (supersets, circuits, Hyrox, CrossFit). Items sharing a `block` are shown together.
  block?: string
  blockLabel?: string // e.g. "Superset 1" or "Circuit · 4 rounds · 40s on / 20s off"
  note?: string // extra instruction, e.g. "50 m" or "40s on / 20s off"
  est?: number // estimated minutes for this item, when the standard sets formula doesn't apply
  distance?: number // target distance in miles (cardio)
  /** Set on every item of a timed block (AMRAP / EMOM / for time). `reps` or `seconds` is per round. */
  wod?: Wod
  /** Planned rest after each set, in seconds (used for time estimates and the rest timer). */
  rest?: number
  /** Light ramp-up sets before the working sets. */
  warmupSets?: number
  /** Part of the warm-up (easy cardio or mobility), not the workout itself: not tracked as progress. */
  warmup?: boolean
}

/** Plan is a weekly template: 0 = Monday ... 6 = Sunday. */
export type WeekPlan = PlannedExercise[][]

/** Specific dates (YYYY-MM-DD) that override the weekly template, e.g. from a generated program. An empty array is a rest day. */
export type PlanOverrides = Record<string, PlannedExercise[]>

export type Sport = 'run' | 'bike'
export type CardioSport = Sport | 'any'
export type GoalPeriod = 'week' | 'month'

export interface ExerciseLog {
  exerciseId: string
  date: string // YYYY-MM-DD
  sets?: StrengthSet[]
  cardio?: CardioEntry
  note?: string
}

export interface Units {
  weight: 'lb' | 'kg'
  distance: 'mi' | 'km'
}

/** Body measurements. Lengths are stored in inches; body fat is a percentage. */
export interface Measurement {
  id: string
  date: string
  waist?: number
  chest?: number
  arms?: number
  hips?: number
  thighs?: number
  bodyfat?: number
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
  // target is pounds for 'weight', a rep count for 'reps', seconds for 'time'
  | { id: string; type: 'lift'; exerciseId: string; target: number; mode?: ExerciseMode }
  // Cardio goals. Distances are miles, times are minutes, run pace is minutes per mile, bike speed is mph.
  | { id: string; type: 'cardio-distance'; sport: CardioSport; period: GoalPeriod; target: number }
  | { id: string; type: 'cardio-time'; sport: CardioSport; period: GoalPeriod; target: number }
  | { id: string; type: 'cardio-pace'; sport: Sport; minDistance: number; target: number }
  | { id: string; type: 'race'; sport: Sport; label: string; distance: number; date?: string }

/** A plan that was added to the calendar in one go, so it can be stopped or replaced as a unit. */
export interface Program {
  id: string
  kind: 'cardio' | 'program'
  title: string
  sport?: Sport
  /** The race goal this plan trains for, if any. */
  goalId?: string
  createdAt: string
  /** The dates it wrote. Cardio entries name the exercise (running/cycling) so only that is removed. */
  entries: { date: string; exerciseId?: string }[]
}

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
