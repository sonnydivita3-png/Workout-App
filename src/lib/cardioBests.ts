import type { Exercise, ExerciseLog, Units } from '../types'
import { sportOf } from './cardio'
import { familyOf } from './cardioSession'
import { distanceUnitFor, formatCardioTime, formatDistanceFor } from './units'

/**
 * Cardio personal bests. Cardio isn't progressive overload: most sessions aren't meant to go further or faster than
 * the last one (an easy run, a recovery ride), so nothing asks for that. These are the records worth a cheer when
 * they happen: the longest session, and the fastest time over a standard distance (a mile, a 5K, a 2,000 m row…),
 * compared only with earlier sessions over that same distance. A short, quick run never counts as a "faster" one.
 */

const METERS_PER_MI = 1609.344
const meters = (m: number) => m / METERS_PER_MI
const yards = (y: number) => y / 1760
const commas = (n: number) => n.toLocaleString('en-US')

interface Standard { miles: number; label: string }

const RUN: Standard[] = [
  { miles: 1, label: '1 mile' },
  { miles: meters(5000), label: '5K' },
  { miles: meters(10000), label: '10K' },
  { miles: meters(21097.5), label: 'half marathon' },
  { miles: meters(42195), label: 'marathon' },
]
const WALK = RUN.slice(0, 2)
const ERG: Standard[] = [500, 1000, 2000, 5000, 6000, 10000].map((m) => ({ miles: meters(m), label: `${commas(m)} m` }))
const SWIM_M: Standard[] = [100, 200, 400, 800, 1500].map((m) => ({ miles: meters(m), label: `${commas(m)} m` }))
const SWIM_YD: Standard[] = [100, 200, 500, 1000, 1650].map((y) => ({ miles: yards(y), label: `${commas(y)} yd` }))
const BIKE_MI: Standard[] = [{ miles: 10, label: '10 mi' }, { miles: 25, label: '25 mi' }]
const BIKE_KM: Standard[] = [{ miles: meters(20000), label: '20 km' }, { miles: meters(40000), label: '40 km' }]

/**
 * A session counts as a standard distance when it's within a few percent of it: a GPS 5K often reads 3.08 or 3.15 mi.
 * Its time is scaled to the exact distance at the session's pace.
 */
const LOW = 0.97
const HIGH = 1.06

type Family = 'run' | 'walk' | 'hike' | 'bike' | 'erg' | 'swim' | 'other'

function familyFor(exerciseId: string, ex?: Exercise): Family {
  if (exerciseId === 'hiking') return 'hike'
  if (exerciseId === 'x-bike-erg') return 'erg'
  const f = familyOf(exerciseId)
  if (f === 'row' || f === 'ski') return 'erg'
  if (f === 'machine') {
    // Custom cardio ("Lunch run", "Peloton ride"): judged by its name.
    const sport = sportOf(ex)
    return sport === 'run' ? 'run' : sport === 'bike' ? 'bike' : 'other'
  }
  return f
}

const NOUN: Record<Family, string> = { run: 'run', walk: 'walk', hike: 'hike', bike: 'ride', erg: 'session', swim: 'swim', other: 'session' }
const nounFor = (exerciseId: string, fam: Family) => (fam === 'erg' && /row/i.test(exerciseId) ? 'row' : NOUN[fam])

function standardsFor(exerciseId: string, units: Units, ex?: Exercise): Standard[] {
  const unit = distanceUnitFor(exerciseId, units)
  switch (familyFor(exerciseId, ex)) {
    case 'run': return RUN
    case 'walk': return WALK
    case 'bike': return unit === 'mi' ? BIKE_MI : BIKE_KM
    case 'erg': return ERG
    case 'swim': return unit === 'yd' ? SWIM_YD : SWIM_M
    default: return []
  }
}

const standardFor = (miles: number, list: Standard[]) => list.find((s) => miles >= s.miles * LOW && miles <= s.miles * HIGH)

