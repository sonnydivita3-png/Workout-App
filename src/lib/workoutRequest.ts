import type { AboutMe, ExerciseLog, PlannedExercise, Units } from '../types'
import { BUILTIN_BY_ID } from '../data/exercises'
import { addFinisher, generateWorkout, minutesFor, styleInfo, STYLE_GROUPS, type GenerateOptions, type WorkoutStyle } from './randomizer'
import type { RestPref } from './timing'
import { CARDIO_SESSIONS, cardioSession, tabataMinutes, type CardioSessionKind } from './cardioSession'
import { cardioIds, exerciseFor, inclineOf, INCLINES, sessionOf, type CardioSetup } from './cardioSetup'
import {
  cardioMet, EFFORTS, effortLabel, fitCardio, metForRate, perMinute, planForCalories, planWithin, recentSpeed, SESSION_FACTOR,
  setCardioEffort, setCardioPace, setIncline, STYLE_MET, styleFor, WARMUP_MET, workoutCalories, workoutMet, type CaloriePlan, type Effort, type TimedPlan, type WorkoutMets,
} from './calorieTarget'
import { inclinable, metFor, restingPerHour, speedForMet, topSpeed } from './calories'
import { distanceFactor, formatPaceFor } from './units'
import { withGearFor } from './equipment'
import { withCardioFor } from './cardioPrefs'
import { BY_ID, mulberry32 } from './randomUtil'

/**
 * What "Make me a workout" asks for, and everything worked out from it: the parts and their minutes, a calorie target's
 * plan, how hard the cardio has to go. The sheet shows these and makes the workout from them, and tests make the very
 * same workouts, so what's tested is what people get.
 */

export type Kind = 'lift' | 'cond' | 'cardio'
export type WarmPick = 'cardio' | 'mobility' | 'sets'
export const LIFT_STYLES: WorkoutStyle[] = ['standard', 'strength', 'supersets', 'bodyweight', 'functional', 'posture']
/** HIIT, Timed, Hyrox / CrossFit, each with its variations. */
export const COND_GROUPS = STYLE_GROUPS.filter((g) => g.styles.every((st) => !LIFT_STYLES.includes(st)))
/** Speeds most people can't hold for long, when there are no logs of theirs to go by (mph). */
export const FAST: Record<string, number> = { running: 9, Running_Treadmill: 9, cycling: 18, Bicycling: 18, walking: 4.5, Walking_Treadmill: 4.5 }

/**
 * The shortest each part can be (what its format needs: six PHA stations twice through, a circuit's rounds, a cardio
 * session with its easy start and finish), so a short session's parts are never planned shorter than they'll be made.
 */
export const MIN_PART: Partial<Record<WorkoutStyle | 'cardio', number>> = {
  cardio: 10, pha: 15, posture: 15, hyrox: 15, supersets: 10, circuit: 10, crossfit: 10, tabata: 10, functional: 10,
}
export const minPart = (k: string) => (k === 'warmup' ? 2 : MIN_PART[k as WorkoutStyle | 'cardio'] ?? 5)

export interface WorkoutRequest {
  kinds: Kind[]
  liftStyle: WorkoutStyle
  condStyle: WorkoutStyle
  /** Body parts picked. */
  focus: string[]
  cardio: CardioSetup
  /** Total minutes picked (split evenly between the parts unless set per part). */
  minutes: number
  /** Minutes set for a part with − and + (warmup, a style, cardio). */
  split: Record<string, number>
  warm: WarmPick[]
  /** With lifting, cardio first (their saved order applies when the setup doesn't say). */
  stackOrder?: string
  goal: 'time' | 'calories'
  kcal: number | null
  timeLimit: number | null
  /** Their pace for the cardio, as typed (mph or km/h). */
  paceIn: number | null
  effort: Effort
  /** Their weight (known or typed), lb. */
  lb: number | null
  me?: AboutMe | null
  today: string
  units: Units
  /** Active calories, or total (resting included). */
  countTotal: boolean
  /** Their usual cardio (profile), what "any" cardio means for calorie numbers. */
  profileCardio: string[]
  logs: ExerciseLog[]
  /** Equipment for this workout (null: a full gym). */
  gear: string[] | null
  /** Machines for stations when there's no cardio part. */
  stations: { cardio: string[]; split: boolean }
}

