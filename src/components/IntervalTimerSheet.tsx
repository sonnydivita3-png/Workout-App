import { useEffect, useRef, useState } from 'react'
import type { Segment } from '../lib/wod'
import { Sheet } from './Sheet'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

let audio: AudioContext | undefined
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

/** A clock that walks through a list of work/rest segments (used for HIIT circuits). */
export function IntervalTimerSheet({ title, segments, onClose }: { title: string; segments: Segment[]; onClose: () => void }) {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const started = useRef(0)
  const elapsedRef = useRef(0)
  const total = segments.reduce((a, s) => a + s.seconds, 0)

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

  let acc = 0
  let idx = segments.length - 1
  for (let i = 0; i < segments.length; i++) {
    if (elapsed < acc + segments[i].seconds) { idx = i; break }
    acc += segments[i].seconds
  }
  const seg = segments[idx]
  const done = elapsed >= total
  const left = done ? 0 : Math.ceil(acc + seg.seconds - elapsed)

  const last = useRef(idx)
  useEffect(() => {
    if (running && idx !== last.current) beep(seg.phase === 'rest')
    last.current = idx
  }, [idx, running, seg.phase])
  useEffect(() => { if (done) beep(true) }, [done])

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="py-6 text-center">
        {!done && <p className={`mb-1 text-sm font-semibold uppercase tracking-widest ${seg.phase === 'work' ? 'text-accent' : 'text-neutral-500'}`}>{seg.phase === 'work' ? 'Work' : 'Rest'}</p>}
        <p className="text-7xl font-extrabold tabular-nums tracking-tight">{fmt(left)}</p>
        {!done && <p className="mt-2 text-lg font-medium">{seg.label}</p>}
        {!done && seg.detail && <p className="mt-1 text-xs text-neutral-400">{seg.detail}</p>}
        <p className="mt-1 text-xs text-neutral-400">Total {fmt(elapsed)} / {fmt(total)}</p>
        {done && <p className="mt-3 text-lg font-semibold">Done! 🔥</p>}
      </div>
      <div className="flex gap-2">
        <button onClick={() => { elapsedRef.current = 0; setElapsed(0); setRunning(false) }} className="w-1/3 rounded-2xl bg-neutral-100 py-3 text-sm font-medium text-neutral-700">Reset</button>
        <button onClick={() => { if (!running) beep(); setRunning((r) => !r) }} disabled={done} className="flex-1 rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent disabled:opacity-30">
          {running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'}
        </button>
      </div>
    </Sheet>
  )
}

/** A stopwatch for one timed hold (a plank, wall sit...). Counts up, beeps at the target, and hands the time back. */
export function HoldTimerSheet({ name, target, onUse, onClose }: { name: string; target?: number; onUse: (seconds: number) => void; onClose: () => void }) {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const started = useRef(0)
  const elapsedRef = useRef(0)
  const hit = useRef(false)

  useEffect(() => {
    if (!running) return
    started.current = performance.now() - elapsedRef.current * 1000
    const t = setInterval(() => {
      const e = (performance.now() - started.current) / 1000
      elapsedRef.current = e
      setElapsed(e)
      if (target && e >= target && !hit.current) { hit.current = true; beep(true) }
    }, 200)
    return () => clearInterval(t)
  }, [running, target])

  return (
    <Sheet title={name} onClose={onClose}>
      <div className="py-6 text-center">
        <p className="text-7xl font-extrabold tabular-nums tracking-tight">{fmt(elapsed)}</p>
        {target ? <p className="mt-2 text-sm text-neutral-500">Target {fmt(target)}{elapsed >= target ? ' ✅' : ''}</p> : <p className="mt-2 text-sm text-neutral-500">Hold as long as you can.</p>}
      </div>
      <div className="flex gap-2">
        <button onClick={() => { elapsedRef.current = 0; hit.current = false; setElapsed(0); setRunning(false) }} className="w-1/3 rounded-2xl bg-neutral-100 py-3 text-sm font-medium text-neutral-700">Reset</button>
        <button onClick={() => { if (!running) beep(); setRunning((r) => !r) }} className="flex-1 rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent">{running ? 'Stop' : elapsed > 0 ? 'Resume' : 'Start'}</button>
      </div>
      {elapsed >= 1 && !running && (
        <button onClick={() => onUse(Math.round(elapsed))} className="mt-2 w-full rounded-2xl bg-neutral-100 py-3 text-sm font-medium text-neutral-700">Use {Math.round(elapsed)} seconds for this set</button>
      )}
    </Sheet>
  )
}
