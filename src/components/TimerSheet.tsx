import { useEffect, useRef, useState } from 'react'
import { emomIntervals, wodTitle } from '../lib/wod'
import type { Wod } from '../types'
import { Sheet } from './Sheet'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

let audio: AudioContext | undefined
/** A short beep; browsers only allow sound after a tap, and this runs after Start. */
function beep(long = false) {
  try {
    audio ??= new AudioContext()
    const o = audio.createOscillator()
    const g = audio.createGain()
    o.frequency.value = long ? 660 : 880
    g.gain.value = 0.15
    o.connect(g).connect(audio.destination)
    o.start()
    o.stop(audio.currentTime + (long ? 0.6 : 0.15))
  } catch { /* sound is optional */ }
}

/**
 * A clock for timed workouts: countdown for AMRAP, per-interval countdown that names the movement for EMOM, and a stopwatch
 * for "for time". Nothing is saved from here except (for time) the finishing time, which is handed back.
 */
export function TimerSheet({ wod, names, onClose, onFinish }: { wod: Wod; names: string[]; onClose: () => void; onFinish?: (seconds: number) => void }) {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const started = useRef(0)
  const elapsedRef = useRef(0)
  const total = wod.minutes * 60
  const interval = (wod.interval ?? 1) * 60

  useEffect(() => {
    if (!running) return
    started.current = performance.now() - elapsedRef.current * 1000
    const t = setInterval(() => {
      const e = Math.min(total, (performance.now() - started.current) / 1000)
      elapsedRef.current = e
      setElapsed(e)
      if (e >= total) setRunning(false)
    }, 200)
    return () => clearInterval(t)
  }, [running, total])

  const idx = wod.kind === 'emom' ? Math.min(emomIntervals(wod) - 1, Math.floor(elapsed / interval)) : 0
  const done = elapsed >= total
  // Beep on each new interval, and when time is up.
  const lastIdx = useRef(0)
  useEffect(() => {
    if (running && wod.kind === 'emom' && idx !== lastIdx.current) beep()
    lastIdx.current = idx
  }, [idx, running, wod.kind])
  useEffect(() => { if (done) beep(true) }, [done])

  const remaining = Math.max(0, total - elapsed)
  const big = wod.kind === 'fortime' ? fmt(elapsed) : wod.kind === 'emom' ? fmt(Math.max(0, interval - (elapsed - idx * interval))) : fmt(remaining)
  const reset = () => { elapsedRef.current = 0; setElapsed(0); setRunning(false) }

  return (
    <Sheet title={wodTitle(wod)} onClose={onClose}>
      <div className="py-6 text-center">
        {wod.kind === 'emom' && (
          <p className="mb-1 text-sm text-neutral-500">Interval {done ? emomIntervals(wod) : idx + 1} of {emomIntervals(wod)}</p>
        )}
        <p className="text-7xl font-extrabold tabular-nums tracking-tight" aria-live="off">{big}</p>
        {wod.kind === 'emom' && !done && <p className="mt-2 text-lg font-medium">{names[idx % Math.max(1, names.length)]}</p>}
        {wod.kind === 'amrap' && <p className="mt-2 text-sm text-neutral-500">Count your rounds as you go.</p>}
        {wod.kind === 'emom' && <p className="mt-1 text-xs text-neutral-400">Total {fmt(elapsed)} / {fmt(total)}</p>}
        {wod.kind === 'fortime' && <p className="mt-1 text-xs text-neutral-400">Time cap {fmt(total)}</p>}
        {done && <p className="mt-3 text-lg font-semibold">Time! 🔔</p>}
      </div>
      <div className="flex gap-2">
        <button onClick={reset} className="w-1/3 rounded-2xl bg-neutral-100 py-3 text-sm font-medium text-neutral-700">Reset</button>
        <button onClick={() => { if (!running) beep(); setRunning((r) => !r) }} disabled={done} className="flex-1 rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent disabled:opacity-30">
          {running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'}
        </button>
      </div>
      {wod.kind === 'fortime' && onFinish && elapsed > 0 && (
        <button onClick={() => { setRunning(false); onFinish(Math.round(elapsed)) }} className="mt-2 w-full rounded-2xl bg-neutral-100 py-3 text-sm font-medium text-neutral-700">
          Finished: use {fmt(elapsed)} as my time
        </button>
      )}
    </Sheet>
  )
}