export interface RequestPlan {
  has: (k: Kind) => boolean
  styles: WorkoutStyle[]
  focusIgnored: boolean
  needsParts: boolean
  canGenerate: boolean
  cardioOnly: boolean
  one?: string
  sessionKind: CardioSessionKind
  fixedCardio: number | null
  cardioFlex: boolean
  goal: 'time' | 'calories'
  body: string[]
  genFocus: string[]
  hasCardio: boolean
  cardioStart: boolean
  parts: string[]
  showSplit: boolean
  warmDefault: number
  partMin: (k: string) => number
  warmSplit: () => { cardio?: number; mobility?: number }
  lifting: boolean
  total0: number
  incline: number
  cardioMetHere: number
  withSpeed: boolean
  recentHere: number | null
  paceMph: number | null
  rate: (met: number) => number
  metOf: (rate: number) => number
  /** Resting burn a minute (for "active" vs "total" numbers). */
  restPerMin: number
  untimed: CaloriePlan | null
  timed: TimedPlan | null
  /** A time limit was picked and their usual pace gets there inside it. */
  inLimit: boolean
  cal: CaloriePlan | TimedPlan | null
  needMet: number | null
  speed: number | null
  effort: ReturnType<typeof effortLabel> | null
  liftNeed: WorkoutStyle | null
  tooHard: boolean
  steeper?: number
  usualMinutes: number | null
  mets: WorkoutMets
  minFor: (k: string) => number
  totalMin: number
  computed: (k: string) => boolean
  stationIds: string[]
}

