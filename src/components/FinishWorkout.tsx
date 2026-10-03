import { useState } from 'react'
import { BUILTIN_BY_ID } from '../data/exercises'
import { fmtLong } from '../lib/dates'
import { dayPlanOf } from '../lib/plan'
import { newBests } from '../lib/notify'
import { unfinished, workoutSummary } from '../lib/summary'
import { formatMinutes, showDistance, showWeight } from '../lib/units'
import { findExercise, useStore } from '../store'
import { useToasts } from '../toastStore'

/**
 * "Finish workout": if some planned sets aren't logged, ask first (finish anyway, or keep going); then show how
 * the workout went against last time.
 */
export function FinishWorkout({ date, onBack, onDone }: { date: string; onBack: () => void; onDone: () => void }) {
  const s = useStore()
  const lookup = (id: string) => findExercise(s.custom, id) ?? BUILTIN_BY_ID.get(id)
  const items = dayPlanOf(s.plan, s.overrides, date)
  const [missing] = useState(() => unfinished(date, items, s.logs, lookup))
  const [confirmed, setConfirmed] = useState(missing.length === 0)
  // The summary (and the congratulations) come when you finish: "Finish workout", or "Finish anyway".
  const summarize = (logs: typeof s.logs) => celebrate(date, workoutSummary(date, items, logs, lookup, s.units), newBests(date, logs, s.units, lookup))
  const [summary, setSummary] = useState(() => (missing.length === 0 ? summarize(s.logs) : null))

  if (!confirmed || !summary) {
    const sets = missing.filter((m) => !m.cardio).reduce((a, m) => a + (m.planned - m.done), 0)
    const cardio = missing.filter((m) => m.cardio).length
    const what = [sets ? `${sets} set${sets === 1 ? '' : 's'}` : '', cardio ? `${cardio} cardio session${cardio === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ')
    return (
      <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onBack}>
        <div role="dialog" aria-modal="true" aria-label="Finish workout?" onClick={(e) => e.stopPropagation()} className="w-full rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl">
          <h2 className="mb-1 text-xl font-semibold">Finish the workout?</h2>
          <p className="mb-3 text-sm text-neutral-500">{what} {sets + cardio === 1 ? 'isn’t' : 'aren’t'} logged yet:</p>
          <ul className="mb-5 space-y-1.5 text-sm">
            {missing.map((m) => (
              <li key={m.exerciseId} className="flex justify-between gap-3">
                <span className="min-w-0 line-clamp-2">{m.name}</span>
                <span className="shrink-0 text-neutral-400">{m.cardio ? 'not logged' : `${m.done} of ${m.planned} sets`}</span>
              </li>
            ))}
          </ul>
          <button onClick={() => { setConfirmed(true); setSummary(summarize(useStore.getState().logs)) }} className="mb-2 w-full rounded-2xl bg-accent py-3 font-medium text-on-accent">Finish anyway</button>
          <button onClick={onBack} className="w-full rounded-2xl bg-neutral-100 py-3 font-medium text-neutral-700">Keep going</button>
        </div>
      </div>
    )
  }

  const units = s.units
  const tile = 'rounded-2xl bg-surface p-3 ring-1 ring-neutral-200/70'
  const isCardio = (id: string) => lookup(id)?.kind === 'cardio'
  // Lift tiles unless the day was only cardio (or the lifts were all skipped and cardio was done).
  const lifted = summary.results.some((r) => !isCardio(r.exerciseId) && r.status !== 'skipped') || !summary.results.some((r) => isCardio(r.exerciseId))
  const cardio = s.logs.filter((l) => l.date === date && l.cardio && summary.results.some((r) => r.exerciseId === l.exerciseId))
    .reduce((a, l) => ({ minutes: a.minutes + (l.cardio!.minutes ?? 0), distance: a.distance + (l.cardio!.distance ?? 0) }), { minutes: 0, distance: 0 })
  const bests = summary.bests
  const prOf = (id: string) => bests.some((b) => b.id.startsWith(`pr:${id}:`))
  const volDelta = summary.lastLiftVolume ? Math.round(((summary.liftVolume - summary.lastLiftVolume) / summary.lastLiftVolume) * 100) : null
  const icon = { up: '▲', same: '=', down: '▼', new: '🆕', done: '✓', skipped: '–' } as const
  const color = { up: 'text-green-600', same: 'text-neutral-400', down: 'text-red-600', new: 'text-neutral-500', done: 'text-neutral-500', skipped: 'text-neutral-300' } as const
  const word = { up: 'better', same: 'matched', down: 'lower', new: 'first time', done: 'done', skipped: 'skipped' } as const
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-50">
      <div className="mx-auto max-w-md px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <p className="text-sm text-neutral-400">{fmtLong(date)}</p>
        <h1 className="mb-1 text-3xl tracking-tight">
          {bests.length
            ? `${bests.length === 1 ? 'A new personal best' : `${bests.length} new personal bests`} 🏆`
            : summary.compared === 0 ? 'Workout logged ✅'
            : summary.beat === summary.compared ? 'Beat last time on everything 🔥' : summary.beat > 0 ? `Beat last time on ${summary.beat} of ${summary.compared}` : 'Logged. Next time you beat it 💪'}
        </h1>
        {lifted ? (
          <div className="my-4 grid grid-cols-3 gap-2 text-center">
            <div className={tile}><p className="text-2xl font-bold">{summary.beat}</p><p className="text-xs text-neutral-400">improved</p></div>
            <div className={tile}><p className="text-2xl font-bold">{bests.length}</p><p className="text-xs text-neutral-400">new bests</p></div>
            <div className={tile}>
              <p className="text-2xl font-bold">{volDelta == null ? `${Math.round(showWeight(summary.liftVolume, units)!).toLocaleString()}` : `${volDelta >= 0 ? '+' : ''}${volDelta}%`}</p>
              <p className="text-xs text-neutral-400">{volDelta == null ? `volume (${units.weight})` : 'volume vs last'}</p>
            </div>
          </div>
        ) : (
          // Cardio only: what you did, not how it compares with last time.
          <div className="my-4 grid grid-cols-3 gap-2 text-center">
            <div className={tile}><p className="text-2xl font-bold">{formatMinutes(cardio.minutes)}</p><p className="text-xs text-neutral-400">time</p></div>
            <div className={tile}><p className="text-2xl font-bold">{cardio.distance ? showDistance(cardio.distance, units) : '–'}</p><p className="text-xs text-neutral-400">{units.distance}</p></div>
            <div className={tile}><p className="text-2xl font-bold">{bests.length}</p><p className="text-xs text-neutral-400">new bests</p></div>
          </div>
        )}
        {bests.length > 0 && (
          <section aria-label="New personal bests" className="mb-3 rounded-2xl bg-accent/15 px-4 py-3 ring-1 ring-accent">
            <h2 className="mb-1 text-sm font-semibold">🏆 New personal best{bests.length === 1 ? '' : 's'}</h2>
            <ul className="space-y-0.5 text-sm text-neutral-700">{bests.map((b) => <li key={b.id}>{b.body}</li>)}</ul>
          </section>
        )}
        <ul className="mb-6 divide-y divide-neutral-100 rounded-2xl bg-surface px-4 ring-1 ring-neutral-200/70">
          {summary.results.map((r) => (
            <li key={r.exerciseId} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="line-clamp-2">{r.name}</span>
                {r.best && <span className="block text-xs font-medium text-green-600">🏆 {r.best}</span>}
              </span>
              <span className={`shrink-0 text-sm font-medium ${color[r.status]}`}>
                {prOf(r.exerciseId) && <span className="mr-2 rounded-full bg-accent px-2 py-0.5 text-[10px] uppercase text-on-accent">PR</span>}
                {icon[r.status]} {word[r.status]}
              </span>
            </li>
          ))}
        </ul>
        <button onClick={() => { s.finishDay(date); onDone() }} className="w-full rounded-2xl bg-accent py-3 font-medium text-on-accent">Done</button>
        <button onClick={onBack} className="mt-2 w-full py-2 text-sm text-neutral-500">Back to the workout</button>
      </div>
    </div>
  )
}

function celebrate(date: string, s: ReturnType<typeof workoutSummary>, bests: ReturnType<typeof newBests>) {
  // Personal bests first (heaviest, most reps, longest hold, cardio records), else beating last time.
  const names = [...new Set(bests.map((b) => b.body.split(':')[0]))]
  if (bests.length) {
    useToasts.getState().push({
      id: `beat-${date}`,
      title: `${bests.length === 1 ? 'New personal best' : `${bests.length} new personal bests`} 🏆`,
      body: names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3} more`,
      celebrate: true,
    })
  } else if (s.beat > 0) {
    useToasts.getState().push({ id: `beat-${date}`, title: 'You beat last time 💪', body: `Better on ${s.beat} of ${s.compared || s.beat} exercises`, celebrate: true })
  }
  return { ...s, bests }
}
