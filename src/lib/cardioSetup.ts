import type { CardioSessionKind } from './cardioSession'
import { CARDIO_TYPES } from './cardioPrefs'

/** Activities, with the ones done inside or out sharing a chip ("Running" = outside or on a treadmill). */
export const ACTIVITIES: { key: string; label: string; out: string; in?: string; inLabel?: string }[] = [
  { key: 'running', label: 'Running', out: 'run', in: 'treadmill', inLabel: 'Treadmill' },
  { key: 'walking', label: 'Walking', out: 'walk', in: 'treadwalk', inLabel: 'Treadmill' },
  { key: 'cycling', label: 'Cycling', out: 'cycle', in: 'bike', inLabel: 'Indoor bike' },
  { key: 'row', label: 'Rower', out: 'row' },
  { key: 'ski', label: 'SkiErg', out: 'ski' },
  { key: 'airbike', label: 'Air bike (Assault / Echo)', out: 'airbike' },
  { key: 'bikeerg', label: 'BikeErg', out: 'bikeerg' },
  { key: 'elliptical', label: 'Elliptical', out: 'elliptical' },
  { key: 'stairs', label: 'Stair climber', out: 'stairs' },
  { key: 'swim', label: 'Swimming', out: 'swim' },
  { key: 'rope', label: 'Jump rope', out: 'rope' },
  { key: 'versa', label: 'VersaClimber', out: 'versa' },
]

export type Where = 'out' | 'in'
export interface CardioSetup { activities: string[]; where: Where; session: CardioSessionKind; split: boolean }

/** Cardio type ids (cardioPrefs) for the picked activities, inside or out. */
export const cardioIds = (c: CardioSetup) =>
  c.activities.map((k) => ACTIVITIES.find((a) => a.key === k)).filter((a): a is (typeof ACTIVITIES)[number] => !!a).map((a) => (c.where === 'in' && a.in ? a.in : a.out))

/** The picked activities and inside/outside from saved cardio type ids (e.g. 'treadmill' = running, inside). */
export function setupFromIds(ids: string[], session: CardioSessionKind = 'steady', split = false): CardioSetup {
  const acts = ACTIVITIES.filter((a) => ids.includes(a.out) || (a.in && ids.includes(a.in)))
  const inside = ACTIVITIES.some((a) => a.in && ids.includes(a.in))
  return { activities: acts.map((a) => a.key), where: inside ? 'in' : 'out', session, split }
}

/** The exercise a cardio type id stands for. */
export const exerciseFor = (id: string) => CARDIO_TYPES.find((c) => c.id === id)?.exerciseId

