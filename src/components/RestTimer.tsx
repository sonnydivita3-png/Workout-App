import { useEffect, useRef, useState } from 'react'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

let audio: AudioContext | undefined
function beep() {
  try {
    audio ??= new AudioContext()
    const o = audio.createOscillator(); const g = audio.createGain()
    o.frequency.value = 880; g.gain.value = 0.15; o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.35)
  } catch { /* optional */ }
}

/**
 * The optional rest countdown after ticking a set (Settings → Workouts → Rest timer; off unless turned on).
 * Beeps and buzzes when rest is over.
 */
export function RestTimer({ until, onChange, onClose }: { until: number; onChange: (until: number) => void; onClose: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t) }, [])
  const left = Math.max(0, Math.ceil((until - now) / 1000))
  const beeped = useRef(false)
  useEffect(() => { beeped.current = false }, [until])
  useEffect(() => {
    if (left > 0 || beeped.current) return
    beeped.current = true
    beep()
    try { navigator.vibrate?.([200, 100, 200]) } catch { /* not supported */ }
  }, [left])
  return (
    <div className="fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 shadow-lg ring-1 ring-accent" role="timer" aria-live="off">
      <span className="text-sm">{left > 0 ? 'Rest' : 'Go! 💪'}</span>
      <span className="text-2xl font-bold tabular-nums">{fmt(left)}</span>
      <span className="flex gap-2 text-xs">
        <button onClick={() => onChange(Math.max(until, Date.now()) + 15000)} className="rounded-full bg-neutral-100 px-2 py-1">+15s</button>
        <button onClick={onClose} className="rounded-full bg-neutral-100 px-2 py-1">{left > 0 ? 'Skip' : 'Close'}</button>
      </span>
    </div>
  )
}
