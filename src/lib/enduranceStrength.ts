import { BUILTIN_BY_ID } from '../data/exercises'
import type { PlannedExercise, PlanOverrides, Program, Sport } from '../types'
import type { WeekPhase } from './cardioPlan'
import { addDays, mondayOf, parseISO, toISO } from './dates'
import { hasGear } from './equipment'

// ---------------------------------------------------------------------------------------------
// Strength training made for a run or bike plan.
//
// What the research says, and how it's used here:
// - Heavy (about 80%+ of max, low reps) and explosive/plyometric strength training improve running economy; heavy
//   strength training improves cycling economy (Rønnestad & Mujika 2014, Scand J Med Sci Sports; Llanos-Lagos et al.
//   2024, Sports Med). So the main lifts go heavy once the base is built, and runners get hops and jumps.
// - Two sessions a week build strength; one a week keeps it through the competition period (Rønnestad et al. 2010,
//   cyclists: 2/week for 12 weeks, then 1/week kept the gains for 13 weeks). So: two a week in base and build, one at
//   peak, one light session in taper week, none in race week.
// - Hard lower-body lifting still blunts a hard run 24 hours later (Doma et al.). So never the day before the long run,
//   a hard session or the race; best on a hard day after the run ("keep hard days hard, easy days easy"), else after an
//   easy run.
// - Runners get calves (straight and bent knee, the soleus), single-leg work, hamstrings (Nordic curls) and hips/core;
//   upper body only for posture. Sets stop a couple of reps short of failure, so the running doesn't suffer.
// ---------------------------------------------------------------------------------------------

/** A run/ride from the plan, with what kind of session it is and the plan phase of its week. */
export interface PlanSession {
  date: string
  kind: 'long' | 'hard' | 'easy' | 'race'
  phase: WeekPhase
}

/** How hard a session is, from its title ("Long run: …", "Intervals: …"); the planned item's note starts with it. */
export function sessionKind(title: string): PlanSession['kind'] {
  if (/^(race|event) day/i.test(title)) return 'race'
  if (/^long (run|ride)/i.test(title)) return 'long'
  if (/interval|tempo|cruise|fartlek|steady run|hill|race-pace|sharpener|openers|sweet spot|threshold|vo2/i.test(title)) return 'hard'
  return 'easy'
}

/**
 * The sessions of a run/bike plan from today on. Plans added from now on store each week's phase; for older ones it's
 * worked out: the race week and the week before it, weeks a good deal lighter than the one before (cutbacks), the first
 * third base, the rest build.
 */
export function planSessions(p: Program, overrides: PlanOverrides): PlanSession[] {
  const titleOf = (date: string) => {
    const item = (overrides[date] ?? []).find((x) => (x.plan ? x.plan === p.id : x.exerciseId === p.entries.find((e) => e.date === date)?.exerciseId))
    return { title: item?.note?.split(':')[0] ?? '', minutes: item?.minutes ?? 0 }
  }
  const rows = p.entries.map((e) => ({ date: e.date, phase: e.phase, ...titleOf(e.date) })).sort((a, b) => a.date.localeCompare(b.date))
  const weekOf = (d: string) => toISO(mondayOf(parseISO(d)))
  const weeks = [...new Set(rows.map((r) => weekOf(r.date)))]
  const minutes = weeks.map((w) => rows.filter((r) => weekOf(r.date) === w).reduce((a, r) => a + r.minutes, 0))
  const raceWeek = weeks.findIndex((w) => rows.some((r) => weekOf(r.date) === w && sessionKind(r.title) === 'race'))
  const guess = (i: number): WeekPhase =>
    i === raceWeek ? 'race'
      : raceWeek >= 0 && i === raceWeek - 1 ? 'taper'
        : i > 0 && minutes[i] < minutes[i - 1] * 0.85 ? 'cutback'
          : i < weeks.length / 3 ? 'base' : 'build'
  return rows.map((r) => ({ date: r.date, kind: sessionKind(r.title), phase: r.phase ?? guess(weeks.indexOf(weekOf(r.date))) }))
}

