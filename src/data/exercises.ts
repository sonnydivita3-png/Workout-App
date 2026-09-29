import type { Exercise } from '../types'

type Seed = [name: string, group: string, equipment: string]

const strength: Seed[] = [
  ['Barbell Bench Press', 'Chest', 'Barbell'],
  ['Incline Dumbbell Press', 'Chest', 'Dumbbell'],
  ['Push-Up', 'Chest', 'Bodyweight'],
  ['Cable Fly', 'Chest', 'Cable'],
  ['Deadlift', 'Back', 'Barbell'],
  ['Barbell Row', 'Back', 'Barbell'],
  ['Pull-Up', 'Back', 'Bodyweight'],
  ['Lat Pulldown', 'Back', 'Cable'],
  ['Seated Cable Row', 'Back', 'Cable'],
  ['Overhead Press', 'Shoulders', 'Barbell'],
  ['Dumbbell Lateral Raise', 'Shoulders', 'Dumbbell'],
  ['Face Pull', 'Shoulders', 'Cable'],
  ['Barbell Back Squat', 'Legs', 'Barbell'],
  ['Front Squat', 'Legs', 'Barbell'],
  ['Romanian Deadlift', 'Legs', 'Barbell'],
  ['Leg Press', 'Legs', 'Machine'],
  ['Walking Lunge', 'Legs', 'Dumbbell'],
  ['Leg Curl', 'Legs', 'Machine'],
  ['Standing Calf Raise', 'Legs', 'Machine'],
  ['Hip Thrust', 'Glutes', 'Barbell'],
  ['Barbell Curl', 'Arms', 'Barbell'],
  ['Hammer Curl', 'Arms', 'Dumbbell'],
  ['Triceps Pushdown', 'Arms', 'Cable'],
  ['Skull Crusher', 'Arms', 'Barbell'],
  ['Plank', 'Core', 'Bodyweight'],
  ['Hanging Leg Raise', 'Core', 'Bodyweight'],
  ['Cable Crunch', 'Core', 'Cable'],
]

const cardio: Seed[] = [
  ['Running', 'Cardio', 'Outdoor'],
  ['Treadmill', 'Cardio', 'Machine'],
  ['Cycling', 'Cardio', 'Bike'],
  ['Rowing', 'Cardio', 'Machine'],
  ['Swimming', 'Cardio', 'Pool'],
  ['Elliptical', 'Cardio', 'Machine'],
  ['Stair Climber', 'Cardio', 'Machine'],
  ['Walking', 'Cardio', 'Outdoor'],
  ['Hiking', 'Cardio', 'Outdoor'],
]

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')

export const EXERCISES: Exercise[] = [
  ...strength.map(([name, group, equipment]) => ({
    id: slug(name), name, group, equipment, kind: 'strength' as const,
  })),
  ...cardio.map(([name, group, equipment]) => ({
    id: slug(name), name, group, equipment, kind: 'cardio' as const,
  })),
]

export const EXERCISE_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))
