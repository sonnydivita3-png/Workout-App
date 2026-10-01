import type { RestPref } from '../lib/timing'
import { useStore, type WarmupKind } from '../store'

const chip = (on: boolean, disabled = false) =>
  `rounded-full px-3 py-1.5 text-sm ${disabled ? 'bg-neutral-100 text-neutral-300' : on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`
const h3 = 'mb-2 text-sm font-semibold text-neutral-700'

/** Warm-up choices and rest length, remembered between uses. Shared by the randomizer and the week/month planner. */
export function WarmupRestControls({ lifting, onWarmupChange }: { lifting: boolean; onWarmupChange?: () => void }) {
  const warm = useStore((s) => s.genPrefs.warmup)
  const rest = useStore((s) => s.genPrefs.rest)
  const drops = useStore((s) => !!s.genPrefs.drops)
  const setGenPrefs = useStore((s) => s.setGenPrefs)
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
        {([['cardio', 'Easy cardio'], ['mobility', 'Mobility'], ['sets', 'Warm-up sets']] as [WarmupKind, string][]).map(([k, l]) => (
          <button key={k} onClick={() => toggle(k)} aria-pressed={warm.includes(k)} disabled={k === 'sets' && !lifting} className={chip(warm.includes(k), k === 'sets' && !lifting)}>{l}</button>
        ))}
      </div>
      <p className="mb-5 text-xs text-neutral-400">
        {parts.length === 0
          ? 'Easy cardio and mobility come first; warm-up sets are light ramp-up sets before your heavy lifts.'
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