/**
 * Strength sessions a week in each phase of the plan, given what they picked for base and build (1 to 4): about half
 * at peak and in cutback weeks (one a week is enough to keep strength), one light one in taper, none in race week.
 */
export const sessionsFor = (phase: WeekPhase, perWeek: number) =>
  phase === 'race' ? 0 : phase === 'base' || phase === 'build' ? perWeek : phase === 'taper' ? 1 : Math.ceil(perWeek / 2)

// Each slot: the first of these they have the gear for. Library ids.
const PICK: Record<string, string[]> = {
  squat: ['Barbell_Full_Squat', 'Trap_Bar_Deadlift', 'Leg_Press', 'x-goblet-squat', 'Dumbbell_Squat', 'Bodyweight_Squat'],
  hinge: ['Romanian_Deadlift', 'Trap_Bar_Deadlift', 'Stiff-Legged_Dumbbell_Deadlift', 'Kettlebell_One-Legged_Deadlift', 'Single_Leg_Glute_Bridge'],
  single: ['x-bulgarian-split-squat', 'Split_Squat_with_Dumbbells', 'Dumbbell_Step_Ups', 'Barbell_Step_Ups', 'Bodyweight_Walking_Lunge'],
  singleHinge: ['Kettlebell_One-Legged_Deadlift', 'Barbell_Hip_Thrust', 'Single_Leg_Glute_Bridge'],
  hamstring: ['Natural_Glute_Ham_Raise', 'Lying_Leg_Curls', 'Seated_Leg_Curl'],
  // Nordic curls are very hard at first: new runners start on the machine.
  hamstringEasy: ['Lying_Leg_Curls', 'Seated_Leg_Curl', 'Natural_Glute_Ham_Raise'],
  calfBent: ['Seated_Calf_Raise', 'Dumbbell_Seated_One-Leg_Calf_Raise', 'Barbell_Seated_Calf_Raise', 'x-single-leg-calf-raise'],
  calfStraight: ['Standing_Calf_Raises', 'Standing_Dumbbell_Calf_Raise', 'Calf_Raise_On_A_Dumbbell', 'x-single-leg-calf-raise'],
  plyoA: ['x-pogo-jumps'],
  plyoB: ['Lateral_Bound', 'x-single-leg-hops'],
  jump: ['x-box-jump', 'x-jump-squat'],
  coreA: ['Pallof_Press', 'Dead_Bug'],
  coreB: ['Side_Bridge', 'x-copenhagen-plank', 'Plank'],
  coreC: ['Hanging_Leg_Raise', 'Ab_Roller', 'Dead_Bug'],
  hollow: ['x-hollow-hold', 'Plank'],
  birdDog: ['x-bird-dog'],
  copenhagen: ['x-copenhagen-plank', 'Side_Bridge'],
  balance: ['x-single-leg-balance'],
  balanceHinge: ['Kettlebell_One-Legged_Deadlift', 'Single_Leg_Glute_Bridge'],
  stepUp: ['Dumbbell_Step_Ups', 'Step-up_with_Knee_Raise', 'Barbell_Step_Ups'],
  pull: ['Seated_Cable_Rows', 'One-Arm_Dumbbell_Row', 'Inverted_Row'],
  pullDown: ['Pullups', 'Wide-Grip_Lat_Pulldown', 'Chin-Up', 'Inverted_Row'],
  row2: ['One-Arm_Dumbbell_Row', 'Seated_Cable_Rows', 'Inverted_Row'],
  rearDelt: ['Face_Pull', 'Reverse_Flyes', 'x-prone-ytw'],
  ytw: ['x-prone-ytw', 'x-wall-angel'],
  backExt: ['Hyperextensions_Back_Extensions', 'Hyperextensions_With_No_Hyperextension_Bench', 'x-bird-dog'],
  push: ['Pushups', 'Dumbbell_Bench_Press'],
  bench: ['Dumbbell_Bench_Press', 'Barbell_Bench_Press_-_Medium_Grip', 'Pushups'],
  incline: ['Incline_Dumbbell_Press', 'Pushups'],
  fly: ['Dumbbell_Flyes', 'Cable_Crossover'],
  press: ['Dumbbell_Shoulder_Press', 'Standing_Military_Press', 'Kettlebell_Arnold_Press', 'Pushups'],
  lateral: ['Side_Lateral_Raise'],
  curl: ['Dumbbell_Bicep_Curl', 'Hammer_Curls', 'Barbell_Curl'],
  triceps: ['Triceps_Pushdown_-_Rope_Attachment', 'Triceps_Pushdown', 'Tricep_Dumbbell_Kickback', 'Bench_Dips'],
  hipThrust: ['Barbell_Hip_Thrust', 'Butt_Lift_Bridge'],
  kickback: ['One-Legged_Cable_Kickback', 'Glute_Kickback'],
  hip9090: ['x-hip-90-90'],
  pigeon: ['x-pigeon-stretch'],
  couch: ['x-couch-stretch'],
  openBook: ['x-open-book'],
  worlds: ['Worlds_Greatest_Stretch'],
  catCow: ['Cat_Stretch'],
  calfStretch: ['x-calf-stretch'],
  hamStretch: ['x-hamstring-stretch'],
  wallAngel: ['x-wall-angel'],
}
const pick = (slot: string) => PICK[slot].map((id) => BUILTIN_BY_ID.get(id)).find((e) => e && !e.retired && hasGear(e))

