import type { PlannedExercise } from '../types'

/**
 * A cardio workout on its own (or as a finisher): steady, intervals, tempo, hills, or a time trial, written for the
 * activity it's done on. Everything is in minutes, so it fits the time asked for whatever someone's pace.
 */
export type CardioSessionKind = 'steady' | 'intervals' | 'tempo' | 'hills' | 'trial'

export const CARDIO_SESSIONS: { id: CardioSessionKind; label: string; blurb: string }[] = [
  { id: 'steady', label: 'Steady', blurb: 'One easy, even effort. Builds your base and recovers well.' },
  { id: 'intervals', label: 'Intervals', blurb: 'Hard efforts with easy recoveries in between. Builds speed and fitness fast.' },
  { id: 'tempo', label: 'Tempo', blurb: 'A long stretch at comfortably hard: you can say a few words, not chat.' },
  { id: 'hills', label: 'Hills', blurb: 'Short, hard climbs with easy recoveries. Builds strength and power.' },
  { id: 'trial', label: 'Time trial', blurb: 'Warm up, then a set distance as fast as you can. Repeat it later to see progress.' },
]

type Family = 'run' | 'walk' | 'bike' | 'row' | 'ski' | 'swim' | 'machine'
const FAMILY: Record<string, Family> = {
  running: 'run', Running_Treadmill: 'run', Jogging_Treadmill: 'run', Trail_Running_Walking: 'run',
  walking: 'walk', Walking_Treadmill: 'walk', hiking: 'walk',
  cycling: 'bike', Bicycling: 'bike', Bicycling_Stationary: 'bike', Recumbent_Bike: 'bike', 'x-bike-erg': 'bike', 'x-air-bike': 'bike',
  'x-row-erg': 'row', Rowing_Stationary: 'row', 'x-skierg': 'ski', swimming: 'swim',
}
export const familyOf = (exerciseId: string): Family => FAMILY[exerciseId] ?? 'machine'
const TREADMILL = new Set(['Running_Treadmill', 'Jogging_Treadmill', 'Walking_Treadmill'])
const INDOOR_BIKE = new Set(['Bicycling_Stationary', 'Recumbent_Bike', 'x-bike-erg', 'x-air-bike'])

