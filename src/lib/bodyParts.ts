/**
 * Body parts: what an exercise is filed under and what workouts can aim at. Legs and arms are split (quads,
 * hamstrings and calves; biceps and triceps) so a workout can hit each one once. Older saved data used the broad
 * names Legs and Arms; `expandParts` and `partFromName` translate those.
 */
export const BODY_PARTS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'] as const
export type BodyPart = (typeof BODY_PARTS)[number]

export const UPPER_PARTS: string[] = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps']
export const LOWER_PARTS: string[] = ['Quads', 'Hamstrings', 'Glutes', 'Calves']

/** What a full-body workout covers first when there isn't time for everything: big movements, then the rest. */
export const FULL_BODY_ORDER: string[] = ['Quads', 'Chest', 'Back', 'Hamstrings', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Glutes', 'Calves']

/** The broad names older versions used, and the parts they cover. */
const BROAD: Record<string, string[]> = { Legs: ['Quads', 'Hamstrings', 'Calves'], Arms: ['Biceps', 'Triceps'] }

/** Replace the old broad names with the parts they cover, e.g. Legs → Quads, Hamstrings, Calves. */
export const expandParts = (focus: readonly string[]): string[] => [...new Set(focus.flatMap((g) => BROAD[g] ?? [g]))]

const AREA: Record<string, string> = { Quads: 'Legs', Hamstrings: 'Legs', Calves: 'Legs', Biceps: 'Arms', Triceps: 'Arms', Forearms: 'Arms' }
/** The broad area a part belongs to (Quads → Legs), for one-word day labels. */
export const areaOf = (part: string) => AREA[part] ?? part

/** The part for something saved under an old broad group (a custom exercise, a friend's older app), from its name. */
export function partFromName(group: string, name: string): string {
  if (group === 'Legs') {
    if (/calf|calves/i.test(name)) return 'Calves'
    if (/curl|deadlift|\brdl\b|good ?morning|hamstring|glute[- ]ham|nordic/i.test(name)) return 'Hamstrings'
    return 'Quads'
  }
  if (group === 'Arms') {
    if (/wrist|forearm|grip|farmer/i.test(name)) return 'Forearms'
    if (/tricep|extension|push-?down|skull|kickback|\bdips?\b|close-?grip|jm press/i.test(name)) return 'Triceps'
    return 'Biceps'
  }
  return group
}

/**
 * A full-body day: at least two of the big upper-body parts and two of the big lower-body ones (an arms-and-legs day
 * isn't one). These get one exercise per part, with spare time going into extra sets rather than a second chest move.
 */
export const isFullBody = (parts: readonly string[]) =>
  parts.filter((p) => ['Chest', 'Back', 'Shoulders'].includes(p)).length >= 2 && parts.filter((p) => ['Quads', 'Hamstrings', 'Glutes'].includes(p)).length >= 2
