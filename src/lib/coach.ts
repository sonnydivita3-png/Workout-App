import type { ExerciseLog, PlannedExercise, Program } from '../types'
import type { DayOptions, ProgramDay, ProgramGoal, ProgramInput, SetScheme } from './program'
import { generateProgram } from './program'
import { STYLE_MET, workoutCalories } from './calorieTarget'
import { addDays, parseISO, toISO } from './dates'
import { hasData, strengthSessions, epley } from './stats'
import type { Rng } from './randomUtil'

/**
 * Durata's trainer: a plan built around what someone wants to reach (lose 30 lb, bench 225, move without stiffness),
 * how long that should take, and a weekly check-in that adjusts the plan to what is really happening.
 *
 * Training only: the trainer plans and counts what workouts burn and build, never food. Its timelines say so, and the
 * check-ins correct them from real weigh-ins and lifts.
 */

export type Experience = 'new' | 'some' | 'experienced'
export type MoveFocus = 'posture' | 'mobility' | 'functional'

export type CoachGoal =
  /** Lose this many pounds. */
  | { kind: 'lose'; lb: number }
  /** Build muscle, optionally a number of pounds of it, in particular areas. */
  | { kind: 'muscle'; lb?: number | null; areas: string[] }
  /** Reach an estimated one-rep max on a lift, from where it is at the start. */
  | { kind: 'strength'; exerciseId: string; targetLb: number; startLb: number }
  /** Move better: posture, mobility, functional strength. */
  | { kind: 'move'; focus: MoveFocus[] }

export type GoalKind = CoachGoal['kind']

export const GOAL_KINDS: { kind: GoalKind; label: string; blurb: string }[] = [
  { kind: 'lose', label: 'Lose weight', blurb: 'Burn more with lifting to keep muscle and cardio for the burn.' },
  { kind: 'muscle', label: 'Build muscle', blurb: 'More size, in the areas you pick.' },
  { kind: 'strength', label: 'Get stronger', blurb: 'Hit a number on a lift, like a 225 lb bench.' },
  { kind: 'move', label: 'Move better', blurb: 'Posture, mobility and everyday strength.' },
]

export const EXPERIENCE: { id: Experience; label: string; blurb: string }[] = [
  { id: 'new', label: 'New to training', blurb: 'Less than a year of regular lifting, or a long break.' },
  { id: 'some', label: 'Some experience', blurb: 'One to three years of fairly regular training.' },
  { id: 'experienced', label: 'Experienced', blurb: 'Three years or more, training most weeks.' },
]

export const MOVE_FOCUS: { id: MoveFocus; label: string; blurb: string }[] = [
  { id: 'posture', label: 'Posture', blurb: 'Upper back, shoulders and core: undo the desk and the phone.' },
  { id: 'mobility', label: 'Mobility', blurb: 'Hips, ankles and upper back that move through their full range.' },
  { id: 'functional', label: 'Functional strength', blurb: 'Carrying, lifting, squatting and stepping, strong and steady.' },
]

/** Lifts a strength goal can be set on (the classic ones a coach tests). */
export const TEST_LIFTS: { id: string; label: string }[] = [
  { id: 'Barbell_Bench_Press_-_Medium_Grip', label: 'Bench press' },
  { id: 'Barbell_Squat', label: 'Back squat' },
  { id: 'Barbell_Deadlift', label: 'Deadlift' },
  { id: 'Standing_Military_Press', label: 'Overhead press' },
]

export interface CoachAnswers {
  /** In order of priority: the first one leads the plan. */
  goals: CoachGoal[]
  experience: Experience
  /** Weekdays to train, 0 = Monday. */
  days: number[]
  /** Minutes a session. */
  minutes: number
  /** Body parts to give extra work (from a muscle goal, or picked on their own). */
  areas: string[]
  /** Bodyweight at the start, lb. */
  startLb: number | null
}

/** How the check-ins have changed the plan so far. */
export interface CoachAdjust {
  /** Extra minutes a session (more burn when fat loss is slow), 0 to 20. */
  minutes: number
  /** -1: a lighter week (recovering); 0: the usual block; 1: a set more each week (going well). */
  volume: -1 | 0 | 1
}

export interface CheckIn {
  date: string
  weightLb?: number | null
  /** Best working set on the strength goal's lift this week. */
  lift?: { weight: number; reps: number } | null
  /** How moving feels, 1 (stiff, sore) to 5 (great). */
  moveScore?: number | null
  /** 1 (drained) to 5 (great). */
  energy: number
  /** 1 (fresh) to 5 (very sore). */
  soreness: number
  done: number
  planned: number
  /** What the trainer changed (or kept) and why, in plain words. */
  notes: string[]
}