export function planRequest(req: WorkoutRequest): RequestPlan {
  const { kinds, liftStyle, condStyle, focus, cardio, minutes, split, warm, kcal, timeLimit, lb, today, me } = req
  const has = (k: Kind) => kinds.includes(k)
  const styles: WorkoutStyle[] = [...(has('lift') ? [liftStyle] : []), ...(has('cond') ? [condStyle] : [])]
  const picked = cardioIds(cardio)
  // Stations in timed pieces use the cardio picked for this workout, else the conditioning choice, else the profile.
  const stationIds = has('cardio') ? picked : req.stations.cardio
  const infos = styles.map(styleInfo)
  const focusIgnored = infos.length > 0 && infos.every((i) => i.focus === 'ignored')
  const needsParts = infos.some((i) => i.focus === 'required')
  const canGenerate = kinds.length > 0 && (!needsParts || focus.length > 0)
  const cardioOnly = styles.length === 0
  const one = picked.length === 1 ? exerciseFor(picked[0]) : undefined
  // What the cardio picker shows as picked (a Tabata saved for an outside run isn't one on the treadmill).
  const sessionKind = sessionOf(cardio)
  // Tabata is a set amount of work with its warm-up and cool-down on top: its own length, not the time picked (and no
  // calorie target, which would mean stretching it).
  const fixedCardio = has('cardio') && sessionKind === 'tabata' ? Math.round(tabataMinutes(cardio.tabata, cardio.rounds)) : null
  // With a calorie target, Tabata stays as it is (like the warm-up) and the rest of the workout makes up the burn. On
  // its own there's nothing to make it up, so it's planned by time.
  const cardioFlex = has('cardio') && !fixedCardio
  const goal = fixedCardio && cardioOnly ? 'time' : req.goal
  const body = cardioOnly || focusIgnored ? [] : focus
  // What the generator gets: body parts, plus Cardio when there's a cardio part.
  const genFocus = [...body, ...(has('cardio') ? ['Cardio'] : [])]
  // Mixing parts (several styles, or lifting + cardio): let each part have its own time.
  const hasCardio = has('cardio') && !cardioOnly
  // Warm-up cardio and mobility take their own minutes (5 each by default); warm-up sets live inside the lifting.
  const warmDefault = (warm.includes('cardio') ? 5 : 0) + (warm.includes('mobility') ? 5 : 0)
  // Cardio with lifting: first or last, as picked (their usual order from plans until then).
  const cardioStart = hasCardio && (cardio.first ?? req.stackOrder === 'cardio')
  const parts: string[] = [...(warmDefault ? ['warmup'] : []), ...(cardioStart ? ['cardio'] : []), ...styles, ...(hasCardio && !cardioStart ? ['cardio'] : [])]
  const showSplit = parts.length > 1 && !cardioOnly
  const workParts = parts.length - (warmDefault ? 1 : 0)
  const evenShare = Math.max(5, Math.round((minutes - warmDefault) / Math.max(1, workParts) / 5) * 5)
  const partMin = (k: string) => (k === 'cardio' && fixedCardio ? fixedCardio : split[k] ?? (k === 'warmup' ? warmDefault : Math.max(minPart(k), evenShare)))
  const warmSplit = () => {
    const w = warmDefault ? partMin('warmup') : 0
    if (warm.includes('cardio') && warm.includes('mobility')) { const c = Math.round(w * 0.55); return { cardio: c, mobility: w - c } }
    return warm.includes('cardio') ? { cardio: w } : warm.includes('mobility') ? { mobility: w } : {}
  }
  const lifting = styles.some((st) => ['standard', 'strength', 'bodyweight', 'supersets'].includes(st))
  const total0 = showSplit ? parts.reduce((a, k) => a + partMin(k), 0) : fixedCardio ?? minutes

  // A calorie target: lifting and conditioning keep the minutes they set, the cardio makes up the rest (without cardio,
  // the parts grow together). "Any" cardio means what they usually do (their profile).
  const exerciseIds = (types: string[]) => types.map(exerciseFor).filter((id): id is string => !!id)
  // On a treadmill, its incline: the climb burns more at the same speed.
  const incline = inclineOf(cardio)
  const cardioMetHere = cardioMet(exerciseIds(picked.length ? picked : req.profileCardio), sessionKind, incline)
  const withSpeed = !!one && topSpeed(one) != null
  const recentHere = one ? recentSpeed(req.logs, [one]) : null
  const paceMph = withSpeed ? (req.paceIn != null ? req.paceIn / distanceFactor(req.units) : recentHere) : null
  const paceMet = withSpeed && paceMph ? metFor(one!, { distance: paceMph, minutes: 60, incline }) * SESSION_FACTOR[sessionKind] : cardioMetHere * EFFORTS[req.effort]
  // Lifting and conditioning burn what the exercises this request gets burn (a biceps day's curls far less than a leg
  // day's squats), worked out from a sample of the workout, not one number per style.
  const styleMet = (st: WorkoutStyle) => (req.goal === 'calories' && lb ? sampleMet(req, st, body, stationIds, partMin(st)) : null) ?? STYLE_MET[st]
  const calParts = cardioOnly
    ? [{ key: 'cardio', met: paceMet, minutes }]
    : parts.map((k) => ({ key: k, met: k === 'warmup' ? WARMUP_MET : k === 'cardio' ? paceMet : styleMet(k as WorkoutStyle), minutes: partMin(k) }))
  // Active calories (on top of resting, like a watch's active number) or total (resting included, like a gym machine).
  const restPerMin = lb ? restingPerHour(lb, today, me) / 60 : 0
  const rate = (met: number) => perMinute(met, lb ?? 0, today, me) + (req.countTotal ? restPerMin : 0)
  const metOf = (r: number) => metForRate(r - (req.countTotal ? restPerMin : 0), lb ?? 0, today, me)
  const flexible = cardioFlex ? 'cardio' : undefined
  const steady = fixedCardio ? ['cardio'] : []
  const untimed = goal === 'calories' && lb && kcal ? planForCalories(kcal, calParts, rate, flexible, steady) : null
  // A time limit is the most it may take: when their usual pace gets there sooner, that's the plan (going easier to fill
  // the time can't work for lifting, which would then burn far more than asked). Only past it does it have to go harder.
  const timed = untimed && timeLimit && untimed.totalMinutes > timeLimit ? planWithin(kcal!, timeLimit, calParts, rate, metOf, flexible, steady) : null
  const inLimit = !!untimed && !!timeLimit && !timed
  const cal = timed ?? untimed
  // Within a time limit: how hard it has to be. Runs, walks and rides get a speed (compared with their recent ones);
  // other cardio an effort; lifting on its own, the style that burns enough.
  const needMet = timed?.needMet ?? null
  const speed = needMet && one && cardioFlex ? speedForMet(one, needMet / SESSION_FACTOR[sessionKind], incline) : null
  const effort = needMet && cardioFlex ? effortLabel(needMet / cardioMetHere) : null
  const liftNeed = needMet && !cardioFlex ? styleFor(needMet) : null
  const tooHard = !!timed && (needMet == null || (cardioFlex
    ? speed ? speed >= (topSpeed(one!) ?? Infinity) - 0.01 || speed > (recentHere ? recentHere * 1.15 : FAST[one!] ?? Infinity) : effort === 'too hard' || effort === 'very hard'
    : !liftNeed))
  // On a treadmill, the incline that brings the speed it takes back within reach.
  const reachable = (g: number) => speedForMet(one!, needMet! / SESSION_FACTOR[sessionKind], g)!
  const steeper = tooHard && speed && needMet && inclinable(one)
    ? INCLINES.find((g) => g > incline && reachable(g) <= (recentHere ? recentHere * 1.15 : FAST[one!] ?? Infinity) && reachable(g) < (topSpeed(one!) ?? Infinity) - 0.01)
    : undefined
  // What it takes at a usual effort, to offer as the time instead.
  const usualMinutes = untimed ? Math.ceil(untimed.totalMinutes / 15) * 15 : null
  const mets: WorkoutMets = { lift: STYLE_MET[liftStyle], cond: STYLE_MET[condStyle], cardioFactor: SESSION_FACTOR[sessionKind] }
  const minFor = (k: string) => cal?.minutes[k] ?? partMin(k)
  const totalMin = cal ? cal.totalMinutes : total0
  const computed = (k: string) => (k === 'cardio' && !!fixedCardio) || (!!cal && k !== 'warmup' && (cardioFlex ? k === 'cardio' : k !== 'cardio' || !has('cardio')))
  return {
    has, styles, focusIgnored, needsParts, canGenerate, cardioOnly, one, sessionKind, fixedCardio, cardioFlex, goal, body, genFocus, hasCardio,
    cardioStart, parts, showSplit, warmDefault, partMin, warmSplit, lifting, total0, incline, cardioMetHere, withSpeed, recentHere, paceMph,
    rate, metOf, restPerMin, untimed, timed, inLimit, cal, needMet, speed, effort, liftNeed, tooHard, steeper, usualMinutes, mets, minFor, totalMin, computed, stationIds,
  }
}

