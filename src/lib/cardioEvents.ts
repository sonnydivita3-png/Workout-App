import type { Sport } from '../types'

export const KM_PER_MILE = 1.609344

export interface CardioEvent {
  id: string
  sport: Sport
  label: string
  /** Event distance in miles; undefined for open-ended "build fitness" plans. */
  miles?: number
  /** Recommended plan lengths in weeks, shortest first. */
  weeks: number[]
  /** Weeks in the taper, counting race week. */
  taper: number
}

export const RUN_EVENTS: CardioEvent[] = [
  { id: 'c25k', sport: 'run', label: 'Couch to 5K', miles: 3.107, weeks: [9], taper: 0 },
  { id: '5k', sport: 'run', label: '5K', miles: 3.107, weeks: [6, 8, 10], taper: 1 },
  { id: '10k', sport: 'run', label: '10K', miles: 6.214, weeks: [8, 10, 12], taper: 1 },
  { id: 'half', sport: 'run', label: 'Half marathon', miles: 13.109, weeks: [10, 12, 14], taper: 2 },
  { id: 'marathon', sport: 'run', label: 'Marathon', miles: 26.219, weeks: [16, 18, 20], taper: 3 },
  { id: 'run-base', sport: 'run', label: 'Build mileage', weeks: [8, 12, 16], taper: 0 },
]

export const BIKE_EVENTS: CardioEvent[] = [
  { id: 'ride-25', sport: 'bike', label: '25-mile ride', miles: 25, weeks: [6, 8, 10], taper: 1 },
  { id: 'ride-50', sport: 'bike', label: '50-mile ride', miles: 50, weeks: [8, 10, 12], taper: 1 },
  { id: 'metric', sport: 'bike', label: 'Metric century (62 mi)', miles: 62.14, weeks: [10, 12, 14], taper: 2 },
  { id: 'century', sport: 'bike', label: 'Century (100 mi)', miles: 100, weeks: [12, 16, 20], taper: 2 },
  { id: 'ride-200k', sport: 'bike', label: '200K (124 mi)', miles: 124.27, weeks: [16, 20, 24], taper: 2 },
  { id: 'bike-base', sport: 'bike', label: 'Build fitness', weeks: [8, 12, 16], taper: 0 },
]

export const eventsFor = (sport: Sport) => (sport === 'run' ? RUN_EVENTS : BIKE_EVENTS)
export const findEvent = (id: string) => [...RUN_EVENTS, ...BIKE_EVENTS].find((e) => e.id === id)

/** Events that make sense as a one-time "complete this distance" goal. */
export const goalEventsFor = (sport: Sport) => eventsFor(sport).filter((e) => e.miles && e.id !== 'c25k')
