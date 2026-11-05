import { addDays, mondayOf, parseISO, toISO } from '../lib/dates'
import { lastDropGroups } from '../lib/plan'
import { familiarLifts, liftsToRotate, majorGroupsLogged, type ProgramDay } from '../lib/program'
import { activePrograms } from '../lib/programs'
import { defaultWarmup } from '../lib/randomizer'
import { withGearFor } from '../lib/equipment'
import { perMuscleOf } from '../lib/volumePrefs'
import { bodyweightOn, restingPerHour } from '../lib/calories'
import { perMinute } from '../lib/calorieTarget'
import { buildBlock, GOAL_KINDS, MOVE_FOCUS, TEST_LIFTS, weekBurn, type CoachAdjust, type CoachAnswers, type CoachGoal, type GoalKind } from '../lib/coach'
import { showWeight } from '../lib/units'
import { findExercise, useStore } from '../store'
import type { PlanOverrides } from '../types'

type State = ReturnType<typeof useStore.getState>

/**
 * The trainer's next four weeks, built like any week/month plan (their warm-up and rest settings, equipment, liked
 * styles, the lifts they've been doing), from `fromDate`. Also what a week of it burns, for the timeline.
 */
export function buildCoachBlock(s: State, a: CoachAnswers, adjust: CoachAdjust, fromDate: string): { days: ProgramDay[]; overrides: PlanOverrides; blockEnd: string; weeklyBurn: number } {
  const anchorMonday = toISO(mondayOf(parseISO(fromDate)))
  const lookup = (id: string) => findExercise(s.custom, id)
  const familiar = familiarLifts(s.logs, fromDate)
  const prev = toISO(addDays(parseISO(fromDate), -1))
  const blockEnd = toISO(addDays(parseISO(anchorMonday), 27))
  // A run/bike plan during these weeks is their cardio: no cardio days of the trainer's own on top.
  const runs = activePrograms(s.programs, fromDate).filter((p) => p.kind === 'cardio').some((p) => p.entries.some((e) => e.date >= fromDate && e.date <= blockEnd))
  const days = withGearFor(s.equipment, () => buildBlock(a, adjust, anchorMonday, fromDate, {
    warmup: defaultWarmup(s.genPrefs.warmup, true, s.genPrefs.warmMinutes), rest: s.genPrefs.rest, dropSets: !!s.genPrefs.drops,
    perMuscle: perMuscleOf(s.trainingPrefs.perMuscle), capVolume: true, likedStyles: s.trainingPrefs.styles, setTarget: s.trainingPrefs.setTarget,
    familiar, rotate: liftsToRotate(s.logs, fromDate, lookup), prevDayGroups: majorGroupsLogged(s.logs, prev, lookup),
    prevDropGroups: lastDropGroups(s.plan, s.overrides, s.logs, fromDate, lookup), noCardio: runs,
  }))
  const lb = bodyweightOn(s.bodyweight, fromDate) ?? a.startLb
  const total = s.trainingPrefs.calorieCount === 'total'
  const rate = (met: number) => (lb ? perMinute(met, lb, fromDate, s.aboutMe) + (total ? restingPerHour(lb, fromDate, s.aboutMe) / 60 : 0) : 0)
  return { days, overrides: Object.fromEntries(days.map((d) => [d.date, d.items])), blockEnd, weeklyBurn: weekBurn(days, rate, a.days.length) }
}

/** The title the trainer's plan has on the calendar ("Trainer: Lose weight + Move better"). */
export const coachTitle = (a: CoachAnswers, labels: Record<string, string>) => `Trainer: ${a.goals.map((g) => labels[g.kind]).join(' + ')}`

export const GOAL_LABEL: Record<GoalKind, string> = Object.fromEntries(GOAL_KINDS.map((g) => [g.kind, g.label])) as Record<GoalKind, string>

/** A goal in a few words ("Lose 30 lb", "Bench press 225 lb", "Move better: posture"). */
export function goalText(g: CoachGoal, units: { weight: 'lb' | 'kg' }): string {
  const w = (lb: number) => `${Math.round(showWeight(lb, { weight: units.weight, distance: 'mi' })!)} ${units.weight}`
  switch (g.kind) {
    case 'lose': return `Lose ${w(g.lb)}`
    case 'muscle': return g.lb ? `Build ${w(g.lb)} of muscle` : `Build muscle${g.areas.length ? `: ${g.areas.join(', ').toLowerCase()}` : ''}`
    case 'strength': return `${TEST_LIFTS.find((l) => l.id === g.exerciseId)?.label ?? 'Lift'} ${w(g.targetLb)}`
    case 'move': return `Move better${g.focus.length ? `: ${g.focus.map((f) => MOVE_FOCUS.find((m) => m.id === f)!.label.toLowerCase()).join(', ')}` : ''}`
  }
}

/** What a week of the trainer's plan on the calendar burns (its days as they are now). */
export function planBurn(s: State, plan: { programId?: string; answers: CoachAnswers }, today: string): number {
  const p = s.programs.find((x) => x.id === plan.programId)
  const days = (p?.entries ?? []).map((e) => ({ items: s.overrides[e.date] ?? [], rest: (e.exerciseIds?.length ?? 1) === 0 }))
  const lb = bodyweightOn(s.bodyweight, today) ?? plan.answers.startLb
  const total = s.trainingPrefs.calorieCount === 'total'
  const rate = (met: number) => (lb ? perMinute(met, lb, today, s.aboutMe) + (total ? restingPerHour(lb, today, s.aboutMe) / 60 : 0) : 0)
  return weekBurn(days, rate, plan.answers.days.length)
}

/** A finish date in words, with the year when it isn't this year ("Feb 24, 2028"). */
export function finishText(iso: string, today: string): string {
  const d = new Date(`${iso}T12:00:00`)
  const sameYear = iso.slice(0, 4) === today.slice(0, 4)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? { weekday: 'short' } : { year: 'numeric' }) })
}
