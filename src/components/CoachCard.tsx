import { useState } from 'react'
import { addDays, fmtLong, parseISO, toISO } from '../lib/dates'
import { bodyweightOn } from '../lib/calories'
import { bestLiftSince, checkInDue, nextCheckIn, type CoachGoal, type CoachPlan } from '../lib/coach'
import { showWeight } from '../lib/units'
import { useToday } from '../lib/useToday'
import { useStore } from '../store'
import { CheckInSheet } from './CheckInSheet'
import { CoachSheet } from './CoachSheet'
import { finishText, goalText } from './coachBuild'
import { primaryBtn, secondaryBtn } from './Sheet'

/** How far along a goal is, in a few words ("12 of 30 lb lost", "est. max 205 lb"). */
function progressOf(g: CoachGoal, plan: CoachPlan, s: ReturnType<typeof useStore.getState>, today: string): string | null {
  const w = (lb: number) => `${Math.round(showWeight(lb, s.units)! * 10) / 10} ${s.units.weight}`
  const now = bodyweightOn(s.bodyweight, today)
  const start = plan.answers.startLb
  switch (g.kind) {
    case 'lose': return start && now ? `${w(Math.max(0, start - now))} of ${w(g.lb)} lost` : null
    case 'muscle': return start && now && now !== start ? `${now > start ? '+' : '−'}${w(Math.abs(now - start))} bodyweight` : null
    case 'strength': { const best = bestLiftSince(s.logs, g.exerciseId, plan.startDate); return best ? `est. max ${w(best)}` : `started at ${w(g.startLb)}` }
    case 'move': { const m = plan.checkins.filter((c) => c.moveScore != null).at(-1)?.moveScore; return m ? `moving: ${m} of 5` : null }
  }
}

/**
 * Home's trainer card: an invitation to reach a goal with Durata's trainer, or, on a plan, each goal's progress, the
 * week it's on and the projected finish, the last check-in's note, and the weekly check-in when it's due.
 */
export function CoachCard() {
  const s = useStore()
  const today = useToday()
  const [open, setOpen] = useState<'setup' | 'checkin' | null>(null)
  const plan = s.coach

  const sheet = open === 'setup' ? <CoachSheet onClose={() => setOpen(null)} /> : open === 'checkin' && plan ? <CheckInSheet onClose={() => setOpen(null)} /> : null
  if (!plan) {
    return (
      <section aria-labelledby="coach-title" className="rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-neutral-200/70">
        <h2 id="coach-title" className="text-lg font-semibold">Reach a goal with your trainer</h2>
        <p className="mb-4 text-sm text-neutral-600">Lose weight, build muscle, hit a number or move better, or several at once. A plan that runs as long as it takes, adjusted every week.</p>
        <button onClick={() => setOpen('setup')} className={primaryBtn}>Build my plan</button>
        {sheet}
      </section>
    )
  }
  const week = Math.floor((parseISO(today).getTime() - parseISO(plan.startDate).getTime()) / (7 * 86400000)) + 1
  const end = toISO(addDays(parseISO(plan.startDate), plan.weeks * 7))
  const due = checkInDue(plan, today)
  const note = plan.checkins.at(-1)?.notes[0]
  const stop = () => { if (confirm('Stop your trainer plan? Its upcoming workouts come off your calendar; everything you logged stays.')) s.stopCoach(today) }
  return (
    <section aria-labelledby="coach-title" className="rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-neutral-200/70">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="coach-title" className="text-lg font-semibold">Your trainer</h2>
        <p className="shrink-0 text-sm text-neutral-500">Week {Math.min(week, plan.weeks)} of {plan.weeks}</p>
      </div>
      <ul className="mb-3 space-y-1.5">
        {plan.answers.goals.map((g) => {
          const p = progressOf(g, plan, s, today)
          return <li key={g.kind} className="flex items-baseline justify-between gap-3"><span className="min-w-0">{goalText(g, s.units)}</span>{p && <span className="shrink-0 text-sm text-neutral-500">{p}</span>}</li>
        })}
      </ul>
      <p className="mb-3 text-sm text-neutral-500">Projected finish: {finishText(end, today)}{plan.checkins.length ? '' : ', updated at each check-in'}.</p>
      {note && <p className="mb-4 rounded-2xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">“{note}”</p>}
      {due ? <button onClick={() => setOpen('checkin')} className={primaryBtn}>Weekly check-in</button>
        : <p className="mb-1 text-sm text-neutral-600">Next check-in {fmtLong(nextCheckIn(plan))}.</p>}
      <div className="mt-2 flex gap-2">
        {!due && <button onClick={() => setOpen('checkin')} className={`${secondaryBtn} flex-1`}>Check in early</button>}
        <button onClick={stop} className={`${secondaryBtn} flex-1`}>Stop plan</button>
      </div>
      {sheet}
    </section>
  )
}