// Samples already made (the sheet works the plan out on every change; the sample only depends on these).
const samples = new Map<string, number | null>()
/** The average MET of a sample workout in style `st` for this request's body parts, equipment and stations. */
function sampleMet(req: WorkoutRequest, st: WorkoutStyle, body: string[], stations: string[], minutes: number): number | null {
  const key = JSON.stringify([st, body, req.gear, stations, Math.round(minutes / 15)])
  if (!samples.has(key)) {
    const mets: WorkoutMets = { lift: STYLE_MET[st], cond: STYLE_MET[st], cardioFactor: 1 }
    const items = withGearFor(req.gear, () => withCardioFor(stations, false, () => generateWorkout(body, Math.max(minPart(st), minutes), { style: st, rng: mulberry32(7), warmed: true })))
    samples.set(key, workoutMet(items, mets))
    if (samples.size > 200) samples.delete(samples.keys().next().value!)
  }
  return samples.get(key) ?? null
}

/** The label a session gets (for names and the summary line). */
export const sessionLabelOf = (k: CardioSessionKind) => CARDIO_SESSIONS.find((x) => x.id === k)!.label
export const cardioNameOf = (plan: RequestPlan) => (plan.one ? (BUILTIN_BY_ID.get(plan.one)?.name ?? 'Cardio') : 'Cardio')

/** Run `fn` with this workout's equipment and cardio choices (stations use the cardio picked, else the conditioning pick). */
export function withRequestChoices<T>(req: WorkoutRequest, plan: RequestPlan, fn: () => T): T {
  return withGearFor(req.gear, () => withCardioFor(plan.stationIds, plan.has('cardio') ? req.cardio.split : req.stations.split, fn))
}

export interface RequestExtras {
  rest: RestPref
  drops: boolean
  /** Where the last drop sets went. */
  avoidDropGroups?: string[]
  /** Exercises to use only if nothing else fits (a reroll's last version, this week's other PHA). */
  avoid: Set<string>
}

/** The generator's options for this request. */
export function requestOptions(req: WorkoutRequest, plan: RequestPlan, extras: RequestExtras): GenerateOptions {
  const { cardio } = req
  const cardioSpec = plan.has('cardio') ? { exerciseId: plan.one, kind: plan.sessionKind, tabata: cardio.tabata, rounds: cardio.rounds } : undefined
  // Cardio on its own: its session has its own warm-up and cool-down, so no warm-up cardio or mobility before it.
  const warmup = plan.cardioOnly ? {} : { ...plan.warmSplit(), sets: req.warm.includes('sets') && plan.lifting }
  return {
    style: plan.styles[0], styles: plan.styles, rest: extras.rest, warmup, cardio: cardioSpec,
    dropSets: extras.drops && plan.lifting,
    // Drop sets go on other muscles than last time's.
    avoidDropGroups: extras.drops && plan.lifting ? extras.avoidDropGroups : undefined,
    ...(plan.showSplit ? { minutesByStyle: Object.fromEntries(plan.styles.map((st) => [st, plan.minFor(st)])), ...(plan.hasCardio ? { cardioMinutes: plan.minFor('cardio') } : {}) } : {}),
    avoid: extras.avoid,
  }
}