/**
 * The kinds of session, each different, so no day repeats another in the same week. Two at most are leg days (heavy
 * legs more often than that costs running); the rest strengthen without tiring the legs for the next run.
 */
export type SessionType = 'legsA' | 'legsB' | 'pull' | 'push' | 'core' | 'mobility'
export const SESSION_NAMES: Record<SessionType, string> = {
  legsA: 'Legs A · squat', legsB: 'Legs B · hinge', pull: 'Upper · pull & posture', push: 'Upper · push', core: 'Core & balance', mobility: 'Mobility',
}

/** Slots for each session, most important first; time decides how far down the list goes. */
const SLOTS: Record<Sport, Record<SessionType, string[]>> = {
  run: {
    legsA: ['plyoA', 'squat', 'single', 'calfBent', 'coreA', 'hamstring', 'pull'],
    legsB: ['plyoB', 'hinge', 'singleHinge', 'calfStraight', 'coreB', 'single', 'push'],
    pull: ['pullDown', 'pull', 'rearDelt', 'backExt', 'coreC', 'coreB'],
    push: ['bench', 'press', 'incline', 'lateral', 'coreA', 'hollow'],
    core: ['birdDog', 'coreA', 'balance', 'copenhagen', 'hollow', 'coreB', 'coreC'],
    mobility: ['hip9090', 'couch', 'pigeon', 'calfStretch', 'hamStretch', 'openBook', 'worlds', 'catCow'],
  },
  // Cyclists: heavy legs for pedalling economy, no impact work; back and core for the position on the bike.
  bike: {
    legsA: ['squat', 'single', 'hamstring', 'coreA', 'pull', 'calfBent', 'jump'],
    legsB: ['hinge', 'singleHinge', 'single', 'coreB', 'pull', 'push', 'calfStraight'],
    pull: ['pullDown', 'pull', 'rearDelt', 'backExt', 'coreC', 'coreB'],
    push: ['bench', 'press', 'incline', 'lateral', 'coreA', 'hollow'],
    core: ['birdDog', 'coreA', 'balance', 'copenhagen', 'hollow', 'coreB', 'coreC'],
    mobility: ['hip9090', 'couch', 'openBook', 'pigeon', 'hamStretch', 'worlds', 'catCow', 'calfStretch'],
  },
}