/** Session kinds that make sense for an activity (hills need a hill, an incline or resistance). */
export function sessionsFor(exerciseId: string): CardioSessionKind[] {
  const f = familyOf(exerciseId)
  if (f === 'run' || f === 'walk' || f === 'bike') return ['steady', 'intervals', 'tempo', 'hills', 'trial']
  return ['steady', 'intervals', 'tempo', 'trial']
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const fmt = (min: number) => (min < 1 ? `${Math.round(min * 60)}s` : Number.isInteger(min) ? `${min} min` : `${Math.floor(min)}:${String(Math.round((min % 1) * 60)).padStart(2, '0')}`)

/** Hard and easy durations (minutes) for one interval, and what "hard" means, by activity. */
const INTERVAL: Record<Family, { work: number; rest: number; hard: string; easy: string }> = {
  run: { work: 2, rest: 2, hard: 'hard (about 5K race effort)', easy: 'easy jog or walk' },
  walk: { work: 2, rest: 2, hard: 'fast walk, arms pumping', easy: 'easy pace' },
  bike: { work: 1, rest: 1, hard: 'hard (high cadence or resistance)', easy: 'easy spin' },
  row: { work: 1, rest: 1, hard: 'hard (faster than your 2K pace)', easy: 'light paddle' },
  ski: { work: 1, rest: 1, hard: 'hard', easy: 'light pulls' },
  swim: { work: 1, rest: 0.5, hard: 'strong swim', easy: 'rest at the wall' },
  machine: { work: 1, rest: 1, hard: 'hard', easy: 'easy' },
}

/** What the time trial covers, by activity and how long the session is. */
function trialTarget(f: Family, main: number): string {
  switch (f) {
    case 'run': return main >= 25 ? '5K' : main >= 15 ? '1.5 miles (2.4 km)' : '1 mile'
    case 'walk': return main >= 25 ? '2 miles (3.2 km), brisk' : '1 mile, brisk'
    case 'row': return main >= 25 ? '5,000 m' : '2,000 m'
    case 'ski': return main >= 15 ? '2,000 m' : '1,000 m'
    case 'swim': return main >= 20 ? '800 m (or 800 yd)' : '400 m (or 400 yd)'
    case 'bike': return main >= 30 ? `${Math.round(main * 0.8)} min: as far as you can` : '10 km (6 miles)'
    default: return `${clamp(Math.round(main * 0.8), 5, 20)} min: as many calories as you can`
  }
}

/**
 * One cardio session on `exerciseId` filling `minutes`: the plan goes in the note ("10 min easy · 6 × 2 min hard /
 * 2 min easy jog · 6 min easy"), with the total as the target minutes.
 */
export function cardioSession(exerciseId: string, kind: CardioSessionKind, minutes: number): PlannedExercise {
  const total = Math.max(10, Math.round(minutes))
  const f = familyOf(exerciseId)
  const k = sessionsFor(exerciseId).includes(kind) ? kind : 'steady'
  const warm = clamp(Math.round(total * 0.2), 5, 10)
  const cool = clamp(Math.round(total * 0.15), 3, 8)
  const main = total - warm - cool
  const where = TREADMILL.has(exerciseId) ? 'treadmill' : INDOOR_BIKE.has(exerciseId) ? 'indoor' : 'outside'
  let note: string
  switch (k) {
    case 'intervals': {
      const iv = INTERVAL[f]
      // Longer efforts on long runs (3 min instead of 2).
      const work = f === 'run' && main >= 30 ? 3 : iv.work
      const n = Math.max(3, Math.floor(main / (work + iv.rest)))
      // Whatever the repeats don't fill goes to the cool-down, so the session matches the time asked.
      note = `Intervals · ${warm} min easy · ${n} × ${fmt(work)} ${iv.hard} / ${fmt(iv.rest)} ${iv.easy} · ${fmt(Math.max(3, total - warm - n * (work + iv.rest)))} easy`
      break
    }
    case 'tempo': {
      const effort = f === 'swim' ? 'strong, steady pace (rest 20s every 200)' : f === 'walk' ? 'as fast as you can walk' : 'comfortably hard (you can say a few words)'
      note = main > 25
        ? `Tempo · ${warm} min easy · 2 × ${Math.floor((main - 3) / 2)} min ${effort}, 3 min easy between · ${cool + ((main - 3) % 2)} min easy`
        : `Tempo · ${warm} min easy · ${main} min ${effort} · ${cool} min easy`
      break
    }
    case 'hills': {
      const climb = where === 'treadmill' ? 'at 6–8% incline' : where === 'indoor' ? 'at heavy resistance, standing or seated' : 'up a hill'
      const back = where === 'treadmill' ? '90s flat and easy' : where === 'indoor' ? '90s light spin' : 'easy back down'
      const n = Math.max(4, Math.floor(main / 2.5))
      note = `Hills · ${warm} min easy · ${n} × 60s hard ${climb} / ${back} · ${fmt(Math.max(3, total - warm - n * 2.5))} easy`
      break
    }
    case 'trial':
      note = `Time trial · ${warm} min easy with a few short pick-ups · ${trialTarget(f, main)} for time · ${cool} min easy. Log your time to compare next time.`
      break
    default:
      note = f === 'swim' ? `Steady · ${total} min easy, continuous swimming (rest at the wall when you need to)`
        : f === 'walk' ? `Steady · ${total} min at a brisk pace`
        : `Steady · ${total} min at an easy, conversational effort`
  }
  return { exerciseId, sets: 1, minutes: total, note, est: total }
}