/** A race-style time: "24:51", "1:52:07". */
export function raceTime(minutes: number): string {
  const total = Math.round(minutes * 60)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

interface Session { date: string; distance: number; minutes: number }

function sessionsOf(logs: ExerciseLog[], exerciseId: string): Session[] {
  return logs
    .filter((l) => l.exerciseId === exerciseId && (l.cardio?.distance || l.cardio?.minutes))
    .map((l) => ({ date: l.date, distance: l.cardio!.distance ?? 0, minutes: l.cardio!.minutes ?? 0 }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface CardioBest {
  /** Stable per kind of record, e.g. "distance", "time", "fastest-5k". */
  key: string
  /** "Longest run yet", "Fastest 5K yet". */
  title: string
  /** "8 mi", "24:51". */
  value: string
  /** The record it beat: "6.2 mi", "25:30". */
  was: string
}

/**
 * The personal bests a session sets against every earlier session of the same exercise: longest distance (or longest
 * time, when there's no distance), and fastest time over a standard distance. Nothing on a first session: there's no
 * record to beat yet.
 */
export function newCardioBests(
  logs: ExerciseLog[],
  exerciseId: string,
  entry: { distance: number | null; minutes: number | null } | undefined,
  date: string,
  units: Units,
  ex?: Exercise,
): CardioBest[] {
  const d = entry?.distance ?? 0
  const m = entry?.minutes ?? 0
  if (!d && !m) return []
  const earlier = sessionsOf(logs, exerciseId).filter((s) => s.date < date)
  if (earlier.length === 0) return []
  const fam = familyFor(exerciseId, ex)
  const noun = nounFor(exerciseId, fam)
  const dist = (mi: number) => formatDistanceFor(mi, exerciseId, units) ?? ''
  const out: CardioBest[] = []

  // Longest means clearly longer, 2% past anything before: the same 5K route reading 3.15 mi instead of 3.1 on the GPS
  // isn't a record.
  const longest = Math.max(0, ...earlier.map((s) => s.distance))
  if (d > 0) {
    if (longest > 0 && d > longest * 1.02) out.push({ key: 'distance', title: `Longest ${noun} yet`, value: dist(d), was: dist(longest) })
  } else {
    const most = Math.max(0, ...earlier.map((s) => s.minutes))
    if (most > 0 && m > most * 1.02) out.push({ key: 'time', title: `Longest ${noun} yet`, value: formatCardioTime(m) ?? '', was: formatCardioTime(most) ?? '' })
  }

  const stds = standardsFor(exerciseId, units, ex)
  const std = d > 0 && m > 0 ? standardFor(d, stds) : undefined
  if (std) {
    const time = m * (std.miles / d)
    const before = earlier.filter((s) => s.distance && s.minutes && standardFor(s.distance, stds) === std).map((s) => s.minutes * (std.miles / s.distance))
    // At least a second quicker than the best before.
    if (before.length && time < Math.min(...before) - 1 / 60) {
      out.push({ key: `fastest-${std.label.replace(/\W+/g, '').toLowerCase()}`, title: `Fastest ${std.label} yet`, value: raceTime(time), was: raceTime(Math.min(...before)) })
    }
  }
  return out
}

export interface CardioRecord {
  /** "Longest", "Longest time", "Fastest 5K". */
  label: string
  value: string
  date: string
  /** Set by the most recent session, beating an earlier one. */
  fresh: boolean
}

/** Every cardio record for an exercise, for its Progress page: longest, longest time, and the fastest standard distances. */
export function cardioRecords(logs: ExerciseLog[], exerciseId: string, units: Units, ex?: Exercise): CardioRecord[] {
  const all = sessionsOf(logs, exerciseId)
  if (all.length === 0) return []
  const latest = all.at(-1)!.date
  const out: CardioRecord[] = []
  // The first session to reach the best, so a later tie doesn't take the record's date.
  const top = (list: Session[], score: (s: Session) => number) => list.reduce((a, s) => (score(s) > score(a) ? s : a))

  const withDistance = all.filter((s) => s.distance > 0)
  if (withDistance.length) {
    const s = top(withDistance, (x) => x.distance)
    out.push({ label: 'Longest', value: formatDistanceFor(s.distance, exerciseId, units) ?? '', date: s.date, fresh: s.date === latest && withDistance.length > 1 })
  }
  const withTime = all.filter((s) => s.minutes > 0)
  if (withTime.length) {
    const s = top(withTime, (x) => x.minutes)
    out.push({ label: 'Longest time', value: formatCardioTime(s.minutes) ?? '', date: s.date, fresh: s.date === latest && withTime.length > 1 })
  }
  const stds = standardsFor(exerciseId, units, ex)
  for (const std of stds) {
    const runs = all.filter((s) => s.distance && s.minutes && standardFor(s.distance, stds) === std)
    if (runs.length === 0) continue
    const s = top(runs, (x) => -x.minutes / x.distance)
    const time = s.minutes * (std.miles / s.distance)
    // Scaled from a session a little off the exact distance: an estimate.
    const exact = Math.abs(s.distance / std.miles - 1) < 0.01
    out.push({ label: `Fastest ${std.label}`, value: `${exact ? '' : '≈'}${raceTime(time)}`, date: s.date, fresh: s.date === latest && runs.length > 1 })
  }
  return out
}
