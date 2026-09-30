import { useMemo, useState } from 'react'
import { formatPace, formatSeconds, showDistance, showWeight } from '../lib/units'
import { cardioSessions, hasData, isPR, setSessions, strengthSessions } from '../lib/stats'
import { findExercise, useStore } from '../store'
import type { Exercise } from '../types'
import { formatResult } from '../lib/wod'
import { LineChart } from './LineChart'
import { BodyTab } from './history/BodyTab'
import { WorkoutsTab } from './history/WorkoutsTab'

const fmtLong = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

type HTab = 'workouts' | 'exercises' | 'body'

export function HistoryView() {
  const [tab, setTab] = useState<HTab>('workouts')
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`
  const tabs = (
    <div className="mb-4 flex gap-2">
      {(['workouts', 'exercises', 'body'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={chip(tab === t)}>{t === 'workouts' ? 'Workouts' : t === 'exercises' ? 'Exercises' : 'Body'}</button>)}
    </div>
  )
  return (
    <section>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">History</h1>
      {tabs}
      {tab === 'workouts' && <WorkoutsTab />}
      {tab === 'exercises' && <ExercisesTab />}
      {tab === 'body' && <BodyTab />}
    </section>
  )
}

function ExercisesTab() {
  const { logs, custom, timedLogs, deleteTimed } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const latest = new Map<string, string>()
    const count = new Map<string, number>()
    for (const l of logs) {
      if (!hasData(l)) continue
      count.set(l.exerciseId, (count.get(l.exerciseId) ?? 0) + 1)
      if ((latest.get(l.exerciseId) ?? '') < l.date) latest.set(l.exerciseId, l.date)
    }
    return [...latest.entries()]
      .map(([id, date]) => ({ ex: findExercise(custom, id), date, n: count.get(id)! }))
      .filter((r): r is { ex: Exercise; date: string; n: number } => !!r.ex)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [logs, custom])

  const ex = openId ? findExercise(custom, openId) : undefined
  if (ex && rows.some((r) => r.ex.id === ex.id)) return <Detail exercise={ex} onBack={() => setOpenId(null)} />

  return (
    <section>
      {rows.length === 0 && timedLogs.length === 0 ? (
        <p className="py-16 text-center text-neutral-400">Nothing logged yet. Log a workout and your glow-up shows up here 📈</p>
      ) : (
        <>
        {timedLogs.length > 0 && (
          <div className="mb-5">
            <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-400">Timed workouts</h2>
            <ul className="space-y-2">
              {[...timedLogs].sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70">
                  <span className="min-w-0">
                    <span className="block font-medium">{t.title}</span>
                    <span className="block truncate text-xs text-neutral-400">{fmtLong(t.date)} · {t.movements.map((id) => findExercise(custom, id)?.name).filter(Boolean).join(', ')}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <b className="tabular-nums">{formatResult(t)}</b>
                    <button onClick={() => confirm(`Delete this ${t.title} result? Its exercise history for that day goes too.`) && deleteTimed(t.id)} className="text-xs text-red-600">Delete</button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {rows.length > 0 && <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-400">Exercises</h2>}
        <ul className="space-y-2">
          {rows.map(({ ex, date, n }) => (
            <li key={ex.id}>
              <button
                onClick={() => setOpenId(ex.id)}
                className="flex w-full items-center justify-between rounded-2xl bg-surface p-4 text-left shadow-sm ring-1 ring-neutral-200/70"
              >
                <span>
                  <span className="block font-medium">{ex.name}</span>
                  <span className="text-xs text-neutral-400">{n} session{n > 1 ? 's' : ''} · last {fmtLong(date)}</span>
                </span>
                <span className="text-neutral-300">›</span>
              </button>
            </li>
          ))}
        </ul>
        </>
      )}
    </section>
  )
}

type Metric = 'e1rm' | 'top' | 'volume' | 'pace' | 'distance' | 'time' | 'best' | 'total'

function Detail({ exercise, onBack }: { exercise: Exercise; onBack: () => void }) {
  const { logs, units, deleteLogs } = useStore()
  const isStrength = exercise.kind === 'strength'
  const mode = exercise.mode ?? 'weight'
  const [metric, setMetric] = useState<Metric>(!isStrength ? 'pace' : mode === 'weight' ? 'e1rm' : 'best')

  const strength = useMemo(() => (mode === 'weight' ? strengthSessions(logs, exercise.id) : []), [logs, exercise.id, mode])
  const counted = useMemo(() => (mode === 'weight' ? [] : setSessions(logs, exercise.id, mode)), [logs, exercise.id, mode])
  const cardio = useMemo(() => cardioSessions(logs, exercise.id), [logs, exercise.id])

  const metrics: { id: Metric; label: string }[] = isStrength
    ? mode === 'weight'
      ? [{ id: 'e1rm', label: 'Est. 1RM' }, { id: 'top', label: 'Top weight' }, { id: 'volume', label: 'Volume' }]
      : mode === 'reps'
        ? [{ id: 'best', label: 'Best set' }, { id: 'total', label: 'Total reps' }]
        : [{ id: 'best', label: 'Longest hold' }, { id: 'total', label: 'Total time' }]
    : [{ id: 'pace', label: 'Pace' }, { id: 'distance', label: 'Distance' }, { id: 'time', label: 'Time' }]

  const w = (lb: number) => showWeight(lb, units)!
  let points: { date: string; y: number }[] = []
  let format = (v: number) => String(Math.round(v * 10) / 10)
  let higherIsBetter = true

  if (isStrength && mode !== 'weight') {
    points = counted.map((s) => ({ date: s.date, y: metric === 'best' ? s.best : s.total }))
    format = (v) => (mode === 'time' ? formatSeconds(v) : `${Math.round(v)} reps`)
  } else if (isStrength) {
    const pick = (s: (typeof strength)[number]) => (metric === 'e1rm' ? w(s.e1rm) : metric === 'top' ? w(s.topWeight) : w(s.volume))
    points = strength.map((s) => ({ date: s.date, y: pick(s) }))
    format = (v) => `${Math.round(v).toLocaleString()} ${units.weight}`
  } else {
    const rows = cardio.filter((c) => (metric === 'pace' ? c.pace : metric === 'distance' ? c.distance : c.minutes))
    points = rows.map((c) => ({
      date: c.date,
      y: metric === 'pace' ? c.pace! / (showDistance(1, units) ?? 1) : metric === 'distance' ? showDistance(c.distance, units)! : c.minutes!,
    }))
    higherIsBetter = metric !== 'pace'
    format = (v) =>
      metric === 'pace'
        ? `${Math.floor(v)}:${String(Math.round((v % 1) * 60) % 60).padStart(2, '0')}/${units.distance}`
        : metric === 'distance'
          ? `${Math.round(v * 10) / 10} ${units.distance}`
          : `${Math.round(v)} min`
  }

  const ys = points.map((p) => p.y)
  const best = ys.length ? (higherIsBetter ? Math.max(...ys) : Math.min(...ys)) : null
  const pr = higherIsBetter ? isPR(ys) : isPR(ys.map((v) => -v))

  return (
    <section>
      <button onClick={onBack} className="mb-2 text-sm text-neutral-500">‹ History</button>
      <h1 className="text-2xl font-semibold tracking-tight">{exercise.name}</h1>
      <div className="mt-4 flex gap-2">
        {metrics.map((m) => (
          <button
            key={m.id}
            onClick={() => setMetric(m.id)}
            className={`rounded-full px-3 py-1 text-sm ${m.id === metric ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70">
        {points.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">No data for this metric yet.</p>
        ) : (
          <>
            <div className="mb-3 flex items-baseline justify-between border-b border-neutral-100 pb-3">
              <span className="text-xs uppercase tracking-wide text-neutral-400">Best</span>
              <span className="tabular-nums text-lg font-semibold">
                {format(best!)}
                {pr && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium uppercase text-on-accent">New PR</span>}
              </span>
            </div>
            <LineChart points={points} format={format} label={metrics.find((m) => m.id === metric)!.label} />
          </>
        )}
      </div>

      <h2 className="mb-2 mt-6 text-xs uppercase tracking-wide text-neutral-400">Sessions</h2>
      <ul className="space-y-2">
        {(isStrength ? (mode === 'weight' ? [...strength] : [...counted]).reverse() : [...cardio].reverse()).map((s) => (
          <li key={s.date} className="rounded-2xl bg-surface p-4 text-sm shadow-sm ring-1 ring-neutral-200/70">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium">{fmtLong(s.date)}</span>
              <button
                onClick={() => confirm(`Delete ${exercise.name} on ${fmtLong(s.date)}? This can’t be undone.`) && deleteLogs(exercise.id, s.date)}
                aria-label={`Delete ${fmtLong(s.date)}`}
                className="text-xs text-red-600"
              >
                Delete
              </button>
            </div>
            {'values' in s ? (
              <div className="tabular-nums text-neutral-500">
                {s.values.map((v, i) => (
                  <span key={i} className="mr-3 inline-block">{mode === 'time' ? formatSeconds(v) : `${v} reps`}</span>
                ))}
              </div>
            ) : 'sets' in s ? (
              <div className="tabular-nums text-neutral-500">
                {s.sets.map((x, i) => (
                  <span key={i} className="mr-3 inline-block">{w(x.weight)} × {x.reps}</span>
                ))}
              </div>
            ) : (
              <div className="tabular-nums text-neutral-500">
                {showDistance(s.distance, units) ?? '–'} {units.distance} · {s.minutes ?? '–'} min · {formatPace(s.distance, s.minutes, units) ?? '–'}
              </div>
            )}
          </li>
        ))}
      </ul>
      <button
        onClick={() => { if (confirm(`Delete all ${exercise.name} history? This can’t be undone.`)) { deleteLogs(exercise.id); onBack() } }}
        className="mt-6 w-full py-2 text-sm text-red-600"
      >
        Delete all {exercise.name} history
      </button>
    </section>
  )
}
