import { useEffect, useRef, useState } from 'react'
import { BUILTIN_BY_ID } from '../data/exercises'
import { groupByBlock } from '../lib/describe'
import { fmtLong } from '../lib/dates'
import { dayPlanOf } from '../lib/plan'
import { workoutSummary, type WorkoutSummary } from '../lib/summary'
import { showWeight } from '../lib/units'
import { findExercise, useStore } from '../store'
import { useToasts } from '../toastStore'
import { DayWorkout } from './DayWorkout'
import { ExercisePicker } from './ExercisePicker'
import { Tip } from './Tip'

const fmt = (s: number) => `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}:` : ''}${String(Math.floor((s % 3600) / 60)).padStart(Math.floor(s / 3600) ? 2 : 1, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const RESTS = [0, -1, 60, 90, 120, 180]

let audio: AudioContext | undefined
function beep() {
  try {
    audio ??= new AudioContext()
    const o = audio.createOscillator(); const g = audio.createGain()
    o.frequency.value = 880; g.gain.value = 0.15; o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.35)
  } catch { /* optional */ }
}

/** Keep the screen on while a workout is open, so the phone doesn't lock between sets. Re-acquired on return. */
function useWakeLock() {
  useEffect(() => {
    type Lock = { release: () => Promise<void> }
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Lock> } }
    if (!nav.wakeLock) return
    let lock: Lock | null = null
    let live = true
    const get = () => { if (document.visibilityState === 'visible') nav.wakeLock!.request('screen').then((l) => { if (live) lock = l; else void l.release() }).catch(() => undefined) }
    get()
    document.addEventListener('visibilitychange', get)
    return () => { live = false; document.removeEventListener('visibilitychange', get); void lock?.release().catch(() => undefined) }
  }, [])
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return now
}

