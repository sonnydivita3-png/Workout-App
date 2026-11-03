import { useId, useRef, useState } from 'react'
import { BUILTIN_BY_ID } from '../data/exercises'
import { useModal } from '../lib/useModal'
import { primaryBtn, secondaryBtn, SheetHandle, sheetBackdrop } from './Sheet'
import { bodyweightOn } from '../lib/calories'
import { finishedCalories } from '../lib/calorieTarget'
import { fmtLong } from '../lib/dates'
import { dayPlanOf } from '../lib/plan'
import { newBests } from '../lib/notify'
import { unfinished, workoutSummary } from '../lib/summary'
import { formatMinutes, showDistance, showWeight } from '../lib/units'
import { findExercise, useStore } from '../store'
import { useToasts } from '../toastStore'
import { sessionLabel, splitItems } from '../lib/sessions'
import type { DaySession } from '../types'

/**
 * "Finish workout": if some planned sets aren't logged, ask first (finish anyway, or keep going); then show how
 * the workout went against last time. On a day split in two, `session` finishes just the morning's or evening's.
 */
export function FinishWorkout({ date, onBack, onDone, session }: { date: string; onBack: () => void; onDone: () => void; session?: DaySession }) {
  const s = useStore()
  const lookup = (id: string) => findExercise(s.custom, id) ?? BUILTIN_BY_ID.get(id)
  const day = dayPlanOf(s.plan, s.overrides, date)
  const items = session ? splitItems(day)?.[session] ?? day : day
  const [missing] = useState(() => unfinished(date, items, s.logs, lookup))
  const [confirmed, setConfirmed] = useState(missing.length === 0)
  // This session's own bests (the morning's were told when it was finished).
  const ids = new Set(items.map((p) => p.exerciseId))
  const bestsHere = (logs: typeof s.logs) => newBests(date, logs, s.units, lookup).filter((b) => [...ids].some((id) => b.id.startsWith(`pr:${id}:`)))
  // The summary (and the congratulations) come when you finish: "Finish workout", or "Finish anyway".
  const summarize = (logs: typeof s.logs) => celebrate(date, workoutSummary(date, items, logs, lookup, s.units), bestsHere(logs))
  const noun = session ? `${sessionLabel(session).toLowerCase()} session` : 'workout'
  const [summary, setSummary] = useState(() => (missing.length === 0 ? summarize(s.logs) : null))
  // Both steps behave like any sheet: focus moves in, Escape goes back to the workout, focus returns after.
  const panel = useRef<HTMLDivElement>(null)
  useModal(panel, onBack)
  const headingId = useId()

  if (!confirmed || !summary) {
    const sets = missing.filter((m) => !m.cardio).reduce((a, m) => a + (m.planned - m.done), 0)
    const cardio = missing.filter((m) => m.cardio).length
    const what = [sets ? `${sets} set${sets === 1 ? '' : 's'}` : '', cardio ? `${cardio} cardio session${cardio === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ')
    return (
      <div className={`${sheetBackdrop} z-50`} onClick={onBack}>
        <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={session ? `Finish the ${noun}?` : 'Finish workout?'} onClick={(e) => e.stopPropagation()} className="sheet-panel w-full rounded-t-3xl bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl outline-none ring-1 ring-neutral-200/60 sm:max-w-md sm:rounded-3xl sm:pt-5">
          <SheetHandle />
          <h2 className="mb-1 mt-1 text-xl font-semibold">Finish the {noun}?</h2>
          <p className="mb-3 text-sm text-neutral-500">{what} {sets + cardio === 1 ? 'isn’t' : 'aren’t'} logged yet:</p>
          <ul className="mb-5 divide-y divide-neutral-100 rounded-2xl bg-neutral-50 px-3 text-sm">
            {missing.map((m) => (
              <li key={m.exerciseId} className="flex justify-between gap-3 py-2.5">
                <span className="min-w-0 line-clamp-2">{m.name}</span>
                <span className="shrink-0 tabular-nums text-neutral-500">{m.cardio ? 'not logged' : `${m.done} of ${m.planned} sets`}</span>
              </li>
            ))}
          </ul>
          <button onClick={() => { setConfirmed(true); setSummary(summarize(useStore.getState().logs)) }} className={`${primaryBtn} mb-2`}>Finish anyway</button>
          <button onClick={onBack} className={`${secondaryBtn} w-full`}>Keep going</button>
        </div>
      </div>
    )
  }

  const units = s.units
  const tile = 'rounded-2xl bg-surface px-3 py-4 shadow-sm ring-1 ring-neutral-200/70'
  const tileLabel = 'mt-0.5 text-xs text-neutral-500'
  const isCardio = (id: string) => lookup(id)?.kind === 'cardio'
  // Lift tiles unless the day was only cardio (or the lifts were all skipped and cardio was done).
  const lifted = summary.results.some((r) => !isCardio(r.exerciseId) && r.status !== 'skipped') || !summary.results.some((r) => isCardio(r.exerciseId))
  const cardio = s.logs.filter((l) => l.date === date && l.cardio && summary.results.some((r) => r.exerciseId === l.exerciseId))
    .reduce((a, l) => ({ minutes: a.minutes + (l.cardio!.minutes ?? 0), distance: a.distance + (l.cardio!.distance ?? 0) }), { minutes: 0, distance: 0 })
  const bests = summary.bests
  const prOf = (id: string) => bests.some((b) => b.id.startsWith(`pr:${id}:`))
  const volDelta = summary.lastLiftVolume ? Math.round(((summary.liftVolume - summary.lastLiftVolume) / summary.lastLiftVolume) * 100) : null
  // Calories from what was done (the cardio as logged, the lifts by sets done, the warm-up if marked done).
  const countTotal = s.trainingPrefs.calorieCount === 'total'
  const kcal = finishedCalories(date, items, s.logs, bodyweightOn(s.bodyweight, date), s.aboutMe, lookup, { warmedUp: s.warmupsDone.includes(date), total: countTotal })
  const calTile = (
    <div className={tile}>
      <p className="text-2xl font-bold tabular-nums">{kcal == null ? '–' : `≈${kcal.toLocaleString()}`}</p>
      <p className={tileLabel}>{kcal == null ? 'cal: add your weight' : `${countTotal ? 'total' : 'active'} cal`}</p>
    </div>
  )
  const icon = { up: '▲', same: '=', down: '▼', new: '🆕', done: '✓', skipped: '–' } as const
  const color = { up: 'text-green-600', same: 'text-neutral-500', down: 'text-red-600', new: 'text-neutral-500', done: 'text-neutral-500', skipped: 'text-neutral-400' } as const
  const word = { up: 'better', same: 'matched', down: 'lower', new: 'first time', done: 'done', skipped: 'skipped' } as const
  return (
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={headingId} className="fixed inset-0 z-50 overflow-y-auto bg-page outline-none">
      {/* The header sits low enough for the celebration banner to show above it. */}
      <div className="mx-auto max-w-md px-5 pb-10 pt-[max(6rem,calc(env(safe-area-inset-top)+5rem))]">
        <p className="text-center text-sm font-medium text-neutral-500">{fmtLong(date)}{session ? ` · ${sessionLabel(session)}` : ''}</p>
        <h1 id={headingId} className="mb-1 mt-1 text-balance text-center text-3xl leading-tight tracking-tight">
          {bests.length
            ? `${bests.length === 1 ? 'A new personal best' : `${bests.length} new personal bests`} 🏆`
            : summary.compared === 0 ? 'Workout logged ✅'
            : summary.beat === summary.compared ? 'Beat last time on everything 🔥' : summary.beat > 0 ? `Beat last time on ${summary.beat} of ${summary.compared}` : 'Logged. Next time you beat it 💪'}
        </h1>
        {lifted ? (
          <div className="mb-4 mt-6 grid grid-cols-2 gap-2 text-center">
            <div className={tile}>
              <p className="text-2xl font-bold tabular-nums">{Math.round(showWeight(summary.liftVolume, units)!).toLocaleString()}</p>
              <p className={tileLabel}>{units.weight} lifted{volDelta == null ? '' : ` · ${volDelta >= 0 ? '+' : ''}${volDelta}% vs last`}</p>
            </div>
            {calTile}
            <div className={tile}><p className="text-2xl font-bold tabular-nums">{summary.beat}</p><p className={tileLabel}>improved</p></div>
            <div className={tile}><p className="text-2xl font-bold tabular-nums">{bests.length}</p><p className={tileLabel}>new bests</p></div>
          </div>
        ) : (
          // Cardio only: what you did, not how it compares with last time.
          <div className="mb-4 mt-6 grid grid-cols-2 gap-2 text-center">
            <div className={tile}><p className="text-2xl font-bold tabular-nums">{formatMinutes(cardio.minutes)}</p><p className={tileLabel}>time</p></div>
            <div className={tile}><p className="text-2xl font-bold tabular-nums">{cardio.distance ? showDistance(cardio.distance, units) : '–'}</p><p className={tileLabel}>{units.distance}</p></div>
            {calTile}
            <div className={tile}><p className="text-2xl font-bold tabular-nums">{bests.length}</p><p className={tileLabel}>new bests</p></div>
          </div>
        )}
        {bests.length > 0 && (
          <section aria-label="New personal bests" className="mb-3 rounded-2xl bg-accent/15 px-4 py-3 ring-1 ring-accent-ink/40">
            <h2 className="mb-1 text-sm font-semibold">🏆 New personal best{bests.length === 1 ? '' : 's'}</h2>
            <ul className="space-y-0.5 text-sm text-neutral-700">{bests.map((b) => <li key={b.id}>{b.body}</li>)}</ul>
          </section>
        )}
        <ul className="mb-6 divide-y divide-neutral-100 rounded-2xl bg-surface px-4 shadow-sm ring-1 ring-neutral-200/70">
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
        <button onClick={() => { s.finishDay(date, session); onDone() }} className={primaryBtn}>Done</button>
        <button onClick={onBack} className="mt-2 min-h-11 w-full text-sm font-medium text-neutral-500">Back to the workout</button>
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
