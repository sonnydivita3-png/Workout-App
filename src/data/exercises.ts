import type { Exercise } from '../types'
import raw from './exercises.json'

// Built from free-exercise-db (public domain): [id, name, body part, equipment, isCardio, suggest, mode 0=weight 1=reps 2=timed].
// Body parts come from each exercise's primary muscle (scripts/split-groups.py).
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
  ['x-jump-squat', 'Jump Squat', 'Quads', 'Bodyweight', 'reps', true, ['hiit']],
  ['x-high-knees', 'High Knees', 'Conditioning', 'Bodyweight', 'time', false, ['hiit']],
  ['x-jumping-jacks', 'Jumping Jacks', 'Conditioning', 'Bodyweight', 'time', false, ['hiit']],
  ['x-box-jump', 'Box Jump', 'Quads', 'Box', 'reps', true, ['hiit', 'crossfit']],
  ['x-kb-swing', 'Kettlebell Swing', 'Glutes', 'Kettlebell', 'weight', true, ['hiit', 'crossfit']],
  ['x-thruster', 'Dumbbell Thruster', 'Conditioning', 'Dumbbell', 'weight', false, ['hiit', 'crossfit']],
  ['x-db-snatch', 'Dumbbell Snatch', 'Conditioning', 'Dumbbell', 'weight', false, ['hiit', 'crossfit']],
  ['x-double-unders', 'Double Unders', 'Conditioning', 'Jump rope', 'reps', false, ['crossfit']],
  ['x-toes-to-bar', 'Toes to Bar', 'Core', 'Bodyweight', 'reps', true, ['crossfit']],
  ['x-air-squat', 'Air Squat', 'Quads', 'Bodyweight', 'reps', true, ['hiit', 'crossfit']],
  ['x-goblet-squat', 'Goblet Squat', 'Quads', 'Kettlebell', 'weight', true, ['hiit']],
  // Dynamic warm-up moves (ids match free-exercise-db). Tag says which half they warm.
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

// Cardio machines the dataset lacks. The SkiErg and rower started out as Hyrox stations; they're cardio machines
// like the rest (logged as time and distance), so they show up in cardio, warm-ups and timed workouts too.
const MACHINES: [string, string, string[]][] = [
  ['x-air-bike', 'Air Bike (Assault / Echo)', ['crossfit', 'hiit']],
  ['x-bike-erg', 'BikeErg', ['crossfit', 'hiit']],
  ['x-versaclimber', 'VersaClimber', ['hiit']],
]
for (const [id, name, tags] of MACHINES) EXERCISES.push({ id, name, group: 'Cardio', equipment: 'Machine', kind: 'cardio', suggest: true, tags })
for (const e of EXERCISES) {
  if (e.id === 'x-skierg' || e.id === 'x-row-erg') Object.assign(e, { group: 'Cardio', kind: 'cardio', mode: undefined, suggest: true })
  if (e.id === 'x-row-erg') e.name = 'Rower'
  if (e.id === 'Rowing_Stationary') e.suggest = false // the same machine as the Rower; kept for old logs
  // A jump rope isn't a machine: bodyweight-and-a-rope workouts should be able to use it.
  if (e.id === 'Rope_Jumping') e.equipment = 'Jump rope'
}

