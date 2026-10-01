import { useState } from 'react'
import { describeItem } from '../lib/describe'
import { derivedLogs, emomIntervals, formatResult, tabataOf, wodOf, wodSignature, wodTitle } from '../lib/wod'
import { findExercise, useStore } from '../store'
import type { PlannedExercise, TimedLog } from '../types'
import { NumberInput } from './NumberInput'
import { TimerSheet } from './TimerSheet'

/** An AMRAP / EMOM / for-time block on the Workouts tab: the work, a clock, and a place to log the result. */
export function TimedBlockCard({ items, date, onRemove }: { items: PlannedExercise[]; date: string; onRemove: () => void }) {
  const { custom, units, timedLogs, saveTimed, deleteTimed } = useStore()
  const wod = wodOf(items)!
  const block = items[0].block ?? 'wod'
  const saved = timedLogs.find((t) => t.date === date && t.block === block)
  const ids = items.map((i) => i.exerciseId)
  const last = timedLogs
    .filter((t) => t.date < date && wodSignature(t.wod.kind, t.movements) === wodSignature(wod.kind, ids))
    .sort((a, b) => b.date.localeCompare(a.date))[0]

  const [editing, setEditing] = useState(false)
  const [timer, setTimer] = useState(false)
  const [rounds, setRounds] = useState<number | null>(saved?.rounds ?? null)
  const [reps, setReps] = useState<number | null>(saved?.reps ?? null)
  const [intervals, setIntervals] = useState<number | null>(saved?.intervals ?? null)
  const [mins, setMins] = useState<number | null>(saved?.seconds != null ? Math.floor(saved.seconds / 60) : null)
  const [secs, setSecs] = useState<number | null>(saved?.seconds != null ? saved.seconds % 60 : null)
  const [capped, setCapped] = useState(saved?.capped ?? false)

  const name = (id: string) => findExercise(custom, id)?.name ?? 'Exercise'
  const showForm = !saved || editing

  const draft = (): Omit<TimedLog, 'id'> | null => {
    const base = { date, block, wod, title: wodTitle(wod), movements: ids }
    if (wod.kind === 'amrap') return rounds == null && reps == null ? null : { ...base, rounds: rounds ?? 0, ...(reps ? { reps } : {}) }
    if (wod.kind === 'tabata') return intervals == null ? null : { ...base, intervals: Math.min(intervals, tabataOf(wod, ids.length).intervals), ...(reps ? { reps } : {}) }
    if (wod.kind === 'emom') return intervals == null ? null : { ...base, intervals: Math.min(intervals, emomIntervals(wod)) }
    if (capped) return rounds == null ? null : { ...base, capped: true, rounds: Math.min(rounds, wod.rounds ?? rounds) }
    const s = (mins ?? 0) * 60 + (secs ?? 0)
    return s > 0 ? { ...base, seconds: s } : null
  }
  const d = draft()
  const save = () => {
    if (!d) return
    const log: TimedLog = { ...d, id: '' }
    saveTimed(d, derivedLogs(log, items, (id) => findExercise(custom, id)))
    setEditing(false)
  }

  return (
    <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-neutral-500">Timed workout</p>
          <h3 className="text-lg font-semibold">{wodTitle(wod)}</h3>
        </div>
        <button onClick={() => confirm('Remove this timed workout from the day?') && onRemove()} aria-label="Remove timed workout" className="text-lg leading-none text-neutral-400">×</button>
      </div>
      <ul className="mb-3 divide-y divide-neutral-100">
        {items.map((p) => {
          const ex = findExercise(custom, p.exerciseId)
          return (
            <li key={p.exerciseId} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
              <span className="min-w-0 line-clamp-2">{name(p.exerciseId)}</span>
              <span className="shrink-0 text-xs tabular-nums text-neutral-400">{ex ? describeItem(p, ex, units) : ''}</span>
            </li>
          )
        })}
      </ul>
      {last && <p className="mb-3 text-xs text-neutral-400">Last time: {formatResult(last)}</p>}

      <button onClick={() => setTimer(true)} className="mb-3 w-full rounded-xl bg-neutral-100 py-2 text-sm font-medium text-neutral-700">⏱ Start timer</button>

      {showForm ? (
        <div>
          <p className="mb-2 text-sm font-semibold text-neutral-700">Log your result</p>
          {wod.kind === 'amrap' && (
            <div className="mb-3 flex gap-2">
              <label className="flex-1 text-xs text-neutral-500">Full rounds<NumberInput value={rounds} onChange={setRounds} /></label>
              <label className="flex-1 text-xs text-neutral-500">Extra reps<NumberInput value={reps} onChange={setReps} /></label>
            </div>
          )}
          {wod.kind === 'emom' && (
            <label className="mb-3 block text-xs text-neutral-500">Intervals completed (of {emomIntervals(wod)})
              <div className="mt-1 flex gap-2">
                <div className="w-24"><NumberInput value={intervals} onChange={setIntervals} /></div>
                <button onClick={() => setIntervals(emomIntervals(wod))} className="rounded-xl bg-neutral-100 px-3 text-sm text-neutral-600">All of them</button>
              </div>
            </label>
          )}
          {wod.kind === 'tabata' && (
            <div className="mb-3 flex items-end gap-2">
              <label className="w-28 text-xs text-neutral-500">Intervals done (of {tabataOf(wod, ids.length).intervals})<NumberInput value={intervals} onChange={setIntervals} /></label>
              <label className="w-24 text-xs text-neutral-500">Total reps<NumberInput value={reps} onChange={setReps} placeholder="optional" /></label>
              <button onClick={() => setIntervals(tabataOf(wod, ids.length).intervals)} className="rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-600">All</button>
            </div>
          )}
          {wod.kind === 'fortime' && (
            <>
              <label className="mb-2 flex items-center gap-2 text-sm text-neutral-600">
                <input type="checkbox" checked={capped} onChange={(e) => setCapped(e.target.checked)} className="h-4 w-4" />
                Didn’t finish (hit the time cap)
              </label>
              {capped ? (
                <label className="mb-3 block text-xs text-neutral-500">Rounds completed (of {wod.rounds ?? 1})<div className="mt-1 w-24"><NumberInput value={rounds} onChange={setRounds} /></div></label>
              ) : (
                <div className="mb-3 flex items-end gap-2">
                  <label className="w-20 text-xs text-neutral-500">Minutes<NumberInput value={mins} onChange={setMins} /></label>
                  <label className="w-20 text-xs text-neutral-500">Seconds<NumberInput value={secs} onChange={setSecs} /></label>
                </div>
              )}
            </>
          )}
          <div className="flex gap-2">
            {saved && <button onClick={() => setEditing(false)} className="w-1/3 rounded-xl bg-neutral-100 py-2.5 text-sm text-neutral-600">Cancel</button>}
            <button disabled={!d} onClick={save} className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-medium text-on-accent disabled:opacity-30">Save result</button>
          </div>
          <p className="mt-2 text-xs text-neutral-400">Also counted toward each exercise’s history.</p>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2.5">
          <span className="text-sm"><span className="text-neutral-400">Result </span><b className="font-semibold">{formatResult(saved!)}</b></span>
          <span className="flex gap-3 text-xs">
            <button onClick={() => setEditing(true)} className="text-neutral-500 underline underline-offset-2">Edit</button>
            <button onClick={() => confirm('Delete this result?') && deleteTimed(saved!.id)} className="text-red-600">Delete</button>
          </span>
        </div>
      )}

      {timer && (
        <TimerSheet
          wod={wod}
          names={items.map((p) => name(p.exerciseId))}
          onClose={() => setTimer(false)}
          onFinish={(s) => { setCapped(false); setMins(Math.floor(s / 60)); setSecs(s % 60); setEditing(true); setTimer(false) }}
        />
      )}
    </div>
  )
}
