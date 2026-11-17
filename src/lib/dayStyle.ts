import type { DayState } from './progress'
import type { PlanItem } from './plan'

/** The dot under a day: done, partly done, skipped, missed or still to do. */
export const STATE_DOT: Record<DayState, string> = {
  done: 'bg-accent', partial: 'bg-amber-700', skipped: 'bg-neutral-400', missed: 'bg-red-600', open: 'bg-neutral-300', rest: 'bg-transparent',
}
export const STATE_LABEL: Record<DayState, string> = { done: 'done', partial: 'partly done', skipped: 'skipped', missed: 'missed', open: 'to do', rest: 'rest day' }

/** A few characters for a calendar cell: "5 mi", "Str A", "Hike", "50K". */
export function shortLabel(it: PlanItem): string {
  if (it.type === 'race') return it.miles ? `${it.miles} mi` : 'Race'
  if (it.type === 'strength') return it.workout ? `Str ${it.workout}` : 'Str'
  if (it.type === 'run') return it.miles != null ? `${it.miles} mi` : 'Run'
  if (it.type === 'bike') return 'Bike'
  if (it.type === 'hike') return 'Hike'
  return it.title.split(' ')[0]
}