/** Things they can ask for more of: what each adds to which sessions, and the session it brings forward. */
export type Focus = 'posture' | 'balance' | 'core' | 'mobility' | 'chest' | 'back' | 'shoulders' | 'arms' | 'glutes'
export const FOCUS: { id: Focus; label: string }[] = [
  { id: 'posture', label: 'Posture' }, { id: 'balance', label: 'Balance' }, { id: 'core', label: 'Core' }, { id: 'mobility', label: 'Mobility' },
  { id: 'chest', label: 'Chest' }, { id: 'back', label: 'Back' }, { id: 'shoulders', label: 'Shoulders' }, { id: 'arms', label: 'Arms' }, { id: 'glutes', label: 'Glutes' },
]
const FOCUS_ADDS: Record<Focus, { session?: Exclude<SessionType, 'legsA' | 'legsB'>; adds: Partial<Record<SessionType, string[]>> }> = {
  posture: { session: 'pull', adds: { pull: ['ytw'], push: ['rearDelt'], legsB: ['backExt'], core: ['birdDog'], mobility: ['openBook', 'wallAngel'] } },
  balance: { session: 'core', adds: { legsA: ['balance'], legsB: ['balanceHinge'], core: ['balance', 'stepUp'] } },
  core: { session: 'core', adds: { legsA: ['hollow'], legsB: ['coreC'], pull: ['coreA'], push: ['coreC'] } },
  mobility: { session: 'mobility', adds: { legsA: ['hip9090'], legsB: ['hamStretch'], pull: ['openBook'], push: ['worlds'] } },
  chest: { session: 'push', adds: { push: ['fly', 'push'], pull: ['push'] } },
  back: { session: 'pull', adds: { pull: ['row2'], push: ['pull'] } },
  shoulders: { session: 'push', adds: { push: ['lateral', 'rearDelt'], pull: ['press'] } },
  arms: { session: 'pull', adds: { pull: ['curl', 'triceps'], push: ['triceps', 'curl'] } },
  glutes: { adds: { legsA: ['hipThrust'], legsB: ['kickback'], core: ['hipThrust'] } },
}

/** Days past the two leg days, in order: what they asked to focus on first, then the rest. */
export function extraOrder(focus: Focus[]): Exclude<SessionType, 'legsA' | 'legsB'>[] {
  const base = ['pull', 'push', 'core', 'mobility'] as const
  const first = focus.map((f) => FOCUS_ADDS[f].session).filter((x): x is (typeof base)[number] => !!x)
  return [...new Set([...first, ...base])]
}

/** A session's slots with the focus slots added, after the main lift(s) so a short session keeps them. */
function slotsFor(sport: Sport, type: SessionType, focus: Focus[]): string[] {
  const base = SLOTS[sport][type]
  const adds = focus.flatMap((f) => FOCUS_ADDS[f].adds[type] ?? [])
  const at = type === 'legsA' || type === 'legsB' ? (sport === 'run' ? 3 : 2) : type === 'mobility' || type === 'core' ? 0 : 2
  return [...new Set([...base.slice(0, at), ...adds, ...base.slice(at)])]
}

type Dose = { main: [number, number]; other: [number, number]; plyo: [number, number]; core: number; drop?: boolean }
/**
 * Sets × reps by phase. The first weeks of base get the body used to it (moderate weights, no jumps); then the main
 * lifts go heavy (about 5 reps, a couple short of failure) with hops before them; peak keeps the heavy lifts with less
 * of everything; cutback and taper weeks are lighter (the app aims for about 90% of last time).
 */
function dose(phase: WeekPhase, week: number, beginner: boolean): Dose {
  // New runners (Couch to 5K: no hard or long sessions) stay at moderate weights with no jumping: build the base first.
  if (beginner) return { main: [3, 10], other: [2, 12], plyo: [0, 0], core: 30, drop: phase === 'cutback' || phase === 'taper' }
  if (phase === 'base' && week < 3) return { main: [3, 10], other: [2, 12], plyo: [0, 0], core: 30 }
  if (phase === 'base' || phase === 'build') return { main: [4, 5], other: [3, 8], plyo: [3, 10], core: 40 }
  if (phase === 'peak') return { main: [3, 4], other: [2, 6], plyo: [2, 8], core: 30 }
  return { main: [2, 5], other: [2, 8], plyo: [2, 6], core: 30, drop: true } // cutback, taper
}

