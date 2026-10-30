/**
 * Demo pictures for the warm-up's mobility moves: a start and an end position for each, shown one after the other so
 * the move plays like a short loop. From free-exercise-db (public domain, the same source as the exercise library),
 * shrunk to WebP in public/moves/<id>-0.webp and -1.webp.
 */
const DEMOS = new Set([
  'Arm_Circles', 'Shoulder_Circles', 'Round_The_World_Shoulder_Stretch', 'Dynamic_Chest_Stretch', 'Dynamic_Back_Stretch',
  'Wrist_Circles', 'Cat_Stretch', 'Inchworm', 'Worlds_Greatest_Stretch', 'Standing_Hip_Circles', 'Front_Leg_Raises',
  'Side_Leg_Raises', 'Crossover_Reverse_Lunge', 'Knee_Circles', 'Ankle_Circles',
])

export const hasDemo = (id: string) => DEMOS.has(id)
export const demoIds = () => [...DEMOS]

/** The two frames of a move's demo (start, end), relative to the app. */
export const demoFrames = (id: string): [string, string] => [`${import.meta.env.BASE_URL}moves/${id}-0.webp`, `${import.meta.env.BASE_URL}moves/${id}-1.webp`]