/**
 * The workout for this request, as Make me a workout makes it: generated (call inside withRequestChoices), the
 * treadmill incline set, and with a calorie target the cardio fitted to it (within a time limit, as hard as it has to
 * go; otherwise at their pace, its time stretched to land on the target).
 */
export function makeWorkout(req: WorkoutRequest, plan: RequestPlan, opts: GenerateOptions): PlannedExercise[] {
  return finishCardio(fitRequest(req, plan, opts), req, plan)
}

const SESSION_OF: [RegExp, CardioSessionKind][] = [[/^Steady/, 'steady'], [/^Intervals/, 'intervals'], [/^Tempo/, 'tempo'], [/^Hills/, 'hills'], [/^Time trial/, 'trial']]

/**
 * The cardio as it will be done, after its time and pace were fitted to a calorie target: their own pace (typed, or
 * their recent one) as it is, and a pace worked out to land the target inside a time limit no faster than most people
 * can hold (or a little past their recent pace, if they're quicker than most); the setup says when the target needs
 * more. Each session's breakdown is written out for its final length and effort (fitting a 65-minute tempo run to 70
 * left it described as 65, and a squeezed run said "easy, conversational" at a 5-minute-mile pace).
 */
function finishCardio(items: PlannedExercise[], req: WorkoutRequest, plan: RequestPlan): PlannedExercise[] {
  const planned = !!plan.timed && plan.needMet != null
  return items.map((p) => {
    if (p.warmup || p.block || !p.minutes || BY_ID.get(p.exerciseId)?.kind !== 'cardio') return p
    let q = p
    if (q.distance) {
      const recent = p.exerciseId === plan.one ? plan.recentHere : null
      const reach = planned ? Math.max(FAST[p.exerciseId] ?? Infinity, recent ? recent * 1.15 : 0) : Infinity
      // Down to the tenth of a mile, so rounding never takes it past that (nor past what anyone holds that long).
      const most = Math.min(topSpeed(p.exerciseId) ?? Infinity, reach)
      if (q.distance / (q.minutes! / 60) > most) q = { ...q, distance: Math.floor(most * (q.minutes! / 60) * 10) / 10 }
    }
    if (q.intensity && q.intensity > EFFORTS['very hard']) q = { ...q, intensity: EFFORTS['very hard'] }
    const kind = SESSION_OF.find(([re]) => re.test(q.note ?? ''))?.[1]
    if (!kind) return q
    // Fitted down to a few minutes: too short for a structured session, so it's an easy few minutes to finish.
    if (q.minutes! < 10) return { ...q, note: `Steady · ${q.minutes} min easy to finish`, distance: undefined, intensity: undefined }
    const fresh = cardioSession(q.exerciseId, kind, q.minutes!, { tabata: req.cardio.tabata, rounds: req.cardio.rounds }).note ?? q.note
    // A steady session at a set pace or effort says so, rather than "easy".
    const pace = q.distance ? formatPaceFor(q.distance, q.minutes!, q.exerciseId, req.units) : null
    const effort = q.intensity ? effortLabel(q.intensity) : null
    const note = kind !== 'steady' || (!pace && !effort) ? fresh
      : pace ? `Steady · ${q.minutes} min at an even pace, about ${pace}`
        : `Steady · ${q.minutes} min at a ${effort} effort`
    return note === q.note ? q : { ...q, note }
  })
}

