import type { Exercise } from '../types'
import raw from './exercises.json'
import retired from './retired.json'

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
/** Equipment name for suspension trainers (TRX is one brand). */
export const TRX = 'Suspension (TRX)'
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
  // Strength for runners (lib/enduranceStrength.ts): ankle and calf stiffness, single-leg strength, the inner thigh.
  ['x-pogo-jumps', 'Pogo Jumps', 'Calves', 'Bodyweight', 'reps', false, ['plyo']],
  ['x-single-leg-hops', 'Single-Leg Hops', 'Calves', 'Bodyweight', 'reps', false, ['plyo']],
  ['x-single-leg-calf-raise', 'Single-Leg Calf Raise', 'Calves', 'Bodyweight', 'reps', true, []],
  ['x-bulgarian-split-squat', 'Bulgarian Split Squat', 'Quads', 'Dumbbell', 'weight', true, []],
  ['x-copenhagen-plank', 'Copenhagen Plank', 'Core', 'Bodyweight', 'time', false, []],
  // Posture, balance, core and mobility work for the strength plans' focus options. Stretches are tagged 'stretch', not
  // 'mobility', so they never turn up in a dynamic warm-up.
  ['x-bird-dog', 'Bird Dog', 'Core', 'Bodyweight', 'reps', false, ['balance']],
  ['x-hollow-hold', 'Hollow Hold', 'Core', 'Bodyweight', 'time', false, []],
  ['x-single-leg-balance', 'Single-Leg Balance', 'Core', 'Bodyweight', 'time', false, ['balance']],
  ['x-prone-ytw', 'Prone Y-T-W Raise', 'Shoulders', 'Bodyweight', 'reps', false, ['posture']],
  ['x-wall-angel', 'Wall Angel', 'Shoulders', 'Bodyweight', 'reps', false, ['posture']],
  ['x-hip-90-90', 'Hip 90/90 Switch', 'Mobility', 'Bodyweight', 'time', false, ['stretch']],
  ['x-pigeon-stretch', 'Pigeon Stretch', 'Mobility', 'Bodyweight', 'time', false, ['stretch']],
  ['x-couch-stretch', 'Couch Stretch (hip flexors)', 'Mobility', 'Bodyweight', 'time', false, ['stretch']],
  ['x-open-book', 'Open Book (upper back rotation)', 'Mobility', 'Bodyweight', 'time', false, ['stretch']],
  ['x-calf-stretch', 'Calf Stretch', 'Mobility', 'Bodyweight', 'time', false, ['stretch']],
  ['x-hamstring-stretch', 'Hamstring Stretch', 'Mobility', 'Bodyweight', 'time', false, ['stretch']],
  // Whole-body moves (tagged 'fullbody'): PHA's full-body station, HIIT circuits, functional workouts.
  ['x-man-maker', 'Dumbbell Man Maker', 'Conditioning', 'Dumbbell', 'weight', false, ['hiit', 'crossfit', 'fullbody']],
  ['x-devil-press', 'Devil Press', 'Conditioning', 'Dumbbell', 'weight', false, ['hiit', 'crossfit', 'fullbody']],
  ['x-lunge-press', 'Reverse Lunge to Press', 'Conditioning', 'Dumbbell', 'weight', false, ['hiit', 'fullbody', 'functional']],
  ['x-squat-thrust', 'Squat Thrust', 'Conditioning', 'Bodyweight', 'reps', false, ['hiit', 'fullbody']],
  ['x-sprawl', 'Sprawl', 'Conditioning', 'Bodyweight', 'reps', false, ['hiit', 'fullbody']],
  ['x-bear-crawl', 'Bear Crawl', 'Conditioning', 'Bodyweight', 'time', false, ['hiit', 'fullbody', 'functional']],
  ['x-inchworm-pushup', 'Inchworm Push-Up', 'Conditioning', 'Bodyweight', 'reps', false, ['hiit', 'fullbody']],
  ['x-sandbag-shoulder', 'Sandbag to Shoulder', 'Conditioning', 'Sandbag', 'reps', false, ['crossfit', 'fullbody', 'functional']],
  // Kettlebell basics: deadlifts, lunges, rows, presses, carries and twists, so a kettlebell is enough for a whole workout.
  ['x-kb-deadlift', 'Kettlebell Deadlift', 'Hamstrings', 'Kettlebell', 'weight', true, ['functional']],
  ['x-kb-sumo-deadlift', 'Kettlebell Sumo Deadlift', 'Glutes', 'Kettlebell', 'weight', true, ['functional']],
  ['x-kb-reverse-lunge', 'Kettlebell Goblet Reverse Lunge', 'Quads', 'Kettlebell', 'weight', true, ['functional']],
  ['x-kb-lateral-lunge', 'Kettlebell Lateral Lunge', 'Quads', 'Kettlebell', 'weight', true, ['functional']],
  ['x-kb-split-squat', 'Kettlebell Split Squat', 'Quads', 'Kettlebell', 'weight', true, ['functional']],
  ['x-kb-step-up', 'Kettlebell Step-Up', 'Glutes', 'Kettlebell', 'weight', true, ['functional']],
  ['x-kb-gorilla-row', 'Kettlebell Gorilla Row', 'Back', 'Kettlebell', 'weight', true, ['functional']],
  ['x-kb-high-pull', 'Kettlebell High Pull', 'Back', 'Kettlebell', 'weight', false, ['hiit']],
  ['x-kb-bottoms-up-press', 'Kettlebell Bottoms-Up Press', 'Shoulders', 'Kettlebell', 'weight', true, ['functional', 'posture']],
  ['x-kb-russian-twist', 'Kettlebell Russian Twist', 'Core', 'Kettlebell', 'weight', true, ['functional']],
  ['x-kb-suitcase-carry', 'Kettlebell Suitcase Carry', 'Core', 'Kettlebell', 'time', false, ['functional']],
  ['x-kb-rack-carry', 'Kettlebell Front Rack Carry', 'Core', 'Kettlebell', 'time', false, ['functional']],
  ['x-kb-overhead-carry', 'Kettlebell Overhead Carry', 'Shoulders', 'Kettlebell', 'time', false, ['functional', 'posture']],
  // Functional: single-leg, side-to-side, rotation and anti-rotation, carrying.
  ['x-single-leg-rdl', 'Single-Leg Romanian Deadlift', 'Hamstrings', 'Bodyweight', 'reps', true, ['functional', 'balance']],
  ['x-db-lateral-lunge', 'Dumbbell Lateral Lunge', 'Quads', 'Dumbbell', 'weight', true, ['functional']],
  ['x-db-renegade-row', 'Dumbbell Renegade Row', 'Back', 'Dumbbell', 'weight', true, ['functional']],
  ['x-db-woodchop', 'Dumbbell Woodchop', 'Core', 'Dumbbell', 'weight', true, ['functional']],
  ['x-band-pallof', 'Band Pallof Press', 'Core', 'Bands', 'reps', true, ['functional', 'posture']],
  ['x-db-suitcase-carry', 'Dumbbell Suitcase Carry', 'Core', 'Dumbbell', 'time', false, ['functional']],
  // Posture: the upper back and the back of the shoulders, chin and neck position, glutes, and stretches for what
  // sitting tightens (chest, hip flexors, upper back).
  ['x-band-face-pull', 'Band Face Pull', 'Shoulders', 'Bands', 'reps', true, ['posture']],
  ['x-reverse-snow-angel', 'Prone Reverse Snow Angel', 'Back', 'Bodyweight', 'reps', false, ['posture']],
  ['x-superman-hold', 'Superman Hold', 'Back', 'Bodyweight', 'time', false, ['posture']],
  ['x-scap-pushup', 'Scapular Push-Up', 'Shoulders', 'Bodyweight', 'reps', false, ['posture']],
  ['x-chin-tuck', 'Chin Tuck', 'Mobility', 'Bodyweight', 'time', false, ['posture']],
  ['x-clamshell', 'Clamshell', 'Glutes', 'Bodyweight', 'reps', false, ['posture']],
  ['x-glute-bridge-march', 'Glute Bridge March', 'Glutes', 'Bodyweight', 'reps', false, ['posture', 'balance']],
  ['x-thoracic-extension', 'Foam Roller Thoracic Extension', 'Mobility', 'Other', 'time', false, ['posture', 'stretch']],
  ['x-doorway-chest-stretch', 'Doorway Chest Stretch', 'Mobility', 'Bodyweight', 'time', false, ['posture', 'stretch']],
  ['x-childs-pose', 'Child’s Pose', 'Mobility', 'Bodyweight', 'time', false, ['stretch']],
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
  // Suspension trainer (TRX and the like), medicine ball and other functional kit. Bodyweight-leverage moves on the
  // straps are logged as reps (harder by walking the feet in); ball, sandbag and landmine moves with their weight.
  ['x-trx-chest-press', 'Suspension Chest Press', 'Chest', TRX, 'reps', false, ['functional']],
  ['x-trx-y-fly', 'Suspension Y-Fly', 'Shoulders', TRX, 'reps', false, ['posture']],
  ['x-trx-face-pull', 'Suspension Face Pull', 'Shoulders', TRX, 'reps', false, ['posture', 'functional']],
  ['x-trx-reverse-fly', 'Suspension Reverse Fly', 'Shoulders', TRX, 'reps', false, ['posture']],
  ['x-trx-curl', 'Suspension Biceps Curl', 'Biceps', TRX, 'reps', false, []],
  ['x-trx-triceps-ext', 'Suspension Triceps Extension', 'Triceps', TRX, 'reps', false, []],
  ['x-trx-squat', 'Suspension Squat', 'Quads', TRX, 'reps', false, ['functional']],
  ['x-trx-reverse-lunge', 'Suspension Reverse Lunge', 'Quads', TRX, 'reps', false, ['functional', 'balance']],
  ['x-trx-pistol', 'Suspension Pistol Squat', 'Quads', TRX, 'reps', false, ['balance']],
  ['x-trx-hamstring-curl', 'Suspension Hamstring Curl', 'Hamstrings', TRX, 'reps', false, ['functional']],
  ['x-trx-hip-press', 'Suspension Glute Bridge', 'Glutes', TRX, 'reps', false, []],
  ['x-trx-pike', 'Suspension Pike', 'Core', TRX, 'reps', false, []],
  ['x-trx-plank', 'Suspension Plank', 'Core', TRX, 'time', false, ['functional']],
  ['x-trx-side-plank', 'Suspension Side Plank', 'Core', TRX, 'time', false, ['functional']],
  ['x-trx-mountain-climber', 'Suspension Mountain Climber', 'Core', TRX, 'time', false, ['hiit']],
  ['x-trx-atomic-pushup', 'Suspension Atomic Push-Up', 'Chest', TRX, 'reps', false, ['hiit', 'fullbody']],
  ['x-trx-jump-squat', 'Suspension Jump Squat', 'Quads', TRX, 'reps', false, ['hiit']],
  ['x-mb-rotational-throw', 'Medicine Ball Rotational Throw', 'Core', 'Medicine ball', 'weight', false, ['functional']],
  ['x-mb-russian-twist', 'Medicine Ball Russian Twist', 'Core', 'Medicine ball', 'weight', false, ['functional']],
  ['x-mb-woodchop', 'Medicine Ball Woodchop', 'Core', 'Medicine ball', 'weight', false, ['functional']],
  ['x-mb-squat-press', 'Medicine Ball Squat to Press', 'Conditioning', 'Medicine ball', 'weight', false, ['hiit', 'fullbody', 'functional']],
  ['x-mb-lunge-twist', 'Medicine Ball Lunge with Twist', 'Quads', 'Medicine ball', 'weight', false, ['functional']],
  ['x-mb-pushup', 'Medicine Ball Push-Up', 'Chest', 'Medicine ball', 'reps', false, []],
  ['x-mb-situp-throw', 'Medicine Ball Sit-Up Throw', 'Core', 'Medicine ball', 'weight', false, []],
  ['x-mb-v-up', 'Medicine Ball V-Up', 'Core', 'Medicine ball', 'weight', false, []],
  ['x-battle-rope-slams', 'Battle Rope Slams', 'Conditioning', 'Battle rope', 'time', false, ['hiit', 'fullbody']],
  ['x-battle-rope-alt-waves', 'Battle Rope Alternating Waves', 'Conditioning', 'Battle rope', 'time', false, ['hiit', 'fullbody']],
  ['x-sandbag-squat', 'Sandbag Bear-Hug Squat', 'Quads', 'Sandbag', 'weight', false, ['functional']],
  ['x-sandbag-carry', 'Sandbag Bear-Hug Carry', 'Conditioning', 'Sandbag', 'time', false, ['functional', 'hyrox']],
  ['x-sandbag-clean', 'Sandbag Clean', 'Conditioning', 'Sandbag', 'weight', false, ['crossfit', 'fullbody']],
  ['x-landmine-press', 'Landmine Press', 'Shoulders', 'Barbell', 'weight', false, ['functional']],
  ['x-landmine-squat', 'Landmine Squat', 'Quads', 'Barbell', 'weight', false, ['functional']],
  ['x-landmine-row', 'Landmine Row', 'Back', 'Barbell', 'weight', false, ['functional']],
  ['x-ring-row', 'Ring Row', 'Back', 'Rings', 'reps', false, ['functional']],
  ['x-ring-pushup', 'Ring Push-Up', 'Chest', 'Rings', 'reps', false, []],
  ['x-ball-rollout', 'Stability Ball Rollout', 'Core', 'Exercise ball', 'reps', false, ['functional']],
  ['x-ball-pike', 'Stability Ball Pike', 'Core', 'Exercise ball', 'reps', false, []],
  ['x-slider-reverse-lunge', 'Slider Reverse Lunge', 'Quads', 'Sliders', 'reps', false, ['functional']],
  ['x-slider-hamstring-curl', 'Slider Hamstring Curl', 'Hamstrings', 'Sliders', 'reps', false, []],
  ['x-slider-mountain-climber', 'Slider Mountain Climber', 'Core', 'Sliders', 'time', false, ['hiit']],
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
  // Battle ropes are worked for time, all over.
  if (e.id === 'Battling_Ropes') Object.assign(e, { mode: 'time', group: 'Conditioning' })
  // The air squat of CrossFit and HIIT workouts (it replaced a duplicate "Air Squat").
  if (e.id === 'Bodyweight_Squat') e.tags = ['hiit', 'crossfit']
}

