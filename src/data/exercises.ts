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

// Movements the dataset lacks, mostly for HIIT / Hyrox / CrossFit-style workouts.
// [id, name, group, equipment, mode, suggest for normal randomizing, tags]
type Extra = [string, string, string, string, 'weight' | 'reps' | 'time', boolean, string[]]
const EXTRAS: Extra[] = [
  ['x-skierg', 'SkiErg', 'Conditioning', 'Machine', 'time', false, ['hyrox']],
  ['x-sled-push', 'Sled Push', 'Conditioning', 'Sled', 'time', false, ['hyrox']],
  ['x-sled-pull', 'Sled Pull', 'Conditioning', 'Sled', 'time', false, ['hyrox']],
  ['x-burpee-broad-jump', 'Burpee Broad Jump', 'Conditioning', 'Bodyweight', 'reps', false, ['hyrox']],
  ['x-row-erg', 'Row Erg', 'Conditioning', 'Machine', 'time', false, ['hyrox', 'crossfit', 'hiit']],
  ['x-farmers-carry', "Farmer's Carry", 'Conditioning', 'Dumbbell', 'time', false, ['hyrox']],
  ['x-sandbag-lunges', 'Sandbag Lunges', 'Conditioning', 'Sandbag', 'reps', false, ['hyrox']],
  ['x-wall-balls', 'Wall Balls', 'Conditioning', 'Medicine ball', 'reps', false, ['hyrox', 'crossfit']],
  ['x-burpee', 'Burpee', 'Conditioning', 'Bodyweight', 'reps', false, ['hiit', 'crossfit']],
  ['x-jump-squat', 'Jump Squat', 'Legs', 'Bodyweight', 'reps', true, ['hiit']],
  ['x-high-knees', 'High Knees', 'Conditioning', 'Bodyweight', 'time', false, ['hiit']],
  ['x-jumping-jacks', 'Jumping Jacks', 'Conditioning', 'Bodyweight', 'time', false, ['hiit']],
  ['x-box-jump', 'Box Jump', 'Legs', 'Box', 'reps', true, ['hiit', 'crossfit']],
  ['x-kb-swing', 'Kettlebell Swing', 'Glutes', 'Kettlebell', 'weight', true, ['hiit', 'crossfit']],
  ['x-thruster', 'Dumbbell Thruster', 'Conditioning', 'Dumbbell', 'weight', false, ['hiit', 'crossfit']],
  ['x-db-snatch', 'Dumbbell Snatch', 'Conditioning', 'Dumbbell', 'weight', false, ['hiit', 'crossfit']],
  ['x-double-unders', 'Double Unders', 'Conditioning', 'Jump rope', 'reps', false, ['crossfit']],
  ['x-toes-to-bar', 'Toes to Bar', 'Core', 'Bodyweight', 'reps', true, ['crossfit']],
  ['x-air-squat', 'Air Squat', 'Legs', 'Bodyweight', 'reps', true, ['hiit', 'crossfit']],
  ['x-goblet-squat', 'Goblet Squat', 'Legs', 'Kettlebell', 'weight', true, ['hiit']],
  // Dynamic warm-up moves (ids match free-exercise-db so the how-to pictures work). Tag says which half they warm.
  ['Arm_Circles', 'Arm Circles', 'Mobility', 'Bodyweight', 'time', false, ['mobility', 'upper']],
  ['Shoulder_Circles', 'Shoulder Circles', 'Mobility', 'Bodyweight', 'time', false, ['mobility', 'upper']],
  ['Round_The_World_Shoulder_Stretch', 'Round The World Shoulder Stretch', 'Mobility', 'Bodyweight', 'time', false, ['mobility', 'upper']],
  ['Dynamic_Chest_Stretch', 'Dynamic Chest Stretch', 'Mobility', 'Bodyweight', 'time', false, ['mobility', 'upper']],
  ['Dynamic_Back_Stretch', 'Dynamic Back Stretch', 'Mobility', 'Bodyweight', 'time', false, ['mobility', 'upper']],
  ['Wrist_Circles', 'Wrist Circles', 'Mobility', 'Bodyweight', 'time', false, ['mobility', 'upper']],
  ['Cat_Stretch', 'Cat Stretch (cat-cow)', 'Mobility', 'Bodyweight', 'time', false, ['mobility', 'full']],
  ['Inchworm', 'Inchworm', 'Mobility', 'Bodyweight', 'time', false, ['mobility', 'full']],
  ['Worlds_Greatest_Stretch', "World's Greatest Stretch", 'Mobility', 'Bodyweight', 'time', false, ['mobility', 'full']],
  ['Standing_Hip_Circles', 'Standing Hip Circles', 'Mobility', 'Bodyweight', 'time', false, ['mobility', 'lower']],
  ['Front_Leg_Raises', 'Leg Swings (front)', 'Mobility', 'Bodyweight', 'time', false, ['mobility', 'lower']],
  ['Side_Leg_Raises', 'Leg Swings (side)', 'Mobility', 'Bodyweight', 'time', false, ['mobility', 'lower']],
  ['Crossover_Reverse_Lunge', 'Crossover Reverse Lunge', 'Mobility', 'Bodyweight', 'time', false, ['mobility', 'lower']],
  ['Knee_Circles', 'Knee Circles', 'Mobility', 'Bodyweight', 'time', false, ['mobility', 'lower']],
  ['Ankle_Circles', 'Ankle Circles', 'Mobility', 'Bodyweight', 'time', false, ['mobility', 'lower']],
]

EXERCISES.push(
  ...EXTRAS.map(([id, name, group, equipment, mode, suggest, tags]): Exercise => ({
    id, name, group, equipment, kind: 'strength', mode, suggest, tags,
  })),
)

export const BUILTIN_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))
