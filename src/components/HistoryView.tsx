import { useMemo, useState } from 'react'
import { formatPace, showDistance, showWeight } from '../lib/units'
import { cardioSessions, isPR, strengthSessions } from '../lib/stats'
import { findExercise, useStore } from '../store'
import type { Exercise } from '../types'
import { LineChart } from './LineChart'

const fmtLong = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

export function HistoryView() {
  const { logs, custom } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const latest = new Map<string, string>()
    const count = new Map<string, number>()
    for (const l of logs) {
      const has = l.sets?.some((s) => s.weight && s.reps) || l.cardio?.distance || l.cardio?.minutes
      if (!has) continue
      count.set(l.exerciseId, (count.get(l.exerciseId) ?? 0) + 1)
      if ((latest.get(l.exerciseId) ?? '') < l.date) latest.set(l.exerciseId, l.date)
    }
    return [...latest.entries()]
      .map(([id, date]) => ({ ex: findExercise(custom, id), date, n: count.get(id)! }))
      .filter((r): r is { ex: Exercise; date: string; n: number } => !!r.ex)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [logs, custom])

  const ex = openId ? findExercise(custom, openId) : undefined
  if (ex) return <Detail exercise={ex} onBack={() => setOpenId(null)} />

  return (
    <section>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">History</h1>
      {rows.length === 0 ? (
        <p className="py-16 text-center text-neutral-400">Nothing logged yet. Your progress shows up here.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ ex, date, n }) => (
            <li key={ex.id}>
              <button
                onClick={() => setOpenId(ex.id)}
                className="flex w-full items-center justify-between rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-neutral-200/70"
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
      )}
    </section>
  )
}

type Metric = 'e1rm' | 'top' | 'volume' | 'pace' | 'distance' | 'time'

function Detail({ exercise, onBack }: { exercise: Exercise; onBack: () => void }) {
  const { logs, units } = useStore()
  const isStrength = exercise.kind === 'strength'
  const [metric, setMetric] = useState<Metric>(isStrength ? 'e1rm' : 'pace')

  const strength = useMemo(() => strengthSessions(logs, exercise.id), [logs, exercise.id])
  const cardio = useMemo(() => cardioSessions(logs, exercise.id), [logs, exercise.id])

  const metrics: { id: Metric; label: string }[] = isStrength
    ? [{ id: 'e1rm', label: 'Est. 1RM' }, { id: 'top', label: 'Top weight' }, { id: 'volume', label: 'Volume' }]
    : [{ id: 'pace', label: 'Pace' }, { id: 'distance', label: 'Distance' }, { id: 'time', label: 'Time' }]

  const w = (lb: number) => showWeight(lb, units)!
  let points: { date: string; y: number }[] = []
  let format = (v: number) => String(Math.round(v * 10) / 10)
  let higherIsBetter = true

  if (isStrength) {
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
            className={`rounded-full px-3 py-1 text-sm ${m.id === metric ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200/70">
        {points.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">No data for this metric yet.</p>
        ) : (
          <>
            <div className="mb-3 flex items-baseline justify-between border-b border-neutral-100 pb-3">
              <span className="text-xs uppercase tracking-wide text-neutral-400">Best</span>
              <span className="tabular-nums text-lg font-semibold">
                {format(best!)}
                {pr && <span className="ml-2 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-medium uppercase text-white">New PR</span>}
              </span>
            </div>
            <LineChart points={points} format={format} label={metrics.find((m) => m.id === metric)!.label} />
          </>
        )}
      </div>

      <h2 className="mb-2 mt-6 text-xs uppercase tracking-wide text-neutral-400">Sessions</h2>
      <ul className="space-y-2">
        {(isStrength ? [...strength].reverse() : [...cardio].reverse()).map((s) => (
          <li key={s.date} className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-neutral-200/70">
            <div className="mb-1 font-medium">{fmtLong(s.date)}</div>
            {'sets' in s ? (
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
    </section>
  )
}