// The library files some no-equipment moves under "Other"; they're bodyweight, which matters for home workouts.
const NO_GEAR = new Set([
  'Alternate Leg Diagonal Bound', 'Bodyweight Walking Lunge', 'Carioca Quick Step', 'Decline Push-Up', 'Kneeling Arm Drill',
  'Linear Acceleration Wall Drill', 'Mountain Climbers', 'Moving Claw Series', 'Quick Leap', 'Side Hop-Sprint',
  'Side Standing Long Jump', 'Single-Leg Hop Progression', 'Single-Leg Lateral Hop', 'Single-Leg Stride Jump',
  'Single Leg Push-off', 'Stride Jump Crossover', 'Prone Manual Hamstring', 'London Bridges',
])
for (const e of EXERCISES) if (e.equipment === 'Other' && NO_GEAR.has(e.name)) e.equipment = 'Bodyweight'
// Moves that are always done with bodyweight but were filed as weighted lifts: log them as reps, with no weight box.
// (Lifts people often load, like dips and pull-ups, stay weighted; a set with no weight there counts as bodyweight.)
const REPS_ONLY = new Set([
  'Ab_Roller', 'Decline_Push-Up', 'Bodyweight_Walking_Lunge', 'Inverted_Row', 'Inverted_Row_with_Straps', 'Bodyweight_Mid_Row',
  'Suspended_Push-Up', 'Suspended_Row', 'Suspended_Fallout', 'Suspended_Reverse_Crunch', 'Suspended_Split_Squat',
  'Muscle_Up', 'Kipping_Muscle_Up', 'Scapular_Pull-Up', 'Band_Assisted_Pull-Up', 'Knee_Hip_Raise_On_Parallel_Bars',
  'Floor_Glute-Ham_Raise',
])
for (const e of EXERCISES) if (REPS_ONLY.has(e.id) && e.mode === 'weight') e.mode = 'reps'
// ...and one listed as bodyweight that needs a dumbbell to push up from.
for (const e of EXERCISES) if (e.id === 'Close-Grip_Push-Up_off_of_a_Dumbbell') e.equipment = 'Dumbbell'

// Everyday names for the most common lifts; the dataset's full name stays available (search).
const SHORT: Record<string, string> = {
  'Barbell_Bench_Press_-_Medium_Grip': 'Bench Press',
  'Barbell_Incline_Bench_Press_-_Medium_Grip': 'Incline Bench Press',
  Barbell_Squat: 'Back Squat',
  'Front_Squat_Clean_Grip': 'Front Squat',
  Barbell_Deadlift: 'Deadlift',
  Standing_Military_Press: 'Overhead Press',
  Pullups: 'Pull-Up',
  Pushups: 'Push-Up',
  'Dips_-_Chest_Version': 'Chest Dip',
  'Dips_-_Triceps_Version': 'Triceps Dip',
  'Wide-Grip_Lat_Pulldown': 'Lat Pulldown',
  Bent_Over_Barbell_Row: 'Barbell Row',
  Seated_Cable_Rows: 'Seated Cable Row',
  Lying_Leg_Curls: 'Leg Curl',
  Leg_Extensions: 'Leg Extension',
  Standing_Calf_Raises: 'Calf Raise',
  Barbell_Hip_Thrust: 'Hip Thrust',
  Dumbbell_Bicep_Curl: 'Dumbbell Curl',
  'Close-Grip_Barbell_Bench_Press': 'Close-Grip Bench Press',
  Hammer_Curls: 'Hammer Curl',
  Side_Lateral_Raise: 'Lateral Raise',
  Bodyweight_Walking_Lunge: 'Walking Lunge',
  Split_Squat_with_Dumbbells: 'Dumbbell Split Squat',
  Dumbbell_Flyes: 'Dumbbell Fly',
  'Cable_Hammer_Curls_-_Rope_Attachment': 'Rope Hammer Curl',
  'Bent_Over_Two-Dumbbell_Row': 'Dumbbell Row',
  'Calf_Press_On_The_Leg_Press_Machine': 'Leg Press Calf Raise',
  // The dataset's "Air Bike" is a crunch, not the Assault/Echo bike.
  Air_Bike: 'Bicycle Crunch',
}
// Suffixes that rarely matter day to day ("Bench Press - Powerlifting" keeps its suffix if dropping it would clash).
const DROP = [/ - Medium Grip$/i, / -\s*Pronated Grip$/i]

const taken = new Set(EXERCISES.map((e) => e.name.toLowerCase()))
for (const e of EXERCISES) {
  const short = SHORT[e.id] ?? DROP.reduce((n, re) => n.replace(re, ''), e.name)
  if (short === e.name) continue
  if (!SHORT[e.id] && taken.has(short.toLowerCase())) continue
  e.fullName = e.name
  e.name = short
  taken.add(short.toLowerCase())
}

export const BUILTIN_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))
