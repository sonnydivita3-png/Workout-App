import type { PlannedExercise, Sport, Units } from '../types'
import { BIKE_EVENTS, RUN_EVENTS, findEvent, type CardioEvent } from './cardioEvents'
import { addDays, parseISO, toISO, weekdayIndex } from './dates'
import { formatDuration, parseDuration, trainingPaces, type TrainingPaces } from './paces'
import { formatPace, showDistance } from './units'

export type PlanLevel = 'beginner' | 'intermediate' | 'advanced'
export type Role = 'long' | 'quality' | 'medium' | 'quality2' | 'easy'
export type WeekPhase = 'base' | 'build' | 'peak' | 'cutback' | 'taper' | 'race'

export interface CardioPlanInput {
  eventId: string
  level: PlanLevel
  /** Weekdays to train, 0 = Monday … 6 = Sunday. Everything else is a rest day. */
  trainWeekdays: number[]
  /** Weekday for the long run/ride (should be one of trainWeekdays). */
  longDay: number
  /** Monday the plan's first week starts on. */
  anchorMonday: string
  /** Number of weeks, when there is no race date. */
  weeks: number
  /** Skip days before this date (planning the current week partway through). */
  fromDate?: string
  /** Event date. The plan ends here and its length is derived from it. */
  raceDate?: string
  /** Current weekly volume: miles (running) or hours (cycling). */
  currentWeekly?: number
  /** Peak weekly volume for open-ended "build" plans: miles or hours. */
  targetWeekly?: number
  /** Running: goal finish time, as "h:mm:ss" or minutes, for personal paces. */
  goalTime?: string
  /** Cycling: typical average speed in mph, used to turn time into distance. */
  speedMph?: number
  /** Cycling: functional threshold power in watts, for power targets. */
  ftp?: number
  units: Units
}

export interface CardioDay {
  date: string
  weekIndex: number
  /** Empty for rest days. */
  role?: Role | 'race' | 'walkrun'
  title: string
  note: string
  minutes: number
  /** Miles; undefined for time-based sessions. */
  miles?: number
}

export interface CardioWeek {
  index: number
  start: string
  phase: WeekPhase
  /** Planned training miles (running) or hours (cycling), not counting the event itself. */
  volume: number
  /** The event's distance (miles) or duration (hours) in its week. */
  eventVolume?: number
  sessions: number
}

export interface CardioPlan {
  event: CardioEvent
  days: CardioDay[]
  weeks: CardioWeek[]
  warnings: string[]
  paces?: TrainingPaces
  raceDate?: string
  /** Biggest week and longest single session, in miles (running) or hours/miles (cycling). */
  peak: { volume: number; longMiles: number }
}

const MILE = 1609.344
const roundHalf = (x: number) => Math.round(x * 2) / 2
const round5 = (x: number) => Math.round(x / 5) * 5
const daysBetween = (a: string, b: string) => Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000)
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t))

// ---------------------------------------------------------------------------------------------
// Progression: weekly volume and long run/ride build toward a peak, with a cutback week every 4th
// week, then a taper. Growth is capped near the widely used ~10%/week guideline.
// ---------------------------------------------------------------------------------------------

interface CurveOptions {
  weeks: number
  /** Taper weeks, counting event week. 0 = open-ended plan. */
  taper: number
  startVol: number
  peakVol: number
  startLong: number
  peakLong: number
  volGrowth: number
  /** Largest week-to-week increase of the long run/ride (miles or minutes). */
  longStep: number
  taperVol: number[]
  taperLong: number[]
}

interface WeekMeta {
  index: number
  phase: WeekPhase
  vol: number
  long: number
  /** 0 at the start of the build, 1 at the peak. */
  g: number
  cutback: boolean
}

export function buildCurve(o: CurveOptions): { meta: WeekMeta[]; peakVol: number; peakLong: number } {
  const buildWeeks = Math.max(1, o.weeks - o.taper)
  const peakIdx = buildWeeks - 1
  const cutbacks = buildWeeks >= 8
  const isCut = (i: number) => cutbacks && i > 0 && (i + 1) % 4 === 0 && i < peakIdx - 1
  const progress = Array.from({ length: buildWeeks }, (_, i) => i).filter((i) => !isCut(i))

  const meta: WeekMeta[] = []
  let prevVol = o.startVol
  let prevLong = o.startLong
  progress.forEach((week, k) => {
    const frac = progress.length === 1 ? 1 : k / (progress.length - 1)
    const vol = k === 0 ? o.startVol : Math.min(lerp(o.startVol, o.peakVol, frac), prevVol * (1 + o.volGrowth))
    const long = k === 0 ? o.startLong : Math.min(lerp(o.startLong, o.peakLong, frac), prevLong + o.longStep)
    meta[week] = { index: week, phase: frac < 0.34 ? 'base' : frac < 0.75 ? 'build' : 'peak', vol, long, g: frac, cutback: false }
    prevVol = vol
    prevLong = long
  })
  for (let i = 0; i < buildWeeks; i++) {
    if (!isCut(i)) continue
    const before = meta[i - 1]
    meta[i] = { index: i, phase: 'cutback', vol: before.vol * 0.8, long: before.long * 0.75, g: before.g, cutback: true }
  }
  const peak = { vol: meta[peakIdx].vol, long: meta[peakIdx].long }
  for (let j = 0; j < o.taper; j++) {
    const i = buildWeeks + j
    meta[i] = { index: i, phase: j === o.taper - 1 ? 'race' : 'taper', vol: peak.vol * o.taperVol[j], long: peak.long * o.taperLong[j], g: 1, cutback: false }
  }
  return { meta, peakVol: peak.vol, peakLong: peak.long }
}