export interface CoachPlan {
  id: string
  createdAt: string
  startDate: string
  answers: CoachAnswers
  /** Weeks the plan expects to take, from the start (updated by check-ins). */
  weeks: number
  /** The lifting plan on the calendar now. */
  programId?: string
  /** Last day of the 4-week block on the calendar. */
  blockEnd: string
  adjust: CoachAdjust
  checkins: CheckIn[]
}

const LB_PER_KCAL = 1 / 3500
const WEEKS_PER_MONTH = 4.345
/** Muscle a month as a share of bodyweight, by training age (natural lifters; rough coaching guidelines). */
const MUSCLE_RATE: Record<Experience, number> = { new: 0.01, some: 0.006, experienced: 0.003 }
/** Estimated 1RM growth a month, by training age. */
const STRENGTH_RATE: Record<Experience, number> = { new: 0.04, some: 0.02, experienced: 0.01 }
/** Losing more than about 1% of bodyweight a week costs muscle: the plan never counts on more. */
const MAX_LOSS = 0.01
/** Posture and mobility changes show in about 6 to 8 weeks of regular work. */
const MOVE_WEEKS = 8
/** A muscle goal without a number: a first block long enough to see it. */
const MUSCLE_WEEKS = 12
const MAX_WEEKS = 104

/** Each kind of goal as the planner's goal: losing weight trains like fat loss, moving better like mobility. */
const PROGRAM_GOAL: Record<GoalKind, ProgramGoal> = { lose: 'fatloss', muscle: 'muscle', strength: 'strength', move: 'mobility' }
export const programGoals = (goals: CoachGoal[]): ProgramGoal[] => [...new Set(goals.map((g) => PROGRAM_GOAL[g.kind]))]

export interface GoalEstimate {
  goal: CoachGoal
  /** Weeks it should take, or null when training alone won't get there in two years. */
  weeks: number | null
  /** The rate it counts on, in plain words ("about 0.6 lb a week"). */
  rate: string
}

/** Weeks for a strength goal from an estimated 1RM, at the experience level's monthly gain. */
export function strengthWeeks(start: number, target: number, exp: Experience): number {
  if (start <= 0 || target <= start) return 4
  return Math.ceil((Math.log(target / start) / Math.log(1 + STRENGTH_RATE[exp])) * WEEKS_PER_MONTH)
}

/**
 * How long each goal should take, from the plan's weekly burn (active calories its workouts burn, at their weight) and
 * their experience. Fat loss counts training alone, no faster than 1% of bodyweight a week.
 */
export function estimate(a: CoachAnswers, weeklyBurn: number, lossRate?: number | null): GoalEstimate[] {
  const lb = a.startLb ?? 0
  return a.goals.map((goal): GoalEstimate => {
    switch (goal.kind) {
      case 'lose': {
        // A measured rate (from weigh-ins) replaces the prediction once there is one.
        const predicted = Math.min(weeklyBurn * LB_PER_KCAL, lb ? lb * MAX_LOSS : Infinity)
        const perWeek = lossRate != null && lossRate > 0 ? lossRate : predicted
        const weeks = perWeek > 0 ? Math.ceil(goal.lb / perWeek) : Infinity
        return { goal, weeks: weeks <= MAX_WEEKS ? weeks : null, rate: `about ${round1(perWeek)} lb a week${lossRate != null && lossRate > 0 ? ', as your weigh-ins show' : ' from training'}` }
      }
      case 'muscle': {
        const perMonth = lb * MUSCLE_RATE[a.experience]
        if (!goal.lb || !perMonth) return { goal, weeks: MUSCLE_WEEKS, rate: 'visible changes in about 8 to 12 weeks' }
        const weeks = Math.ceil((goal.lb / perMonth) * WEEKS_PER_MONTH)
        return { goal, weeks: Math.min(weeks, MAX_WEEKS), rate: `about ${round1(perMonth)} lb of muscle a month` }
      }
      case 'strength':
        return { goal, weeks: strengthWeeks(goal.startLb, goal.targetLb, a.experience), rate: `about ${Math.round(STRENGTH_RATE[a.experience] * 100)}% stronger a month` }
      case 'move':
        return { goal, weeks: MOVE_WEEKS, rate: 'noticeable in 6 to 8 weeks' }
    }
  })
}

/** The plan's length: its longest goal, in whole 4-week blocks (at least one, two years at most). */
export function planWeeks(est: GoalEstimate[]): number {
  const longest = Math.max(4, ...est.map((e) => e.weeks ?? MAX_WEEKS))
  return Math.min(MAX_WEEKS, Math.ceil(longest / 4) * 4)
}