/** Items a session of `minutes` has room for: about 7 minutes a lift, 4 a stretch or core hold. */
const roomFor = (minutes: number, type: SessionType) =>
  type === 'mobility' || type === 'core' ? Math.max(4, Math.min(9, Math.round(minutes / 5))) : Math.max(3, Math.min(8, Math.round(minutes / 7.5)))

function session(sport: Sport, type: SessionType, phase: WeekPhase, week: number, minutes: number, beginner: boolean, focus: Focus[]): PlannedExercise[] {
  const d = dose(phase, week, beginner)
  const slots = slotsFor(sport, type, focus).filter((s) => !(s.startsWith('plyo') || s === 'jump') || d.plyo[0] > 0)
  const out: PlannedExercise[] = []
  const used = new Set<string>()
  for (const slot of slots) {
    if (out.length >= roomFor(minutes, type) - (d.drop ? 1 : 0)) break
    const e = pick(beginner && slot === 'hamstring' ? 'hamstringEasy' : slot)
    if (!e || used.has(e.id)) continue
    used.add(e.id)
    const main = slot === 'squat' || slot === 'hinge'
    const plyo = slot.startsWith('plyo') || slot === 'jump'
    const stretch = e.group === 'Mobility'
    const [sets, reps] = plyo ? d.plyo : main ? d.main : d.other
    const item: PlannedExercise = { exerciseId: e.id, sets: stretch ? 2 : sets, rest: plyo ? 60 : main ? 150 : 90 }
    if (stretch) { item.seconds = 45; item.rest = 15 }
    else if (e.mode === 'time') { item.seconds = d.core; item.rest = 45 }
    else item.reps = e.group === 'Core' || e.tags?.includes('posture') ? 10 : slot === 'hamstring' && e.mode === 'reps' ? Math.min(reps, 6) : reps
    if (main && d.main[1] <= 5) item.warmupSets = 2 // ramp up to the heavy sets
    if (d.drop && e.kind === 'strength' && !plyo && !stretch) item.deload = true
    out.push(item)
  }
  return out
}

export interface StrengthDay {
  date: string
  weekIndex: number
  phase: WeekPhase
  type: SessionType
  name: string
  after?: PlanSession['kind'] | 'rest'
  /** A day they picked that the plan would avoid: on the long run or race, or the day before a long run or hard session. */
  clash?: 'long' | 'race' | 'before-long' | 'before-hard' | 'before-race'
  items: PlannedExercise[]
}

/**
 * Strength days for a run/bike plan, from `from` on. Each week gets its phase's number of sessions (see sessionsFor),
 * every one different: the squat and hinge leg days, then upper pull, upper push, core and balance, mobility (what
 * they focus on first), the same pattern week to week so the lifts can progress. Leg days go on the best days (see
 * `score`), at least two days apart; or on the weekdays they pick (0 = Monday), which are kept even where the plan
 * would avoid them (marked `clash`), the best of them used in lighter weeks.
 */
