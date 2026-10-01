import type { Exercise, ExerciseLog } from '../types'
import { addDays, mondayOf, parseISO, toISO } from './dates'
import { workSets } from './progression'
import { BODY_PARTS, partFromName } from './bodyParts'

export const MUSCLE_GROUPS = BODY_PARTS

/**
 * Hard sets per muscle group for the week containing `date` and the week before. Warm-ups don't count. This is the
 * number most coaches track for muscle growth (roughly 10-20 hard sets per muscle per week is a common target).
 */
export function weeklySets(logs: ExerciseLog[], date: string, lookup: (id: string) => Exercise | undefined) {
  const mon = mondayOf(parseISO(date))
  const range = (start: Date) => [toISO(start), toISO(addDays(start, 6))] as const
  const count = ([from, to]: readonly [string, string]) => {
    const out: Record<string, number> = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, 0]))
    for (const l of logs) {
      if (l.date < from || l.date > to) continue
      const ex = lookup(l.exerciseId)
      if (!ex || ex.kind !== 'strength') continue
      const part = partFromName(ex.group, ex.name)
      if (part in out) out[part] += workSets(l).length
    }
    return out
  }
  return { thisWeek: count(range(mon)), lastWeek: count(range(addDays(mon, -7))) }
}
