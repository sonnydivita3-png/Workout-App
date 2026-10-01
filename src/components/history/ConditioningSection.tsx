import { useState } from 'react'
import { CARDIO_GUIDE, cardioWeek, conditioningWeek, lowerIsBetter, resultScore, resultsFor, weekOf } from '../../lib/conditioning'
import { fmtShort } from '../../lib/dates'
import { formatSeconds, showDistance } from '../../lib/units'
import { useToday } from '../../lib/useToday'
import { formatResult, wodOf, wodTitle } from '../../lib/wod'
import { findExercise, useStore } from '../../store'
import type { PlannedExercise, TimedLog } from '../../types'
import { LineChart } from '../LineChart'

const card = 'rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70'

/** This week (accent) over last week (grey), like the hard-sets chart. */
function Bars({ rows, unit }: { rows: { label: string; now: number; then: number }[]; unit: string }) {
  const max = Math.max(10, ...rows.flatMap((r) => [r.now, r.then]))
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-2 text-xs">
          <span className="truncate text-neutral-600">{r.label}</span>
          <span className="relative h-3 rounded-full bg-neutral-100">
            <span className="absolute inset-y-0 left-0 rounded-full bg-neutral-300" style={{ width: `${(r.then / max) * 100}%` }} />
            <span className="absolute inset-y-0.5 left-0 rounded-full bg-accent" style={{ width: `${(r.now / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{Math.round(r.now)}<span className="text-neutral-400"> / {Math.round(r.then)} {unit}</span></span>
        </li>
      ))}
    </ul>
  )
}

const merge = (now: { label: string; minutes: number }[], then: { label: string; minutes: number }[]) =>
  [...new Set([...now, ...then].map((r) => r.label))].map((label) => ({
    label,
    now: now.find((r) => r.label === label)?.minutes ?? 0,
    then: then.find((r) => r.label === label)?.minutes ?? 0,
  }))

interface Track {
  key: string
  name: string
  results: TimedLog[]
  items?: PlannedExercise[]
}

/** Cardio and conditioning on the Progress tab: weekly minutes, and benchmark / Hyrox results over time. */
export function ConditioningSection() {
  const { logs, timedLogs, custom, plan, overrides, benchmarks, units, bodyweight } = useStore()
  const today = useToday()
  const [open, setOpen] = useState<string | null>(null)
  const lookup = (id: string) => findExercise(custom, id)
  const thisWeek = weekOf(today)
  const lastWeek = weekOf(today, 1)

  const cardioNow = cardioWeek(logs, timedLogs, thisWeek, lookup, bodyweight)
  const cardioThen = cardioWeek(logs, timedLogs, lastWeek, lookup, bodyweight)
  const condNow = conditioningWeek(timedLogs, logs, plan, overrides, thisWeek)
  const condThen = conditioningWeek(timedLogs, logs, plan, overrides, lastWeek)

  // Saved benchmarks, then each Hyrox layout that has a finish time.
  const tracks: Track[] = [
    ...benchmarks.flatMap((b) => {
      const wod = wodOf(b.items)
      return wod ? [{ key: b.id, name: `★ ${b.name}`, results: resultsFor(timedLogs, { kind: wod.kind, movements: b.items.map((p) => p.exerciseId) }), items: b.items }] : []
    }),
    ...[...new Set(timedLogs.filter((t) => t.hyrox).map((t) => t.title))].map((title) => ({
      key: `hyrox:${title}`, name: title.replace(/^Hyrox-style · /, 'Hyrox · '), results: resultsFor(timedLogs, { kind: 'fortime' as const, movements: [], title, hyrox: true }),
    })),
  ]

  const nothing = !cardioNow.minutes && !cardioThen.minutes && !condNow.minutes && !condThen.minutes && tracks.length === 0
  if (nothing) {
    return <p className={`${card} text-xs text-neutral-400`}>Cardio, timed workouts and Hyrox show up here once you log them: weekly minutes and how your benchmark results change.</p>
  }

  const guidePct = Math.min(100, (cardioNow.minutes / CARDIO_GUIDE) * 100)
  return (
    <>
      <section className={card}>
        <p className="mb-1 text-sm font-semibold text-neutral-700">Cardio minutes · this week vs last</p>
        <p className="mb-3 text-xs text-neutral-400">Guidelines: about {CARDIO_GUIDE} minutes a week of moderate cardio, or 75 of hard.</p>
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium">{Math.round(cardioNow.minutes)} of {CARDIO_GUIDE} min{cardioNow.distance ? ` · ${showDistance(cardioNow.distance, units)} ${units.distance}` : ''}</span>
            <span className="text-neutral-400">last week {Math.round(cardioThen.minutes)} min</span>
          </div>
          <div className="h-2 rounded-full bg-neutral-100" role="progressbar" aria-label="Cardio minutes this week" aria-valuenow={Math.round(cardioNow.minutes)} aria-valuemax={CARDIO_GUIDE}>
            <div className="h-2 rounded-full bg-accent" style={{ width: `${guidePct}%` }} />
          </div>
        </div>
        {(cardioNow.byType.length > 0 || cardioThen.byType.length > 0) && <Bars rows={merge(cardioNow.byType, cardioThen.byType)} unit="min" />}
        {(cardioNow.calories.total > 0 || cardioNow.calories.missing > 0) && (() => {
          const { total, estimated, missing } = cardioNow.calories
          const all = estimated === total && total > 0
          return (
            <p className="mt-3 text-xs text-neutral-500">
              🔥 <b className="font-medium text-neutral-700">{all ? '≈' : ''}{Math.round(total).toLocaleString()} cal</b> burned in cardio this week, including Hyrox and timed workouts
              {estimated > 0 && (all ? ' (estimated)' : ` (≈${Math.round(estimated).toLocaleString()} of it estimated)`)}
              {cardioThen.calories.total > 0 && <span className="text-neutral-400"> · last week {Math.round(cardioThen.calories.total).toLocaleString()}</span>}
              {estimated > 0 && <span className="block text-neutral-400">Estimates use your bodyweight, the activity, its time and pace. Type your watch’s number on a cardio card to use that instead.</span>}
              {missing > 0 && <span className="block text-neutral-400">{missing} session{missing === 1 ? ' has' : 's have'} no calories: estimates need your bodyweight (add it in Progress → Body).</span>}
            </p>
          )
        })()}
      </section>

      <section className={card}>
        <p className="mb-1 text-sm font-semibold text-neutral-700">Conditioning · this week vs last</p>
        <p className="mb-3 text-xs text-neutral-400">
          {condNow.sessions} session{condNow.sessions === 1 ? '' : 's'}, {Math.round(condNow.minutes)} min this week (last week {Math.round(condThen.minutes)}). Hyrox, timed workouts and circuits.
        </p>
        {(condNow.byKind.length > 0 || condThen.byKind.length > 0)
          ? <Bars rows={merge(condNow.byKind, condThen.byKind)} unit="min" />
          : <p className="text-xs text-neutral-400">Nothing yet in the last two weeks.</p>}
      </section>

      <section className={card}>
        <p className="mb-1 text-sm font-semibold text-neutral-700">Benchmarks</p>
        <p className="mb-2 text-xs text-neutral-400">The same workout, repeated, is the fairest test. Save any timed workout with ☆ Save as benchmark; Hyrox finish times appear on their own.</p>
        {tracks.length === 0 && <p className="text-xs text-neutral-400">No benchmarks yet.</p>}
        <ul className="divide-y divide-neutral-100">
          {tracks.map((t) => {
            const scored = t.results.map((r) => ({ r, y: resultScore(r, t.items) })).filter((x): x is { r: TimedLog; y: number } => x.y != null)
            const last = t.results.at(-1)
            const low = last ? lowerIsBetter(last) : false
            const best = scored.length ? scored.reduce((a, x) => ((low ? x.y < a.y : x.y > a.y) ? x : a)).r : undefined
            const isOpen = open === t.key
            const wod = t.items && wodOf(t.items)
            return (
              <li key={t.key} className="py-2.5">
                <button onClick={() => setOpen(isOpen ? null : t.key)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-2 text-left">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{t.name}</span>
                    <span className="block text-xs text-neutral-400">
                      {wod ? `${wodTitle(wod)} · ` : ''}{t.results.length} result{t.results.length === 1 ? '' : 's'}{last ? ` · last ${formatResult(last)} (${fmtShort(last.date)})` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs">
                    {best && <span className="block font-medium">Best {formatResult(best)}</span>}
                    <span className="text-neutral-400">{isOpen ? '⌃' : '⌄'}</span>
                  </span>
                </button>
                {isOpen && (scored.length >= 2 ? (
                  <div className="mt-2">
                    <LineChart
                      label={`${t.name} results`}
                      points={scored.map((x) => ({ date: x.r.date, y: x.y }))}
                      format={(y) => (low ? formatSeconds(Math.round(y * 60)) : last?.wod.kind === 'amrap' ? `${Math.round(y * 10) / 10} rds` : `${Math.round(y)}`)}
                    />
                    <p className="mt-1 text-xs text-neutral-400">{low ? 'Lower is better (finish time).' : 'Higher is better.'}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-neutral-400">Do it again to see a trend.</p>
                ))}
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
