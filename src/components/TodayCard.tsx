import { useState } from 'react'
import { addDays, fmtLong, parseISO, toISO } from '../lib/dates'
import { dayPlanOf, isRestDay, lastWorkout, repeatPlan, workItems } from '../lib/plan'
import { minutesFor } from '../lib/randomizer'
import { hasData } from '../lib/stats'
import { useToday } from '../lib/useToday'
import { findExercise, selectLastLog, useStore } from '../store'
import { RandomizerSheet } from './RandomizerSheet'
import type { Tab } from './TabBar'

const big = 'w-full rounded-2xl bg-accent py-3.5 text-base font-semibold text-on-accent'
const option = 'flex w-full items-center justify-between gap-3 rounded-2xl bg-neutral-100 px-4 py-3 text-left'

/**
 * The first thing on Home: today's workout with one big Start button (it opens the workout to tick off, no clock),
 * or, with nothing planned, three quick ways to train anyway (repeat the last workout, make one, or add exercises).
 */
export function TodayCard({ onNavigate }: { onNavigate: (t: Tab, part?: string) => void }) {
  const s = useStore()
  const today = useToday()
  const [randomize, setRandomize] = useState(false)
  const lookup = (id: string) => findExercise(s.custom, id)

  const planned = workItems(dayPlanOf(s.plan, s.overrides, today))
  const done = new Set(s.logs.filter((l) => l.date === today && hasData(l)).map((l) => l.exerciseId))
  const upcoming = planned.filter((p) => !done.has(p.exerciseId))
  const rest = isRestDay(s.overrides, today)
  const previous = lastWorkout(s.logs, s.overrides, toISO(addDays(parseISO(today), -1)))
  const repeatItems = previous ? repeatPlan(previous.logs, lookup) : []
  const minutes = Math.round(minutesFor(dayPlanOf(s.plan, s.overrides, today)))

  const start = () => onNavigate('plan')
  const repeat = () => { s.addPlanned(today, repeatItems); start() }

  let body: React.ReactNode
  if (planned.length > 0 && (upcoming.length === 0 || s.finishedDays.includes(today))) {
    body = (
      <>
        <p className="text-lg font-semibold">Done for today ✓</p>
        <p className="mb-3 text-sm text-neutral-500">{upcoming.length === 0 ? `All ${planned.length} exercise${planned.length === 1 ? '' : 's'} logged.` : `${planned.length - upcoming.length} of ${planned.length} exercises logged.`} Nice work.</p>
        <button onClick={start} className="rounded-full bg-neutral-100 px-4 py-1.5 text-sm text-neutral-600">Add more</button>
      </>
    )
  } else if (planned.length > 0) {
    body = (
      <>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className="text-lg font-semibold">Today’s workout</p>
          <p className="shrink-0 text-sm text-neutral-400">{planned.length} exercise{planned.length === 1 ? '' : 's'}{minutes > 0 ? ` · ~${minutes} min` : ''}</p>
        </div>
        <ul className="mb-4 space-y-2">
          {upcoming.slice(0, 5).map((p) => {
            const ex = lookup(p.exerciseId)
            if (!ex) return null
            const last = selectLastLog(s.logs, ex.id, today)
            const target = ex.kind === 'strength' ? (p.seconds ? `${p.sets} × ${p.seconds}s` : p.reps ? `${p.sets} × ${p.reps}` : `${p.sets} sets`) : p.minutes ? `${p.minutes} min` : ''
            return (
              <li key={ex.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 line-clamp-2">{ex.name}</span>
                <span className="shrink-0 text-sm tabular-nums text-neutral-400">{target}{last && hasData(last) ? ' · beat last' : ''}</span>
              </li>
            )
          })}
          {upcoming.length > 5 && <li className="text-sm text-neutral-400">+{upcoming.length - 5} more</li>}
        </ul>
        <button onClick={start} className={big}>Start workout</button>
      </>
    )
  } else {
    body = (
      <>
        <p className="text-lg font-semibold">{rest ? 'Rest day' : 'Nothing planned today'}</p>
        <p className="mb-3 text-sm text-neutral-500">{rest ? 'Recovery is part of the plan. Feel like training anyway?' : 'Pick a way to train:'}</p>
        <div className="space-y-2">
          {repeatItems.length > 0 && previous && (
            <button onClick={repeat} className={option}>
              <span className="min-w-0">
                <span className="block font-medium">Repeat last workout</span>
                <span className="block truncate text-sm text-neutral-500">{fmtLong(previous.date)} · {repeatItems.map((p) => lookup(p.exerciseId)?.name).filter(Boolean).join(', ')}</span>
              </span>
              <span className="text-neutral-400">›</span>
            </button>
          )}
          <button onClick={() => setRandomize(true)} className={option}>
            <span><span className="block font-medium">Make a workout</span><span className="block text-sm text-neutral-500">Pick body parts and time, get a full workout</span></span>
            <span className="text-neutral-400">›</span>
          </button>
          <button onClick={() => onNavigate('plan', 'add')} className={option}>
            <span><span className="block font-medium">Pick exercises</span><span className="block text-sm text-neutral-500">Add them yourself, as you go</span></span>
            <span className="text-neutral-400">›</span>
          </button>
        </div>
        <button onClick={() => onNavigate('plan')} className="mt-3 text-sm text-neutral-500">Plan your week ›</button>
      </>
    )
  }

  return (
    <section aria-label="Today" className="rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-neutral-200/70">
      {body}
      {randomize && <RandomizerSheet date={today} onClose={() => setRandomize(false)} onSwitchMode={() => { setRandomize(false); onNavigate('plan') }} />}
    </section>
  )
}