/** Full-screen workout: one exercise at a time, "try this" targets, ✓ per set, optional rest timer, and a beat-last-time summary. */
export function WorkoutSession({ onMinimize }: { onMinimize: () => void }) {
  const { session, plan, overrides, logs, custom, units, restSeconds, setPrefs, endSession, addExercise } = useStore()
  const [picking, setPicking] = useState(false)
  const now = useNow()
  useWakeLock()
  const [idx, setIdx] = useState(0)
  const [restUntil, setRestUntil] = useState<number | null>(null)
  const [summary, setSummary] = useState<WorkoutSummary | null>(null)
  const beeped = useRef(false)
  const date = session!.date
  const items = dayPlanOf(plan, overrides, date)
  const parts = groupByBlock(items)
  const at = Math.min(idx, Math.max(0, parts.length - 1))
  const restLeft = restUntil ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0

  useEffect(() => {
    if (restUntil && restLeft === 0 && !beeped.current) {
      beeped.current = true
      beep()
      try { navigator.vibrate?.([200, 100, 200]) } catch { /* not supported */ }
    }
  }, [restLeft, restUntil])

  // Auto (-1) rests for as long as the plan says for that exercise; otherwise a fixed time.
  const startRest = (planned: number) => {
    const secs = restSeconds === -1 ? planned : restSeconds
    if (secs > 0) { beeped.current = false; setRestUntil(Date.now() + secs * 1000) }
  }
  const lookup = (id: string) => findExercise(custom, id) ?? BUILTIN_BY_ID.get(id)
  const finish = () => {
    const s = workoutSummary(date, items, logs, lookup)
    setSummary(s)
    if (s.beat > 0) useToasts.getState().push({ id: `beat-${date}-${now}`, title: s.prs ? `${s.prs} new PR${s.prs === 1 ? '' : 's'} 🔥` : 'You beat last time 💪', body: `Better on ${s.beat} of ${s.compared || s.beat} exercises`, celebrate: true })
  }

  if (summary) {
    const mins = Math.max(1, Math.round((now - session!.startedAt) / 60000))
    const volDelta = summary.lastLiftVolume ? Math.round(((summary.liftVolume - summary.lastLiftVolume) / summary.lastLiftVolume) * 100) : null
    const icon = { up: '▲', same: '=', down: '▼', new: '🆕', skipped: '–' } as const
    const color = { up: 'text-green-600', same: 'text-neutral-400', down: 'text-red-600', new: 'text-neutral-500', skipped: 'text-neutral-300' } as const
    return (
      <div className="fixed inset-0 z-40 overflow-y-auto bg-neutral-50">
        <div className="mx-auto max-w-md px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
          <p className="text-sm text-neutral-400">{fmtLong(date)} · {mins} min</p>
          <h1 className="mb-1 text-3xl tracking-tight">
            {summary.compared === 0 ? 'Workout logged ✅' : summary.beat === summary.compared ? 'Beat last time on everything 🔥' : summary.beat > 0 ? `Beat last time on ${summary.beat} of ${summary.compared}` : 'Logged. Next time you beat it 💪'}
          </h1>
          <div className="my-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-surface p-3 ring-1 ring-neutral-200/70"><p className="text-2xl font-bold">{summary.beat}</p><p className="text-[11px] text-neutral-400">improved</p></div>
            <div className="rounded-2xl bg-surface p-3 ring-1 ring-neutral-200/70"><p className="text-2xl font-bold">{summary.prs}</p><p className="text-[11px] text-neutral-400">new bests</p></div>
            <div className="rounded-2xl bg-surface p-3 ring-1 ring-neutral-200/70">
              <p className="text-2xl font-bold">{volDelta == null ? `${Math.round(showWeight(summary.liftVolume, units)!).toLocaleString()}` : `${volDelta >= 0 ? '+' : ''}${volDelta}%`}</p>
              <p className="text-[11px] text-neutral-400">{volDelta == null ? `volume (${units.weight})` : 'volume vs last'}</p>
            </div>
          </div>
          <ul className="mb-6 divide-y divide-neutral-100 rounded-2xl bg-surface px-4 ring-1 ring-neutral-200/70">
            {summary.results.map((r) => (
              <li key={r.exerciseId} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 line-clamp-2">{r.name}</span>
                <span className={`shrink-0 text-sm font-medium ${color[r.status]}`}>
                  {r.pr && <span className="mr-2 rounded-full bg-accent px-2 py-0.5 text-[10px] uppercase text-on-accent">PR</span>}
                  {icon[r.status]} {r.status === 'up' ? 'better' : r.status === 'down' ? 'lower' : r.status === 'same' ? 'matched' : r.status === 'new' ? 'first time' : 'skipped'}
                </span>
              </li>
            ))}
          </ul>
          <button onClick={() => { setSummary(null); endSession() }} className="w-full rounded-2xl bg-accent py-3 font-medium text-on-accent">Done</button>
          <button onClick={() => setSummary(null)} className="mt-2 w-full py-2 text-sm text-neutral-500">Back to the workout</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-neutral-50">
      <div className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button onClick={onMinimize} className="text-sm text-neutral-500" aria-label="Minimize workout">⌄ Hide</button>
          <div className="text-center">
            <p className="text-xl font-bold tabular-nums">{fmt((now - session!.startedAt) / 1000)}</p>
            <p className="text-[11px] text-neutral-400">{fmtLong(date)}</p>
          </div>
          <button onClick={finish} className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-on-accent">Finish</button>
        </div>
        <div className="mx-auto mt-2 flex max-w-md items-center justify-between text-xs text-neutral-500">
          <span>Part {at + 1} of {parts.length || 1}</span>
          <label className="flex items-center gap-1">Rest timer
            <select value={restSeconds} onChange={(e) => setPrefs({ restSeconds: Number(e.target.value) })} className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-neutral-700">
              {RESTS.map((r) => <option key={r} value={r}>{r === -1 ? 'As planned' : r ? `${r}s` : 'Off'}</option>)}
            </select>
          </label>
        </div>
        <div className="mx-auto mt-2 flex max-w-md gap-1" aria-hidden>
          {parts.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < at ? 'bg-accent/60' : i === at ? 'bg-accent' : 'bg-neutral-200'}`} />)}
        </div>
      </div>

      <div className="mx-auto max-w-md space-y-3 px-4 pb-40 pt-4">
        {items.length > 0 && <Tip id="workout">Your target for each set comes from last time. Tap <b className="font-medium">✓</b> when a set is done and the rest timer starts.</Tip>}
        {items.length === 0 ? (
          <div className="py-14 text-center">
            <p className="mb-1 text-lg font-semibold">Empty workout</p>
            <p className="mb-5 text-sm text-neutral-400">Add your first exercise. Add more any time.</p>
            <button onClick={() => setPicking(true)} className="rounded-2xl bg-accent px-6 py-3 font-medium text-on-accent">+ Add exercise</button>
          </div>
        ) : (
          <DayWorkout date={date} items={items} only={at} onSetDone={startRest} />
        )}
        {items.length > 0 && <button onClick={() => setPicking(true)} className="w-full rounded-2xl border border-dashed border-neutral-300 py-3 text-sm text-neutral-500">+ Add exercise</button>}
        <div className="flex gap-2 pt-2">
          <button disabled={at === 0} onClick={() => setIdx(at - 1)} className="flex-1 rounded-2xl bg-neutral-100 py-3 text-sm font-medium text-neutral-700 disabled:opacity-30">‹ Previous</button>
          {at < parts.length - 1
            ? <button onClick={() => setIdx(at + 1)} className="flex-1 rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent">Next ›</button>
            : <button onClick={finish} className="flex-1 rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent">Finish workout</button>}
        </div>
      </div>

      {picking && (
        <ExercisePicker
          taken={new Set(items.map((p) => p.exerciseId))}
          onPick={(e) => { addExercise(date, e.id, e.kind); setIdx(parts.length); setPicking(false) }}
          onClose={() => setPicking(false)}
        />
      )}
      {restUntil && (
        <div className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 shadow-lg ring-1 ring-accent" role="timer" aria-live="off">
          <span className="text-sm">{restLeft > 0 ? 'Rest' : 'Go! 💪'}</span>
          <span className="text-2xl font-bold tabular-nums">{fmt(restLeft)}</span>
          <span className="flex gap-2 text-xs">
            <button onClick={() => setRestUntil((r) => (r ?? Date.now()) + 15000)} className="rounded-full bg-neutral-100 px-2 py-1">+15s</button>
            <button onClick={() => setRestUntil(null)} className="rounded-full bg-neutral-100 px-2 py-1">{restLeft > 0 ? 'Skip' : 'Close'}</button>
          </span>
        </div>
      )}
    </div>
  )
}