// ---------------------------------------------------------------------------------------------
// Which day does what: the long session on the long day, the hard session as far from it as
// possible, and no two hard days back to back.
// ---------------------------------------------------------------------------------------------

const circular = (a: number, b: number) => Math.min(Math.abs(a - b), 7 - Math.abs(a - b))

const ROLE_ORDER: Record<Sport, Record<number, Role[]>> = {
  run: { 1: [], 2: ['quality'], 3: ['quality', 'easy'], 4: ['quality', 'easy', 'easy'], 5: ['quality', 'medium', 'easy', 'easy'], 6: ['quality', 'medium', 'quality2', 'easy', 'easy'] },
  bike: { 1: [], 2: ['quality'], 3: ['quality', 'medium'], 4: ['quality', 'medium', 'easy'], 5: ['quality', 'medium', 'easy', 'easy'], 6: ['quality', 'medium', 'quality2', 'easy', 'easy'] },
}

/**
 * Which day does what. The long session goes on the long day, the hard session as far from it as possible,
 * further hard days on days that don't touch another hard day, and everything else is easy.
 */
export function assignRoles(days: number[], longDay: number, sport: Sport = 'run'): Map<number, Role> {
  const set = [...new Set(days)].sort((a, b) => a - b)
  if (!set.includes(longDay)) set.push(longDay)
  const roles = new Map<number, Role>([[longDay, 'long']])
  const others = set.filter((d) => d !== longDay).sort((a, b) => circular(b, longDay) - circular(a, longDay) || a - b)
  const order = ROLE_ORDER[sport][Math.min(6, set.length)] ?? ROLE_ORDER[sport][6]
  // An endurance ride is easy enough to sit beside a hard day; a runner's medium-long run is not.
  const hardRoles: Role[] = sport === 'bike' ? ['long', 'quality', 'quality2'] : ['long', 'quality', 'medium', 'quality2']
  const touchesHard = (d: number) => [...roles.entries()].some(([o, r]) => hardRoles.includes(r) && circular(o, d) === 1)
  const free = [...others]
  for (const role of order) {
    if (role === 'easy') continue
    // Prefer a day that doesn't sit next to another hard day; the first hard session is always placed.
    const pick = role === 'medium' && sport === 'bike' ? free[0] : (free.find((d) => !touchesHard(d)) ?? (role === 'quality' ? free[0] : undefined))
    if (pick == null) continue
    roles.set(pick, role)
    free.splice(free.indexOf(pick), 1)
  }
  for (const d of free) roles.set(d, 'easy')
  return roles
}

// ---------------------------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------------------------

interface RunProfile { start: number; startLong: number; peak: number; peakLong: number }
type RunKey = '5k' | '10k' | 'half' | 'marathon' | 'run-base'

/** Typical starting and peak weekly miles / long runs by level, in line with popular novice-to-advanced plans. */
const RUN_PROFILES: Record<RunKey, Record<PlanLevel, RunProfile>> = {
  '5k': {
    beginner: { start: 8, startLong: 2.5, peak: 16, peakLong: 5 },
    intermediate: { start: 16, startLong: 4, peak: 26, peakLong: 7 },
    advanced: { start: 25, startLong: 6, peak: 35, peakLong: 8 },
  },
  '10k': {
    beginner: { start: 12, startLong: 3, peak: 20, peakLong: 8 },
    intermediate: { start: 20, startLong: 5, peak: 32, peakLong: 10 },
    advanced: { start: 30, startLong: 8, peak: 42, peakLong: 12 },
  },
  half: {
    beginner: { start: 15, startLong: 5, peak: 26, peakLong: 11 },
    intermediate: { start: 22, startLong: 7, peak: 36, peakLong: 13 },
    advanced: { start: 32, startLong: 9, peak: 48, peakLong: 15 },
  },
  marathon: {
    beginner: { start: 18, startLong: 6, peak: 38, peakLong: 20 },
    intermediate: { start: 28, startLong: 8, peak: 48, peakLong: 20 },
    advanced: { start: 40, startLong: 12, peak: 62, peakLong: 22 },
  },
  'run-base': {
    beginner: { start: 8, startLong: 3, peak: 14, peakLong: 5 },
    intermediate: { start: 15, startLong: 5, peak: 24, peakLong: 8 },
    advanced: { start: 25, startLong: 8, peak: 38, peakLong: 12 },
  },
}