export function strengthForPlan(input: { sessions: PlanSession[]; sport: Sport; from: string; perWeek: number; minutes: number; days?: number[]; focus?: Focus[] }): StrengthDay[] {
  const { sessions, sport, from, minutes } = input
  const focus = input.focus ?? []
  const extras = extraOrder(focus)
  const fixed = input.days?.length ? new Set(input.days) : null
  const perWeek = fixed ? fixed.size : input.perWeek
  const on = new Map(sessions.map((s) => [s.date, s]))
  const beginner = !sessions.some((s) => s.kind === 'hard' || s.kind === 'long')
  const weeks = [...new Set(sessions.map((s) => toISO(mondayOf(parseISO(s.date)))))].sort()
  const out: StrengthDay[] = []
  let turn = 0
  weeks.forEach((monday, w) => {
    const phase = sessions.find((s) => toISO(mondayOf(parseISO(s.date))) === monday)!.phase
    const want = sessionsFor(phase, perWeek)
    const dates = Array.from({ length: 7 }, (_, i) => toISO(addDays(parseISO(monday), i))).filter((d, i) => d >= from && (!fixed || fixed.has(i)))
    const next = (d: string) => on.get(toISO(addDays(parseISO(d), 1)))
    const prev = (d: string) => on.get(toISO(addDays(parseISO(d), -1)))
    // Never: the long run or race itself, or the day before a long run, hard session or race.
    // Best: after a hard session (hard days hard), then after an easy run, then a rest day; a day after the long run
    // is for recovering. In taper week, early in the week.
    const score = (d: string) => {
      const s = on.get(d), n = next(d)
      if (s?.kind === 'long' || s?.kind === 'race' || (n && n.kind !== 'easy')) return -Infinity
      let v = s?.kind === 'hard' ? 3 : s ? 2 : 1
      if (prev(d)?.kind === 'long') v -= 1.5
      if (phase === 'taper') v -= dates.indexOf(d) * 0.5
      return v
    }
    const clash = (d: string): StrengthDay['clash'] => {
      const s = on.get(d)?.kind, n = next(d)?.kind
      return s === 'long' || s === 'race' ? s : n === 'long' || n === 'race' ? `before-${n}` : n === 'hard' ? 'before-hard' : undefined
    }
    const gap = (a: string, b: string) => Math.abs(parseISO(a).getTime() - parseISO(b).getTime()) / 86400000
    const choose = (n: number, rate: (d: string) => number, spaced: boolean) => {
      const out: string[] = []
      for (const d of [...dates].sort((a, b) => rate(b) - rate(a) || a.localeCompare(b))) {
        if (out.length >= n || rate(d) === -Infinity) break
        if (!spaced || out.every((p) => gap(p, d) >= 2)) out.push(d)
      }
      return out
    }
    // Leg sessions (two at most): on the best days. Days they picked are theirs, even where the plan would avoid them
    // (never race day), the best of them used first.
    const rank = (d: string) => (fixed ? (score(d) === -Infinity ? (on.get(d)?.kind === 'race' ? -Infinity : -10) : score(d)) : score(d))
    // Two days apart where the days allow it (even among picked days: back-to-back leg days only if nothing else fits).
    let legs = choose(Math.min(want, 2), rank, true)
    if (fixed && legs.length < Math.min(want, 2)) legs = choose(Math.min(want, 2), rank, false)
    // More than two: sessions that don't tire the legs, each a different one, on other days (rest days best), not the
    // long run or race unless they picked it.
    const otherRate = (d: string) => {
      const k = on.get(d)?.kind
      if (legs.includes(d) || k === 'race' || (k === 'long' && !fixed)) return -Infinity
      return (k === 'long' ? 0 : k === 'hard' ? 1 : k ? 2 : 3) - (legs.some((l) => gap(l, d) <= 1) ? 0.5 : 0)
    }
    const others = choose(want - legs.length, otherRate, false).sort()
    const typeOf = new Map<string, SessionType>([
      // Both leg days: squat then hinge. One: they take turns week to week.
      ...legs.sort().map((d, i): [string, SessionType] => [d, legs.length === 2 ? (i === 0 ? 'legsA' : 'legsB') : turn++ % 2 === 0 ? 'legsA' : 'legsB']),
      ...others.map((d, i): [string, SessionType] => [d, extras[i % extras.length]]),
    ])
    for (const d of [...legs, ...others].sort()) {
      const type = typeOf.get(d)!
      const items = session(sport, type, phase, w, phase === 'taper' ? Math.min(minutes, 30) : minutes, beginner, focus)
      const c = type === 'legsA' || type === 'legsB' ? clash(d) : undefined
      out.push({ date: d, weekIndex: w, phase, type, name: SESSION_NAMES[type], after: on.get(d)?.kind ?? 'rest', ...(c ? { clash: c } : {}), items })
    }
  })
  return out
}