// The library files some no-equipment moves under "Other"; they're bodyweight, which matters for home workouts.
const NO_GEAR = new Set([
  'Alternate Leg Diagonal Bound', 'Bodyweight Walking Lunge', 'Carioca Quick Step', 'Decline Push-Up', 'Kneeling Arm Drill',
  'Linear Acceleration Wall Drill', 'Mountain Climbers', 'Moving Claw Series', 'Quick Leap', 'Side Hop-Sprint',
  'Side Standing Long Jump', 'Single-Leg Hop Progression', 'Single-Leg Lateral Hop', 'Single-Leg Stride Jump',
  'Single Leg Push-off', 'Stride Jump Crossover', 'Prone Manual Hamstring', 'London Bridges',
])
for (const e of EXERCISES) if (e.equipment === 'Other' && NO_GEAR.has(e.name)) e.equipment = 'Bodyweight'
// Tags for moves already in the library: what's whole-body, functional or good for posture (see the extras above).
const MORE_TAGS: Record<string, string[]> = {
  'x-burpee': ['fullbody'], 'x-thruster': ['fullbody'], 'x-db-snatch': ['fullbody'], 'x-wall-balls': ['fullbody'], Kettlebell_Thruster: ['fullbody'],
  Mountain_Climbers: ['fullbody'], Battling_Ropes: ['hiit', 'fullbody'], 'x-kb-swing': ['functional'], 'x-farmers-carry': ['functional'],
  'x-goblet-squat': ['functional'], Alternating_Renegade_Row: ['functional'], Front_Squats_With_Two_Kettlebells: ['functional'],
  Pushups: ['functional'], 'Two-Arm_Kettlebell_Military_Press': ['functional'], 'One-Arm_Kettlebell_Row': ['functional'], Dumbbell_Step_Ups: ['functional'], 'Kettlebell_One-Legged_Deadlift': ['functional', 'balance'],
  Band_Pull_Apart: ['posture'], Face_Pull: ['posture'], Dead_Bug: ['posture'], 'x-bird-dog': ['posture'], 'x-prone-ytw': ['posture'],
  'x-wall-angel': ['posture'], 'x-couch-stretch': ['posture'], 'x-open-book': ['posture'], Cat_Stretch: ['posture'],
  Pallof_Press: ['functional', 'posture'], Standing_Cable_Wood_Chop: ['functional'],
  Suspended_Row: ['functional'], 'Suspended_Push-Up': ['functional'], Suspended_Fallout: ['functional'], Suspended_Split_Squat: ['functional', 'balance'],
  Medicine_Ball_Chest_Pass: ['hiit'], Overhead_Slam: ['hiit', 'crossfit', 'fullbody'], Ab_Roller: ['functional'],
}
for (const e of EXERCISES) if (MORE_TAGS[e.id]) e.tags = [...new Set([...(e.tags ?? []), ...MORE_TAGS[e.id]])]
// Equipment audit. "Bodyweight" means no gear beyond a bar or bench to hang from, push off or lie on (pull-ups were
// already filed that way, so dips and hanging/bar moves are too); "Other" is specialist kit (rings, TRX, ab wheel,
// plates, ropes, balls). The rest are filed under the kit they actually need.
const EQUIPMENT_FIX: Record<string, string> = {
  'Dips_-_Chest_Version': 'Bodyweight', Knee_Hip_Raise_On_Parallel_Bars: 'Bodyweight', Inverted_Row: 'Bodyweight',
  Weighted_Pull_Ups: 'Bodyweight', Mixed_Grip_Chin: 'Bodyweight', Muscle_Up: 'Bodyweight', Weighted_Bench_Dip: 'Bodyweight',
  Hyperextensions_Back_Extensions: 'Machine', Donkey_Calf_Raises: 'Machine',
  'Band_Assisted_Pull-Up': 'Bands', Seated_Band_Hamstring_Curl: 'Bands',
  Trap_Bar_Deadlift: 'Barbell', 'Close-Grip_EZ_Bar_Curl': 'EZ bar', Decline_EZ_Bar_Triceps_Extension: 'EZ bar',
  'Crunch_-_Legs_On_Exercise_Ball': 'Exercise ball',
  Suspended_Row: TRX, 'Suspended_Push-Up': TRX, Suspended_Fallout: TRX, Suspended_Reverse_Crunch: TRX, Suspended_Split_Squat: TRX,
  Battling_Ropes: 'Battle rope', Ring_Dips: 'Rings',
}
// ...and a couple of body parts: mountain climbers and flutter kicks are ab work, not quads and glutes.
const GROUP_FIX: Record<string, string> = { Mountain_Climbers: 'Core', Flutter_Kicks: 'Core' }
// Everyday moves the dataset left out of random workouts (so "More bodyweight" never brought dips, hanging leg raises
// or inverted rows, and no back day ever had shrugs).
const SUGGEST_FIX = new Set([
  'Barbell_Shrug', 'Dumbbell_Shrug', 'Good_Morning', 'Trap_Bar_Deadlift', 'Push_Press', 'Hyperextensions_Back_Extensions',
  'Dips_-_Chest_Version', 'Decline_Push-Up', 'Inverted_Row', 'Bodyweight_Walking_Lunge',
  'Hanging_Leg_Raise', 'Knee_Hip_Raise_On_Parallel_Bars', 'Mountain_Climbers', 'Ab_Roller', 'Band_Pull_Apart',
])
for (const e of EXERCISES) {
  if (EQUIPMENT_FIX[e.id]) e.equipment = EQUIPMENT_FIX[e.id]
  if (GROUP_FIX[e.id]) e.group = GROUP_FIX[e.id]
  if (SUGGEST_FIX.has(e.id)) e.suggest = true
}
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
  Suspended_Row: 'Suspension Row', 'Suspended_Push-Up': 'Suspension Push-Up', Suspended_Fallout: 'Suspension Fallout',
  Suspended_Reverse_Crunch: 'Suspension Knee Tuck', Suspended_Split_Squat: 'Suspension Split Squat',
  Battling_Ropes: 'Battle Rope Waves',
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
  Butterfly: 'Pec Deck',
  Side_Bridge: 'Side Plank',
  Butt_Lift_Bridge: 'Glute Bridge',
  Natural_Glute_Ham_Raise: 'Nordic Hamstring Curl',
  'Kettlebell_Turkish_Get-Up_Squat_style': 'Turkish Get-Up',
  Overhead_Slam: 'Medicine Ball Slam',
  Hyperextensions_Back_Extensions: 'Back Extension',
  Knee_Hip_Raise_On_Parallel_Bars: 'Captain’s Chair Knee Raise',
  Lateral_Bound: 'Skater Hops',
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

// The library keeps 500 everyday exercises from the dataset, plus the extras above. The rest of the dataset (strongman
// events, sport drills, band-and-chain variations, near-duplicates) is retired: never offered, but still known, so old
// workouts and plans keep their names.
// ...except suspension and medicine ball basics, back for functional workouts.
const UNRETIRED = ['Suspended_Fallout', 'Suspended_Reverse_Crunch', 'Suspended_Split_Squat', 'Medicine_Ball_Chest_Pass']
const RETIRED = new Set<string>((retired as string[]).filter((id) => !UNRETIRED.includes(id)))
for (const e of EXERCISES) if (RETIRED.has(e.id)) e.retired = true

/** Every exercise ever in the library, retired ones included: for looking up what's already in logs and plans. */
export const ALL_EXERCISES: Exercise[] = [...EXERCISES]
export const BUILTIN_BY_ID = new Map(ALL_EXERCISES.map((e) => [e.id, e]))
// From here on, the library: what's offered in search, workouts and plans.
EXERCISES.splice(0, EXERCISES.length, ...ALL_EXERCISES.filter((e) => !e.retired))
