import type { RestPref } from '../lib/timing'
import { defaultWarmMinutes } from '../lib/randomizer'
import { useStore, type WarmupKind } from '../store'

const chip = (on: boolean, disabled = false) =>
  `rounded-full px-3 py-1.5 text-sm ${disabled ? 'bg-neutral-100 text-neutral-300' : on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`
const h3 = 'mb-2 text-sm font-semibold text-neutral-700'

/**
 * Warm-up choices and rest length, remembered between uses. Shared by the randomizer and the week/month planner.
 * `lengthControl` adds a warm-up length (the planner; the randomizer sets it in its time split); `ownWarmupNote` says
 * that HIIT and timed sessions bring a short warm-up of their own when none is picked.
 */
export function WarmupRestControls({ lifting, onWarmupChange, lengthControl, ownWarmupNote }: { lifting: boolean; onWarmupChange?: () => void; lengthControl?: boolean; ownWarmupNote?: boolean }) {
  const warm = useStore((s) => s.genPrefs.warmup)
  const rest = useStore((s) => s.genPrefs.rest)
  const drops = useStore((s) => !!s.genPrefs.drops)
  const setGenPrefs = useStore((s) => s.setGenPrefs)
  const warmMinutes = useStore((s) => s.genPrefs.warmMinutes)
  const timed = warm.includes('cardio') || warm.includes('mobility')
  const length = warmMinutes ?? defaultWarmMinutes(warm)
  const setLength = (m: number) => setGenPrefs({ warmMinutes: Math.min(20, Math.max(3, m)) })
  const toggle = (k: WarmupKind) => { setGenPrefs({ warmup: warm.includes(k) ? warm.filter((x) => x !== k) : [...warm, k] }); onWarmupChange?.() }
  const parts = [
    warm.includes('cardio') && 'easy cardio',
    warm.includes('mobility') && 'dynamic mobility moves',
    warm.includes('sets') && lifting && 'light ramp-up sets before the heavy lifts',
  ].filter(Boolean) as string[]
  return (
    <>
      <h3 className={h3}>Warm-up <span className="normal-case">(optional)</span></h3>
      <div className="mb-1 flex flex-wrap gap-2">
        {/* Lifting: ramp-up sets first, as that's the usual way to warm up for heavy lifts. */}
        {((lifting ? [['sets', 'Warm-up sets'], ['cardio', 'Easy cardio'], ['mobility', 'Mobility']] : [['cardio', 'Easy cardio'], ['mobility', 'Mobility'], ['sets', 'Warm-up sets']]) as [WarmupKind, string][]).map(([k, l]) => (
          <button key={k} onClick={() => toggle(k)} aria-pressed={warm.includes(k)} disabled={k === 'sets' && !lifting} className={chip(warm.includes(k), k === 'sets' && !lifting)}>{l}</button>
        ))}
      </div>
      {lengthControl && timed && (
        <div className="mb-1 mt-2 flex items-center justify-between rounded-2xl bg-neutral-50 px-3 py-2">
          <span className="text-sm">Warm-up length</span>
          <span className="flex items-center gap-2">
            <button onClick={() => setLength(length - 1)} disabled={length <= 3} aria-label="Shorter warm-up" className="h-8 w-8 rounded-full bg-neutral-100 text-lg disabled:opacity-30">−</button>
            <span className="w-14 text-center text-sm tabular-nums">{length} min</span>
            <button onClick={() => setLength(length + 1)} disabled={length >= 20} aria-label="Longer warm-up" className="h-8 w-8 rounded-full bg-neutral-100 text-lg disabled:opacity-30">+</button>
          </span>
        </div>
      )}
      <p className="mb-5 text-xs text-neutral-400">
        {ownWarmupNote && !timed && 'HIIT and timed sessions start with a short warm-up of their own (about 5 minutes). '}
        {parts.length === 0
          ? lifting
            ? 'None picked. Warm-up sets are light ramp-up sets before your first two lifts, with weights suggested from your working weight. Easy cardio and mobility come first, with their own time.'
            : 'None picked. Easy cardio and mobility come first, with their own time.'
          : `${parts.join(', ').replace(/^./, (c) => c.toUpperCase())}. Included in the total time.`}
      </p>
      {lifting && (
        <>
          <h3 className={h3}>Rest between sets</h3>
          <div className="mb-1 flex gap-2">
            {([['short', 'Short'], ['normal', 'Normal'], ['long', 'Long']] as [RestPref, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setGenPrefs({ rest: k })} aria-pressed={rest === k} className={chip(rest === k)}>{l}</button>
            ))}
          </div>
          <p className="mb-5 text-xs text-neutral-400">
            {rest === 'short' ? 'About 1–1.5 min on heavy lifts, 45–60 s otherwise: more work in less time.' : rest === 'long' ? 'About 3+ min on heavy lifts and 2 min otherwise: best for strength.' : 'About 2–2.5 min on heavy lifts, 60–90 s on lighter ones.'} The time estimate uses this.
          </p>
          <h3 className={h3}>Drop sets</h3>
          <div className="mb-1 flex gap-2">
            <button onClick={() => setGenPrefs({ drops: !drops })} aria-pressed={drops} className={chip(drops)}>Add drop sets</button>
          </div>
          <p className="mb-5 text-xs text-neutral-400">{drops ? 'The last two weight lifts finish with 2 drop sets: about 20% lighter each time, to failure, no rest.' : 'Finish the last lifts by stripping weight and going again. You can also add them to any exercise from its ⋯ menu.'}</p>
        </>
      )}
    </>
  )
}
