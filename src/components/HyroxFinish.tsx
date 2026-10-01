import { useState } from 'react'
import { hyroxRunPace, resultsFor } from '../lib/conditioning'
import { formatSeconds, showDistance } from '../lib/units'
import { useToday } from '../lib/useToday'
import { findExercise, useStore } from '../store'
import type { PlannedExercise, Wod } from '../types'
import { NumberInput } from './NumberInput'
import { TimerSheet } from './TimerSheet'

/**
 * A Hyrox session's finish time, under its runs and stations: the stopwatch, the total, and last time on the same
 * layout. The runs and stations keep their own logs (pace per run, station by station).
 */
export function HyroxFinish({ items, date, label }: { items: PlannedExercise[]; date: string; label: string }) {
  const { timedLogs, logs, custom, units, saveTimed, deleteTimed } = useStore()
  const today = useToday()
  const block = items[0].block ?? 'hyrox'
  const saved = timedLogs.find((t) => t.date === date && t.block === block)
  const pairs = Math.max(1, items.length - 1)
  const wod: Wod = { kind: 'fortime', minutes: Math.max(5, Math.round(items.reduce((a, p) => a + (p.est ?? p.minutes ?? 0), 0) * 1.5)), rounds: pairs }
  const past = resultsFor(timedLogs, { kind: 'fortime', movements: [], title: label, hyrox: true }).filter((t) => t.date < date && t.seconds)
  const last = past.at(-1)
  const best = past.length ? past.reduce((a, t) => (t.seconds! < a.seconds! ? t : a)) : undefined
  const lookup = (id: string) => findExercise(custom, id)
  const pace = saved ? hyroxRunPace(saved, logs, lookup) : null

  const [editing, setEditing] = useState(false)
  const [timer, setTimer] = useState(false)
  const [mins, setMins] = useState<number | null>(saved?.seconds != null ? Math.floor(saved.seconds / 60) : null)
  const [secs, setSecs] = useState<number | null>(saved?.seconds != null ? saved.seconds % 60 : null)
  if (date > today) return null

  const total = (mins ?? 0) * 60 + (secs ?? 0)
  const save = () => {
    if (total <= 0) return
    saveTimed({ date, block, wod, title: label, movements: items.map((p) => p.exerciseId), seconds: total, hyrox: true }, [])
    setEditing(false)
  }
  const paceText = (minPerMi: number) => {
    const perUnit = minPerMi / (showDistance(1, units) ?? 1)
    return `${formatSeconds(Math.round(perUnit * 60))} /${units.distance}`
  }

  return (
    <div className="mx-1 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-neutral-200/70">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Finish time</p>
        <button onClick={() => setTimer(true)} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">⏱ Stopwatch</button>
      </div>
      {(last || best) && (
        <p className="mb-2 text-xs text-neutral-400">
          {last && `Last time: ${formatSeconds(last.seconds!)}`}{best && best !== last ? ` · Best: ${formatSeconds(best.seconds!)}` : ''}
        </p>
      )}
      {saved && !editing ? (
        <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2.5">
          <span className="text-sm">
            <b className="font-semibold">{formatSeconds(saved.seconds ?? 0)}</b>
            {pace && <span className="text-neutral-400"> · runs {paceText(pace)}</span>}
          </span>
          <span className="flex gap-3 text-xs">
            <button onClick={() => setEditing(true)} className="text-neutral-500 underline underline-offset-2">Edit</button>
            <button onClick={() => confirm('Delete this finish time?') && deleteTimed(saved.id)} className="text-red-600">Delete</button>
          </span>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <label className="w-20 text-xs text-neutral-500">Minutes<NumberInput label="Hyrox minutes" value={mins} onChange={setMins} /></label>
          <label className="w-20 text-xs text-neutral-500">Seconds<NumberInput label="Hyrox seconds" value={secs} onChange={setSecs} /></label>
          <button disabled={total <= 0} onClick={save} className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-medium text-on-accent disabled:opacity-30">Save time</button>
        </div>
      )}
      <p className="mt-2 text-xs text-neutral-400">Log the run’s total distance and time on its card to see your run pace.</p>
      {timer && (
        <TimerSheet
          wod={wod}
          names={items.map((p) => lookup(p.exerciseId)?.name ?? 'Exercise')}
          onClose={() => setTimer(false)}
          onFinish={(s) => { setMins(Math.floor(s / 60)); setSecs(s % 60); setEditing(true); setTimer(false) }}
        />
      )}
    </div>
  )
}