const RUN_TAPER: Record<number, { vol: number[]; long: number[] }> = {
  1: { vol: [0.6], long: [0] },
  2: { vol: [0.7, 0.45], long: [0.55, 0] },
  3: { vol: [0.75, 0.55, 0.35], long: [0.6, 0.4, 0] },
}

const paceText = (min: number, units: Units) => formatPace(1, min, units) ?? ''
const range = (a: number, b: number, units: Units) => `${paceText(Math.min(a, b), units)}–${paceText(Math.max(a, b), units)}`

interface RunCtx {
  key: RunKey
  level: PlanLevel
  units: Units
  paces?: TrainingPaces
  goalPace?: string
}

const dist = (mi: number, units: Units) => `${showDistance(roundHalf(mi), units)} ${units.distance}`

function runNote(role: Role, miles: number, week: WeekMeta, c: RunCtx): { title: string; note: string } {
  const { units, paces } = c
  const easy = paces ? ` About ${range(paces.easy[0], paces.easy[1], units)}.` : ' Conversational pace: you can speak in full sentences.'
  const beginner = c.level === 'beginner'
  const longEvent = c.key === 'half' || c.key === 'marathon'

  if (role === 'easy') return { title: 'Easy run', note: `Relaxed and comfortable.${easy}` }

  if (role === 'long') {
    const finish = !beginner && longEvent && paces && week.g > 0.55 && !week.cutback && week.index % 2 === 0
    const n = Math.max(2, Math.min(8, roundHalf(miles * 0.25)))
    const race = c.key === 'marathon' ? paceText(paces?.marathon ?? 0, units) : paceText(paces?.threshold ?? 0, units)
    return {
      title: 'Long run',
      note: finish
        ? `Easy for the first ${dist(miles - n, units)}, then the last ${dist(n, units)} at goal race pace (${race}). Slow down if it feels forced.`
        : `Easy and steady: the run that builds endurance. Roughly 30–90 seconds per mile slower than goal race pace.${paces ? ` Around ${range(paces.easy[0], paces.marathon + 0.5, units)}.` : ''}`,
    }
  }

  if (role === 'medium') {
    return { title: 'Medium-long run', note: `Steady aerobic run, a bit shorter than the long run.${beginner ? ' Keep it easy.' : ' Finish the last mile a touch faster if you feel good.'}` }
  }

  // quality / quality2
  const wu = beginner ? 1 : 1.5
  const work = Math.max(0.5, miles - wu - 1)
  if (week.phase === 'taper' || week.phase === 'race') {
    return { title: 'Sharpener', note: `Easy running with 4 × 400 m at goal race pace and full recovery, to stay sharp while you rest.${paces ? ` Race pace ≈ ${paceText(c.key === 'marathon' ? paces.marathon : c.key === 'half' ? paces.threshold : paces.interval, units)}.` : ''}` }
  }
  if (beginner) {
    const beginnerWork = [
      { title: 'Easy run with strides', note: `Easy run, then 6 × 20-second relaxed pick-ups (strides) with walking recovery.` },
      { title: 'Fartlek', note: `Easy run with 6 × 1 minute a little faster, 2 minutes easy in between. Play with the pace.` },
      { title: 'Steady run', note: `Run the middle ${dist(Math.max(1, work), units)} at a steady, comfortably hard effort you could hold for a 10K.` },
    ]
    return beginnerWork[week.g < 0.34 ? 0 : week.g < 0.75 ? 1 : 2]
  }
  const shortEvent = c.key === '5k' || c.key === '10k'
  const alternate = week.index % 2 === 0
  if (week.g < 0.34) {
    return alternate
      ? { title: 'Hill repeats', note: `${dist(wu, units)} easy, then 6 × 30 seconds hard uphill, jog down to recover, then easy home. Builds strength with low injury risk.` }
      : { title: 'Easy run with strides', note: `Easy run, then 8 × 20-second strides with plenty of recovery.` }
  }
  if (week.g < 0.75) {
    const tempoPace = paces ? ` (about ${paceText(paces.threshold, units)})` : ' (comfortably hard: a few words at a time)'
    return alternate
      ? { title: 'Tempo run', note: `${dist(wu, units)} easy, ${dist(work, units)} at tempo effort${tempoPace}, ${dist(1, units)} easy.` }
      : { title: 'Cruise intervals', note: `${dist(wu, units)} easy, then ${Math.max(2, Math.min(5, Math.round(work)))} × 1 mile at tempo effort${paces ? ` (${paceText(paces.threshold, units)})` : ''} with 1 minute jog between, then ${dist(1, units)} easy.` }
  }
  // peak phase: race-specific
  if (shortEvent) {
    const reps = Math.max(4, Math.min(8, Math.round(work / 0.5)))
    return { title: 'Intervals', note: `${dist(wu, units)} easy, then ${reps} × 800 m at 5K effort${paces ? ` (${paceText(paces.interval, units)})` : ''} with 400 m jog recovery, then ${dist(1, units)} easy.` }
  }
  const n = Math.max(2, Math.min(8, Math.round(work)))
  return alternate
    ? { title: 'Race-pace run', note: `${dist(wu, units)} easy, ${dist(n, units)} at goal ${c.key === 'marathon' ? 'marathon' : 'half marathon'} pace${paces ? ` (${paceText(c.key === 'marathon' ? paces.marathon : paces.threshold, units)})` : ''}, then ${dist(1, units)} easy.` }
    : { title: 'Tempo run', note: `${dist(wu, units)} easy, ${dist(work, units)} at tempo effort${paces ? ` (about ${paceText(paces.threshold, units)})` : ''}, ${dist(1, units)} easy.` }
}