/** The planner's options for the trainer's plan: goals, focus areas, session length and how sets build. */
export function programInput(a: CoachAnswers, adjust: CoachAdjust): Pick<ProgramInput, 'trainWeekdays' | 'goal' | 'minutes' | 'emphasis' | 'sets' | 'deload' | 'reps'> {
  const sets: SetScheme = adjust.volume < 0 ? 'flat' : adjust.volume > 0 ? 'weekly' : 'week3'
  const strengthOnly = a.goals.length === 1 && a.goals[0].kind === 'strength'
  return {
    trainWeekdays: a.days, goal: programGoals(a.goals), minutes: a.minutes + adjust.minutes, emphasis: a.areas, sets, deload: true,
    // A strength goal on its own trains heavy; mixed with others, each session's style decides.
    reps: strengthOnly ? 'heavy' : 'auto',
  }
}

/** A block of the plan (four weeks from `anchorMonday`, skipping dates before `fromDate`). */
export function buildBlock(a: CoachAnswers, adjust: CoachAdjust, anchorMonday: string, fromDate: string, options: DayOptions & Partial<ProgramInput>, rng?: Rng): ProgramDay[] {
  return generateProgram({ ...options, ...programInput(a, adjust), anchorMonday, weeks: 4, fromDate, rng })
}

/**
 * Active calories a week of the plan burns: its training days' workouts on average (at their weight), times the days a
 * week they train. (An average, so a plan that starts midweek isn't counted short.)
 */
export function weekBurn(days: { items: PlannedExercise[]; rest?: boolean }[], rate: (met: number) => number, perWeek: number): number {
  const mets = { lift: STYLE_MET.standard, cond: STYLE_MET.circuit, cardioFactor: 1 }
  const training = days.filter((d) => !d.rest && d.items.length)
  if (!training.length) return 0
  return (training.reduce((a, d) => a + workoutCalories(d.items, rate, mets), 0) / training.length) * perWeek
}

/** Estimated 1RM from a set (reps past 12 count as 12, as everywhere in the app). */
export const e1rmOf = (s: { weight: number; reps: number }) => Math.round(epley(s.weight, Math.min(s.reps, 12)))

/** Their best estimated 1RM on a lift since a date (null without a logged working set). */
export function bestLiftSince(logs: ExerciseLog[], exerciseId: string, since: string): number | null {
  const s = strengthSessions(logs, exerciseId).filter((x) => x.date >= since)
  return s.length ? Math.round(Math.max(...s.map((x) => x.e1rm))) : null
}

/**
 * Training days the plan had in a date range, and how many of them had something logged. The last day (today) counts
 * only once it's logged: a session still ahead later today isn't a missed one.
 */
export function sessionsIn(program: Program | undefined, logs: ExerciseLog[], from: string, to: string): { planned: number; done: number } {
  const logged = new Set(logs.filter((l) => l.date >= from && l.date <= to && hasData(l)).map((l) => l.date))
  const days = (program?.entries ?? []).filter((e) => e.date >= from && e.date <= to && (e.exerciseIds?.length ?? 1) > 0 && (e.date < to || logged.has(e.date))).map((e) => e.date)
  return { planned: days.length, done: days.filter((d) => logged.has(d)).length }
}

/** When the next check-in is due: a week after the last one (or the start). */
export function nextCheckIn(plan: CoachPlan): string {
  const last = plan.checkins.at(-1)?.date ?? plan.startDate
  return toISO(addDays(parseISO(last), 7))
}
export const checkInDue = (plan: CoachPlan, today: string) => today >= nextCheckIn(plan)

/** Pounds a week lost (positive) or gained (negative) between the first weigh-in and the last, null with too little. */
export function weightTrend(points: { date: string; lb: number }[]): number | null {
  const pts = [...points].sort((a, b) => a.date.localeCompare(b.date))
  if (pts.length < 2) return null
  const days = (parseISO(pts.at(-1)!.date).getTime() - parseISO(pts[0].date).getTime()) / 86400000
  if (days < 10) return null
  // Least-squares slope, so one heavy or light morning doesn't swing it.
  const xs = pts.map((p) => (parseISO(p.date).getTime() - parseISO(pts[0].date).getTime()) / 86400000)
  const mx = xs.reduce((a, x) => a + x, 0) / xs.length
  const my = pts.reduce((a, p) => a + p.lb, 0) / pts.length
  const num = xs.reduce((a, x, i) => a + (x - mx) * (pts[i].lb - my), 0)
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  return den ? -(num / den) * 7 : null
}