function fitRequest(req: WorkoutRequest, plan: RequestPlan, opts: GenerateOptions): PlannedExercise[] {
  const make = (o: GenerateOptions, total: number) => setIncline(generateWorkout(plan.genFocus, total, o), plan.has('cardio') ? plan.incline : 0)
  const made = make(opts, plan.totalMin)
  const { cal, timed, needMet, cardioFlex, sessionKind } = plan
  if (timed && needMet && cardioFlex) return setCardioEffort(made, needMet, SESSION_FACTOR[sessionKind])
  if (!cal || !req.kcal) return made
  // A time limit the other parts already fill (the setup said so): the cardio gets what's left, not the target's time.
  if (timed && cardioFlex) return fitWithin(made, req.timeLimit!)
  // Cardio that can stretch lands the target: it goes at their pace, and its time stretches.
  if (cardioFlex) return fitCardio(setCardioPace(made, { exerciseId: plan.one, mph: plan.paceMph, effort: req.effort }), req.kcal, plan.rate, plan.mets)
  // Nothing stretches (lifting or conditioning on their own, or a Tabata's set length): the plan's minutes come from a
  // style's average burn, and the exercises it picks can burn more or less. Made again at the length that should land
  // it, a couple of times, keeping the closest.
  const burn = (items: PlannedExercise[]) => workoutCalories(items, plan.rate, plan.mets)
  let best = made
  let o = opts
  let total = plan.totalMin
  // A time limit holds: past it the setup offered a harder style or cardio instead, so the workout doesn't grow past it.
  const most = req.timeLimit ?? MAX_MINUTES
  for (let k = 0; k < 3; k++) {
    const r = req.kcal / Math.max(1, burn(best))
    if (r > 0.93 && r < 1.07) break
    ;[o, total] = scaled(o, total, r, plan)
    if (total > most) break
    const next = make(o, total)
    if (Math.abs(burn(next) - req.kcal) < Math.abs(burn(best) - req.kcal)) best = next
  }
  return best
}

/** Cardio pieces shortened together so the workout fits `limit` minutes (each at least 10, the shortest session). */
function fitWithin(items: PlannedExercise[], limit: number): PlannedExercise[] {
  const pieces = items.filter((p) => !p.warmup && !p.block && !!p.minutes && BY_ID.get(p.exerciseId)?.kind === 'cardio')
  if (!pieces.length) return items
  const others = minutesFor(items.filter((p) => !pieces.includes(p)))
  const now = pieces.reduce((a, p) => a + p.minutes!, 0)
  const scale = Math.max(0, limit - others) / Math.max(1, now)
  return items.map((p) => {
    if (!pieces.includes(p)) return p
    const minutes = Math.max(10, Math.floor((p.minutes! * scale) / 5) * 5)
    return { ...p, minutes, est: minutes, ...(p.distance ? { distance: Math.round(p.distance * (minutes / p.minutes!) * 10) / 10 } : {}) }
  })
}

/** The longest a workout made for a calorie target may get. */
const MAX_MINUTES = 180

/** The options with the stretchable parts (not the warm-up, not a Tabata's set length) scaled by `r`, and the new total. */
function scaled(o: GenerateOptions, total: number, r: number, plan: RequestPlan): [GenerateOptions, number] {
  const by = o.minutesByStyle
  if (!by) return [o, Math.max(10, Math.round((total * r) / 5) * 5)]
  const next = Object.fromEntries(Object.entries(by).map(([st, m]) => [st, Math.max(minPart(st), Math.round(((m ?? 0) * r) / 5) * 5)]))
  const warm = (o.warmup?.cardio ?? 0) + (o.warmup?.mobility ?? 0)
  const cardio = plan.hasCardio ? o.cardioMinutes ?? 0 : 0
  return [{ ...o, minutesByStyle: next }, warm + cardio + Object.values(next).reduce((a, m) => a + (m ?? 0), 0)]
}

/**
 * Easy cardio added to a workout that can't burn the target on its own (a Tabata or a Hyrox has its own length; a
 * bodyweight day runs out of moves): the time it takes at an easy pace for what's missing. Call inside withRequestChoices.
 */
export function topUpCalories(items: PlannedExercise[], req: WorkoutRequest, plan: RequestPlan): PlannedExercise[] {
  if (!req.kcal) return items
  const missing = req.kcal - workoutCalories(items, plan.rate, plan.mets)
  if (missing <= 0) return items
  // At about 7 METs (a steady machine or a jog) the time to burn what's missing, then the cardio fitted to the target.
  const minutes = Math.max(10, Math.ceil(missing / Math.max(1, plan.rate(7)) / 5) * 5)
  const withCardio = addFinisher(items, minutesFor(items) + minutes + 2)
  return withCardio === items ? items : fitCardio(withCardio, req.kcal, plan.rate, plan.mets)
}