// ---------------------------------------------------------------------------------------------
// Cycling
// ---------------------------------------------------------------------------------------------

const BIKE_SPEED: Record<PlanLevel, number> = { beginner: 12, intermediate: 14.5, advanced: 17 }
/** Minutes for [start, end-of-build] by role and level. */
const BIKE_MIN: Record<Exclude<Role, 'long'>, Record<PlanLevel, [number, number]>> = {
  quality: { beginner: [45, 60], intermediate: [60, 75], advanced: [60, 90] },
  quality2: { beginner: [45, 60], intermediate: [50, 70], advanced: [60, 80] },
  medium: { beginner: [45, 75], intermediate: [60, 100], advanced: [75, 120] },
  easy: { beginner: [30, 45], intermediate: [40, 60], advanced: [45, 60] },
}
const BIKE_START_LONG: Record<PlanLevel, number> = { beginner: 60, intermediate: 90, advanced: 120 }
/** Longest training ride as a share of the event, per the ~75% rule of thumb for century training. */
const BIKE_LONG_SHARE: Record<PlanLevel, number> = { beginner: 0.7, intermediate: 0.75, advanced: 0.8 }
/** Hours in a typical starting week, used to scale plans to a cyclist's actual current volume. */
const bikeBaselineHours = (level: PlanLevel) =>
  (BIKE_MIN.quality[level][0] + BIKE_MIN.medium[level][0] + BIKE_MIN.easy[level][0] + BIKE_START_LONG[level]) / 60
const BIKE_TAPER: Record<number, { long: number[] }> = { 1: { long: [0] }, 2: { long: [0.6, 0] } }

interface BikeCtx { level: PlanLevel; units: Units; ftp?: number; speed: number; event: CardioEvent }

const watts = (ftp: number | undefined, lo: number, hi: number) => (ftp ? ` (${Math.round(ftp * lo)}–${Math.round(ftp * hi)} W)` : '')
const foodTip = 'Practise eating and drinking on the bike: aim for roughly 30–60 g of carbohydrate per hour on rides over 90 minutes.'

function bikeNote(role: Role, minutes: number, week: WeekMeta, c: BikeCtx): { title: string; note: string } {
  const { ftp, level } = c
  if (role === 'easy') return { title: 'Recovery spin', note: `Very easy, high cadence (85–95 rpm), legs light.${watts(ftp, 0, 0.55)}` }
  if (role === 'long') {
    const hours = minutes >= 90
    return { title: 'Long ride', note: `Steady endurance pace: you can hold a conversation.${watts(ftp, 0.55, 0.75)}${hours ? ` ${foodTip}` : ''}` }
  }
  if (role === 'medium') return { title: 'Endurance ride', note: `Steady Zone 2 effort with a couple of gentle climbs or surges if you like.${watts(ftp, 0.55, 0.75)}` }
  if (week.phase === 'taper' || week.phase === 'race') {
    return { title: 'Openers', note: `Easy riding with 3 × 1 minute at threshold effort${watts(ftp, 0.95, 1.05)} and 2 minutes easy between, to keep your legs sharp.` }
  }
  const beginner = level === 'beginner'
  if (beginner) {
    const set = week.g < 0.34 ? `4 × 3 minutes at a brisk effort (RPE 6), 3 minutes easy between` : week.g < 0.75 ? `3 × 6 minutes at a hard-but-sustainable effort (RPE 7), 4 minutes easy between` : `3 × 8 minutes at RPE 7, 4 minutes easy between`
    return { title: 'Interval ride', note: `Warm up 10–15 minutes, then ${set}, then cool down.` }
  }
  const long = (c.event.miles ?? 0) >= 100
  if (week.g < 0.34) {
    const n = Math.min(6, 3 + Math.round(week.g * 8))
    return { title: 'Tempo blocks', note: `Warm up, then ${n} × 5 minutes at tempo (RPE 5–6)${watts(ftp, 0.76, 0.87)} with 3–5 minutes easy between, then cool down.` }
  }
  if (week.g < 0.75 || long) {
    const sets = [[2, 10], [3, 10], [3, 12], [2, 20], [2, 25]][Math.min(4, Math.floor(week.g * 5))]
    return { title: 'Sweet spot', note: `Warm up, then ${sets[0]} × ${sets[1]} minutes at sweet spot (RPE 6–7)${watts(ftp, 0.88, 0.94)} with 5 minutes easy between, then cool down.` }
  }
  return week.index % 2 === 0
    ? { title: 'Threshold intervals', note: `Warm up, then 3 × 8–10 minutes at threshold (RPE 8)${watts(ftp, 0.95, 1.05)} with 5 minutes easy between, then cool down.` }
    : { title: 'VO2 intervals', note: `Warm up, then 5 × 3 minutes hard (RPE 9)${watts(ftp, 1.06, 1.2)} with 3 minutes easy between, then cool down.` }
}