export interface Review {
  adjust: CoachAdjust
  notes: string[]
  /** Weeks left for each goal after this check-in (null: not on track to get there with training alone). */
  estimates: GoalEstimate[]
  /** Whether the next weeks should be rebuilt (the plan changed). */
  rebuild: boolean
}

/**
 * The weekly check-in, as a coach would run it: recovery first, then whether the sessions happened, then each goal
 * against where it should be. Changes are small, one at a time, and always said with the reason.
 */
export function review(plan: CoachPlan, c: Omit<CheckIn, 'notes'>, ctx: { weights: { date: string; lb: number }[]; weeklyBurn: number; liftNow?: number | null }): Review {
  const a = plan.answers
  const notes: string[] = []
  let { minutes, volume } = plan.adjust
  const adherence = c.planned ? c.done / c.planned : 1
  const weeksIn = Math.max(1, Math.round((parseISO(c.date).getTime() - parseISO(plan.startDate).getTime()) / (7 * 86400000)))
  const prev = plan.checkins.at(-1)

  // 1. Recovery: progress comes from recovering from training, not from the training alone.
  const worn = c.soreness >= 4 || c.energy <= 2
  if (worn) {
    if (volume !== -1) notes.push('You’re worn down, so this week is lighter: a set fewer on the main lifts. Sleep and rest are where the work turns into results.')
    else notes.push('Still worn down: another lighter week. If that lasts, sleep, stress or food may be short, and a few easy days beat pushing through.')
    volume = -1
  } else if (volume === -1) {
    notes.push('You’ve recovered, so the usual training is back.')
    volume = 0
  } else if (!worn && c.energy >= 4 && c.soreness <= 2 && adherence >= 0.9 && prev && prev.energy >= 4 && prev.soreness <= 2 && volume === 0) {
    notes.push('Two strong weeks in a row: the main lifts now get a set more each week.')
    volume = 1
  }

  // 2. Did the plan happen? Missed sessions aren't fixed by a harder plan.
  if (c.planned > 0 && adherence < 0.6) {
    notes.push(`You got ${c.done} of ${c.planned} sessions in. The plan stays as it is: a schedule you keep beats a bigger one you don’t. If these days don’t fit your week, change them in a new plan.`)
  }

  // 3. Each goal.
  const lossRate = weightTrend(ctx.weights)
  for (const g of a.goals) {
    if (g.kind === 'lose') {
      const expected = Math.min(ctx.weeklyBurn * LB_PER_KCAL, (a.startLb ?? Infinity) * MAX_LOSS)
      if (lossRate == null) notes.push('Weigh in at least weekly, same time of day: after about two weeks the timeline uses your real trend.')
      else if (a.startLb && lossRate > a.startLb * MAX_LOSS) notes.push(`You’re losing about ${round1(lossRate)} lb a week, more than 1% of your weight. That fast, some of it is muscle: eating enough (protein especially) and keeping the lifting protects it.`)
      else if (lossRate < expected * 0.5 && weeksIn >= 2) {
        if (adherence >= 0.8 && !worn && minutes < 20) {
          minutes = Math.min(20, minutes + 10)
          notes.push(`Weight is coming off slower than your training should burn (about ${round1(Math.max(0, lossRate))} of ${round1(expected)} lb a week). Each session gets 10 more minutes, mostly cardio. Food is the bigger lever: eating a little less does more than any extra workout.`)
        } else if (lossRate <= 0) notes.push('Your weight isn’t moving yet. Training alone only goes so far: what you eat decides most of it.')
        else notes.push(`About ${round1(lossRate)} lb a week so far, slower than planned. The timeline now follows your real trend.`)
      } else notes.push(`About ${round1(lossRate)} lb a week: on track.`)
    }
    if (g.kind === 'muscle') {
      if (lossRate != null && lossRate > 0.2 && !a.goals.some((x) => x.kind === 'lose')) notes.push('Your weight is going down. Building muscle needs eating a little more than you burn; the training is doing its part.')
      else if (lossRate != null && g.lb) notes.push(lossRate < -0.75 ? 'You’re gaining faster than muscle grows (more than about 3 lb a month), so some of it is fat.' : 'Weight is moving the right way for muscle.')
    }
    if (g.kind === 'strength') {
      const now = ctx.liftNow ?? (c.lift ? e1rmOf(c.lift) : null)
      if (now == null) notes.push('No working sets on your test lift this week. Log it with weight and reps so the trainer can track it.')
      else {
        const expected = g.startLb * (1 + STRENGTH_RATE[a.experience]) ** (weeksIn / WEEKS_PER_MONTH)
        const best = Math.max(now, ...plan.checkins.map((x) => (x.lift ? e1rmOf(x.lift) : 0)))
        // Stuck: three check-ins with the lift and no new best since (within 1%).
        const last3 = plan.checkins.slice(-3).filter((x) => x.lift)
        const stalled = last3.length === 3 && now <= Math.max(...last3.map((x) => e1rmOf(x.lift!))) * 1.01
        if (now >= g.targetLb) notes.push(`Estimated max ${now} lb: you’ve reached ${g.targetLb}. Test a true single with a spotter when you feel fresh.`)
        else if (stalled && volume !== -1) {
          volume = -1
          notes.push(`Your estimated max has been stuck around ${now} lb for three weeks. A lighter week now lets it climb again.`)
        } else notes.push(now >= expected * 0.97 ? `Estimated max ${now} lb (best ${best}): on track for ${g.targetLb}.` : `Estimated max ${now} lb, a little behind the plan. Keep the reps clean and the rest between sets full.`)
      }
    }
    if (g.kind === 'move' && c.moveScore != null) {
      const before = plan.checkins.filter((x) => x.moveScore != null).at(-1)?.moveScore
      if (before != null && c.moveScore > before) notes.push('Moving better than last week: keep it up.')
      else if (c.moveScore <= 2) notes.push('Still stiff: do the warm-up’s mobility moves on rest days too, 5 minutes is enough. Pain that’s sharp or lasting is one for a physio.')
    }
  }

  const adjust: CoachAdjust = { minutes, volume: volume as CoachAdjust['volume'] }
  const changed = adjust.minutes !== plan.adjust.minutes || adjust.volume !== plan.adjust.volume
  if (!changed && notes.length === 0) notes.push('All on track. Same plan, keep going.')
  // Goals still to reach, from now (strength from today's estimated max).
  const remaining: CoachAnswers = {
    ...a,
    startLb: ctx.weights.at(-1)?.lb ?? a.startLb,
    goals: a.goals.map((g) => {
      if (g.kind === 'lose' && a.startLb && ctx.weights.length) return { ...g, lb: Math.max(0, g.lb - (a.startLb - ctx.weights.at(-1)!.lb)) }
      if (g.kind === 'strength' && (ctx.liftNow ?? c.lift)) return { ...g, startLb: ctx.liftNow ?? e1rmOf(c.lift!) }
      return g
    }),
  }
  return { adjust, notes, estimates: estimate(remaining, ctx.weeklyBurn * (1 + adjust.minutes / Math.max(1, a.minutes)), lossRate), rebuild: changed }
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** A saved plan as read back: anything damaged makes it no plan, rather than a broken screen. */
export function cleanCoach(x: unknown): CoachPlan | null {
  if (!x || typeof x !== 'object') return null
  const p = x as Partial<CoachPlan>
  const a = p.answers
  if (typeof p.id !== 'string' || typeof p.startDate !== 'string' || !a || !Array.isArray(a.goals) || !Array.isArray(a.days)) return null
  const goals = a.goals.filter((g): g is CoachGoal => !!g && typeof g === 'object' && ['lose', 'muscle', 'strength', 'move'].includes((g as CoachGoal).kind))
  if (!goals.length) return null
  return {
    ...p,
    answers: { ...a, goals, areas: Array.isArray(a.areas) ? a.areas : [] },
    weeks: typeof p.weeks === 'number' ? p.weeks : 12,
    blockEnd: typeof p.blockEnd === 'string' ? p.blockEnd : p.startDate,
    adjust: { minutes: Number(p.adjust?.minutes) || 0, volume: p.adjust?.volume === -1 || p.adjust?.volume === 1 ? p.adjust.volume : 0 },
    checkins: Array.isArray(p.checkins) ? p.checkins : [],
  } as CoachPlan
}

/**
 * How weight change works, said plainly wherever the trainer gives a timeline for losing or gaining weight.
 */
export const WEIGHT_DISCLAIMER = [
  'Your weight follows the balance of what you eat and what you burn, and for most people food is the bigger side. An hour of hard training burns roughly 400–700 calories; one big meal can cancel that.',
  'Durata’s trainer plans and counts the training side only. It doesn’t track food, so its timeline assumes you keep eating as you do now. Weekly check-ins correct it from what your scale really shows.',
  'Your body also adapts as you lose weight, so progress slows over time. For a faster or surer result, pair this plan with advice from a registered dietitian or your doctor.',
]