// ---------------------------------------------------------------------------------------------
// Couch to 5K: the NHS run/walk progression, 9 weeks, 3 sessions a week.
// ---------------------------------------------------------------------------------------------

type Seg = ['run' | 'walk', number] // minutes
const r = (m: number): Seg => ['run', m]
const w = (m: number): Seg => ['walk', m]
const rep = (n: number, ...s: Seg[]): Seg[] => Array.from({ length: n }, () => s).flat()

const C25K: Seg[][][] = [
  [rep(8, r(1), w(1.5)), rep(8, r(1), w(1.5)), rep(8, r(1), w(1.5))],
  [rep(6, r(1.5), w(2)), rep(6, r(1.5), w(2)), rep(6, r(1.5), w(2))],
  [rep(2, r(1.5), w(1.5), r(3), w(3)), rep(2, r(1.5), w(1.5), r(3), w(3)), rep(2, r(1.5), w(1.5), r(3), w(3))],
  [[r(3), w(1.5), r(5), w(2.5), r(3), w(1.5), r(5)], [r(3), w(1.5), r(5), w(2.5), r(3), w(1.5), r(5)], [r(3), w(1.5), r(5), w(2.5), r(3), w(1.5), r(5)]],
  [[r(5), w(3), r(5), w(3), r(5)], [r(8), w(5), r(8)], [r(20)]],
  [[r(5), w(3), r(8), w(3), r(5)], [r(10), w(3), r(10)], [r(25)]],
  [[r(25)], [r(25)], [r(25)]],
  [[r(28)], [r(28)], [r(28)]],
  [[r(30)], [r(30)], [r(30)]],
]

const fmtMin = (m: number) => (Number.isInteger(m) ? `${m} min` : m === 1.5 ? '90 sec' : m === 2.5 ? '2½ min' : `${m} min`)
const segText = (segs: Seg[]) => segs.map(([k, m]) => `${k === 'run' ? 'jog' : 'walk'} ${fmtMin(m)}`).join(', ')

// ---------------------------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------------------------

/** "8 × (jog 1 min, walk 90 sec)" for long repeats; short sessions are just listed. */
function compress(segs: Seg[]): string {
  const out: string[] = []
  let i = 0
  while (i < segs.length) {
    const block = segs.slice(i, i + 2)
    let n = 1
    while (block.length === 2 && segs.slice(i + n * 2, i + n * 2 + 2).length === 2 && segs.slice(i + n * 2, i + n * 2 + 2).every((s, k) => s[0] === block[k][0] && s[1] === block[k][1])) n++
    if (n >= 3) { out.push(`${n} × (${segText(block)})`); i += n * 2 } else { out.push(segText([segs[i]])); i++ }
  }
  return out.join(', ')
}

export function generateCardioPlan(input: CardioPlanInput): CardioPlan {
  const event = findEvent(input.eventId) ?? RUN_EVENTS[1]
  const sport: Sport = event.sport
  const warnings: string[] = []
  const anchor = input.anchorMonday
  const days = [...new Set(input.trainWeekdays)].sort((a, b) => a - b)
  const longDay = days.includes(input.longDay) ? input.longDay : days.at(-1) ?? 6
  const hasRace = !!event.miles && event.taper > 0
  const empty = (): CardioPlan => ({ event, days: [], weeks: [], warnings, raceDate: input.raceDate, peak: { volume: 0, longMiles: 0 } })

  // Timeline
  let weeks = event.id === 'c25k' ? 9 : Math.max(2, input.weeks)
  let raceIdx: number | undefined
  if (hasRace) {
    if (input.raceDate) {
      raceIdx = daysBetween(anchor, input.raceDate)
      if (raceIdx < 0) { warnings.push('That event date is before the plan would start.'); return empty() }
      weeks = Math.floor(raceIdx / 7) + 1
    } else {
      raceIdx = (weeks - 1) * 7 + longDay
    }
  }
  const firstIdx = input.fromDate && input.fromDate > anchor ? daysBetween(anchor, input.fromDate) : 0
  const lastIdx = raceIdx ?? weeks * 7 - 1
  if (firstIdx > lastIdx) { warnings.push('There is no time left before that event date.'); return empty() }
  const raceDate = raceIdx == null ? undefined : toISO(addDays(parseISO(anchor), raceIdx))

  const dateOf = (idx: number) => toISO(addDays(parseISO(anchor), idx))
  const out: CardioDay[] = []
  const meta: WeekMeta[] = []
  let paces: TrainingPaces | undefined
  let peak = { volume: 0, longMiles: 0 }
  const push = (d: Omit<CardioDay, 'date' | 'weekIndex'>, idx: number) => out.push({ ...d, date: dateOf(idx), weekIndex: Math.floor(idx / 7) })
  const rest = (idx: number) => push({ title: 'Rest', note: '', minutes: 0 }, idx)

  // ------------------------------------------------------------------ Couch to 5K
  if (event.id === 'c25k') {
    const slots = days.length >= 3 ? [days[0], days[Math.floor(days.length / 2)], days.at(-1)!] : days
    if (days.length !== 3) warnings.push('Couch to 5K uses three sessions a week with a rest day between. Using three of your days.')
    for (let idx = firstIdx; idx <= lastIdx; idx++) {
      const wk = Math.floor(idx / 7)
      const session = slots.indexOf(weekdayIndex(parseISO(dateOf(idx))))
      if (session < 0) { rest(idx); continue }
      const segs = C25K[wk][session] ?? C25K[wk][0]
      const total = segs.reduce((a, s) => a + s[1], 0)
      const first = wk === 8 && session === 2
      push({
        role: 'walkrun', title: `Week ${wk + 1} · Run ${session + 1}`, minutes: Math.round(total + 10), note:
          `Brisk 5-minute walk to warm up, then ${compress(segs)}, then a 5-minute cool-down walk. Go slow: you should be able to chat.${first ? ' Last run: you can now run 30 minutes, about 5K!' : ''}`,
      }, idx)
    }
    const weeksOut: CardioWeek[] = Array.from({ length: weeks }, (_, i) => {
      const inWeek = out.filter((d) => d.weekIndex === i && d.role)
      return { index: i, start: dateOf(i * 7), phase: i < 3 ? 'base' : i < 7 ? 'build' : 'peak', volume: Math.round((inWeek.reduce((a, d) => a + d.minutes, 0) / 60) * 10) / 10, sessions: inWeek.length }
    })
    return { event, days: out, weeks: weeksOut, warnings, raceDate: undefined, peak: { volume: Math.max(...weeksOut.map((x) => x.volume)), longMiles: 3.1 } }
  }

  // ------------------------------------------------------------------ curves
  const level = input.level
  const runKey = (event.id === 'run-base' ? 'run-base' : event.id) as RunKey
  const speed = input.speedMph ?? BIKE_SPEED[level]
  let curve: ReturnType<typeof buildCurve>

  if (sport === 'run') {
    const prof = RUN_PROFILES[runKey][level]
    const start = input.currentWeekly && input.currentWeekly > 0 ? input.currentWeekly : prof.start
    const peakWanted = event.miles ? Math.max(prof.peak, start * 1.15) : Math.max(input.targetWeekly ?? prof.peak, start * 1.1)
    const startLong = Math.max(2, Math.min(prof.startLong * (start / prof.start), start * 0.45))
    const peakLongWanted = event.miles ? prof.peakLong : Math.min(16, Math.max(startLong + 1, peakWanted * 0.35))
    const t = RUN_TAPER[event.taper] ?? { vol: [], long: [] }
    curve = buildCurve({
      weeks, taper: hasRace ? event.taper : 0, startVol: start, peakVol: peakWanted, startLong, peakLong: peakLongWanted,
      volGrowth: 0.12, longStep: runKey === 'marathon' || runKey === 'half' ? 2.5 : 1.5, taperVol: t.vol, taperLong: t.long,
    })
    if (curve.peakVol < peakWanted * 0.92) {
      warnings.push(`Your timeline is short for this event, so weekly volume peaks at about ${dist(curve.peakVol, input.units)} instead of ${dist(peakWanted, input.units)}. More weeks would allow a safer build.`)
    }
    if (runKey === 'marathon' && days.length < 4) warnings.push('Marathon plans usually use four or more running days. With fewer, your long runs make up more of your week.')
    if (runKey === 'marathon' && start < 10) warnings.push('If you are new to running, consider a 10K or half marathon first: a marathon build works best from a base of about 15+ miles a week.')
    const mins = input.goalTime ? parseDuration(input.goalTime) : null
    if (mins && event.miles) paces = trainingPaces(event.miles, mins) ?? undefined
    if (input.goalTime && !paces) warnings.push('That goal time looks off, so the plan uses effort instead of paces.')
  } else {
    const share = BIKE_LONG_SHARE[level] + ((event.miles ?? 0) <= 25 ? 0.1 : 0)
    const peakLongMiles = event.miles ? Math.min(100, event.miles * share) : 0
    // Short events peak sooner, so start the long rides lower rather than beyond the event itself.
    const eventPeakMin = event.miles ? (peakLongMiles / speed) * 60 : 0
    const startLong = event.miles ? Math.max(30, Math.min(BIKE_START_LONG[level], round5(eventPeakMin * 0.55))) : BIKE_START_LONG[level]
    const peakLongMin = event.miles ? Math.max(startLong + 15, eventPeakMin) : Math.max(startLong + 30, startLong * 1.8)
    const t = BIKE_TAPER[event.taper] ?? { long: [] }
    curve = buildCurve({
      weeks, taper: hasRace ? event.taper : 0, startVol: 1, peakVol: 1, startLong, peakLong: peakLongMin,
      volGrowth: 0.1, longStep: Math.max(15, peakLongMin * 0.14), taperVol: (t.long ?? []).map(() => 0.7), taperLong: t.long,
    })
    if (curve.peakLong < peakLongMin * 0.92) warnings.push(`Your timeline is short for this event, so your longest ride peaks at about ${formatDuration(curve.peakLong)} instead of ${formatDuration(peakLongMin)}. More weeks would help.`)
  }
  meta.push(...curve.meta)

  // ------------------------------------------------------------------ days
  const roles = assignRoles(days, longDay, sport)
  const runCtx: RunCtx = { key: runKey, level, units: input.units, paces }
  const bikeCtx: BikeCtx = { level, units: input.units, ftp: input.ftp, speed, event }
  const weekVolume = new Map<number, number>()
  const weekSessions = new Map<number, number>()
  const eventVolume = new Map<number, number>()
  const addVol = (wk: number, v: number) => { weekVolume.set(wk, (weekVolume.get(wk) ?? 0) + v); weekSessions.set(wk, (weekSessions.get(wk) ?? 0) + 1) }

  for (let wk = 0; wk * 7 <= lastIdx; wk++) {
    const m = meta[wk]
    if (!m) continue
    const isRaceWeek = raceIdx != null && wk === Math.floor(raceIdx / 7)
    const dayIdxs = Array.from({ length: 7 }, (_, d) => wk * 7 + d).filter((i) => i <= lastIdx)

    // Distances / durations for this week's roles
    const amounts = new Map<Role, number>()
    const usable = [...roles.entries()].filter(([d]) => !isRaceWeek || (raceIdx != null && wk * 7 + d < raceIdx))
    if (sport === 'run') {
      const share = runKey === 'marathon' ? 0.58 : days.length <= 4 ? 0.55 : 0.5
      const long = Math.min(m.long, m.vol * share)
      const remaining = Math.max(0, m.vol - long)
      const weights: Record<Role, number> = { long: 0, quality: 1.15, medium: 1.6, quality2: 1.0, easy: 1.0 }
      const others = usable.filter(([, ro]) => ro !== 'long')
      const total = others.reduce((a, [, ro]) => a + weights[ro], 0) || 1
      const floor = level === 'beginner' ? 2 : 2.5
      amounts.set('long', roundHalf(Math.max(floor, long)))
      for (const ro of new Set(others.map(([, x]) => x))) {
        amounts.set(ro, Math.min(roundHalf(Math.max(floor - 0.5, (remaining * weights[ro]) / total)), roundHalf(amounts.get('long')! * 0.8)))
      }
    } else {
      const scale = input.currentWeekly && input.currentWeekly > 0 ? Math.min(1.6, Math.max(0.6, input.currentWeekly / bikeBaselineHours(level))) : 1
      const cut = m.cutback ? 0.75 : m.phase === 'taper' ? 0.8 : 1
      amounts.set('long', round5(m.long))
      for (const ro of ['quality', 'quality2', 'medium', 'easy'] as const) {
        const [a, b] = BIKE_MIN[ro][level]
        amounts.set(ro, round5(lerp(a, b, m.g) * Math.min(1.25, scale) * cut))
      }
    }

    for (const idx of dayIdxs) {
      const weekday = idx - wk * 7
      const inRange = idx >= firstIdx
      if (raceIdx != null && idx === raceIdx) {
        if (!inRange) continue
        const label = event.label
        if (sport === 'run') {
          const minutes = paces && event.miles ? Math.round(event.miles * (event.id === 'marathon' ? paces.marathon : event.id === 'half' ? paces.threshold * 1.03 : event.id === '10k' ? paces.threshold * 0.97 : paces.interval * 1.02)) : Math.round((event.miles ?? 3) * 10)
          push({ role: 'race', title: `Race day: ${label}`, miles: event.miles, minutes, note: `Start easy, settle into goal pace, and finish strong. Trust your training.` }, idx)
          eventVolume.set(wk, event.miles ?? 0)
        } else {
          const minutes = Math.round(((event.miles ?? 0) / speed) * 60)
          push({ role: 'race', title: `Event day: ${label}`, miles: event.miles, minutes, note: `Start easy, eat and drink early and often, and ride your own pace.` }, idx)
          eventVolume.set(wk, Math.round((minutes / 60) * 10) / 10)
        }
        continue
      }
      const role = roles.get(weekday)
      if (!role || (raceIdx != null && idx > raceIdx) || (isRaceWeek && raceIdx != null && idx > raceIdx)) {
        if (inRange && (raceIdx == null || idx < raceIdx)) rest(idx)
        continue
      }
      if (!inRange) continue

      if (isRaceWeek) {
        // Shakeouts before the event: short and easy, with a few strides the day before.
        const dayBefore = raceIdx != null && idx === raceIdx - 1
        if (sport === 'run') {
          const miles = roundHalf(Math.min(dayBefore ? 3 : 4, Math.max(1.5, m.vol / Math.max(1, usable.length))))
          push({ role: 'easy', title: dayBefore ? 'Shakeout run' : 'Easy run', miles, minutes: Math.round(miles * (paces ? paces.easy[0] : 10.5)), note: dayBefore ? 'Very easy, with 4 × 20-second strides. Lay out your race kit and rest.' : `Short and relaxed to keep your legs fresh.${paces ? ` About ${range(paces.easy[0], paces.easy[1], input.units)}.` : ''}` }, idx)
          addVol(wk, miles)
        } else {
          const minutes = dayBefore ? 30 : 45
          push({ role: 'easy', title: dayBefore ? 'Shakeout spin' : 'Easy spin', minutes, note: dayBefore ? 'Easy 30 minutes with 3 short accelerations. Check your bike and rest.' : 'Relaxed, high-cadence riding to stay loose.' }, idx)
          addVol(wk, minutes / 60)
        }
        continue
      }

      if (sport === 'run') {
        const miles = amounts.get(role) ?? 2.5
        const { title, note } = runNote(role, miles, m, runCtx)
        push({ role, title: m.cutback ? `${title} (cutback week)` : title, miles, minutes: Math.round(miles * (paces ? (role === 'easy' || role === 'long' ? (paces.easy[0] + paces.easy[1]) / 2 : paces.marathon) : role === 'quality' || role === 'quality2' ? 10 : 11)), note }, idx)
        addVol(wk, miles)
      } else {
        const minutes = amounts.get(role) ?? 60
        const { title, note } = bikeNote(role, minutes, m, bikeCtx)
        push({ role, title: m.cutback ? `${title} (cutback week)` : title, minutes, miles: Math.round((minutes / 60) * speed * 2) / 2, note }, idx)
        addVol(wk, minutes / 60)
      }
    }
  }

  const weeksOut: CardioWeek[] = []
  for (let wk = 0; wk * 7 <= lastIdx; wk++) {
    if (!meta[wk]) continue
    weeksOut.push({ index: wk, start: dateOf(wk * 7), phase: meta[wk].phase, volume: Math.round((weekVolume.get(wk) ?? 0) * 10) / 10, eventVolume: eventVolume.get(wk), sessions: weekSessions.get(wk) ?? 0 })
  }
  const longs = out.filter((d) => d.role === 'long' && d.miles)
  peak = { volume: Math.max(0, ...weeksOut.filter((x) => x.phase !== 'race').map((x) => x.volume)), longMiles: Math.max(0, ...longs.map((d) => d.miles!)) }
  return { event, days: out, weeks: weeksOut, warnings, paces, raceDate, peak }
}

/** Turn a plan day into a plan entry the Plan tab understands. Rest days have no entry. */
export function toPlanned(day: CardioDay, sport: Sport): PlannedExercise | null {
  if (!day.role) return null
  const item: PlannedExercise = {
    exerciseId: sport === 'run' ? 'running' : 'cycling',
    sets: 1,
    minutes: day.minutes,
    est: day.minutes,
    note: `${day.title}: ${day.note}`,
  }
  if (day.miles) item.distance = day.miles
  return item
}

export { BIKE_EVENTS, RUN_EVENTS }
export const MILES_PER_METER = 1 / MILE
