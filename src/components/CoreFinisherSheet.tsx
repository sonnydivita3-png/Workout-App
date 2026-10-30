import { useMemo, useState } from 'react'
import { withGearFor } from '../lib/equipment'
import { dayPlanOf } from '../lib/plan'
import { CORE_FINISHERS, generateCoreFinisher } from '../lib/randomizer'
import { mulberry32 } from '../lib/randomUtil'
import { findExercise, useStore } from '../store'
import { primaryBtn, Sheet } from './Sheet'

const chip = (on: boolean) => `rounded-2xl px-3 py-2 text-left text-sm ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`

/** A few core moves to end the day with: how long sets how many different moves, two rounds through them. */
export function CoreFinisherSheet({ date, dayName, onClose }: { date: string; dayName: string; onClose: () => void }) {
  const s = useStore()
  const [minutes, setMinutes] = useState(10)
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9))
  const size = CORE_FINISHERS.find((c) => c.minutes === minutes)!
  const items = useMemo(() => {
    // Not what's already on the day (a plank in the workout isn't one in the finisher too).
    const there = new Set(dayPlanOf(s.plan, s.overrides, date).map((p) => p.exerciseId))
    return withGearFor(s.equipment, () => generateCoreFinisher(minutes, mulberry32(seed), there))
  }, [s.plan, s.overrides, s.equipment, date, minutes, seed])
  const add = () => {
    s.addPlanned(date, items)
    onClose()
  }

  return (
    <Sheet title="Core finisher" onClose={onClose} closeLabel="Cancel">
      <p className="mb-3 text-sm text-neutral-500">How long? More time, more different moves.</p>
      <div role="group" aria-label="How long" className="mb-4 grid grid-cols-2 gap-2">
        {CORE_FINISHERS.map((c) => (
          <button key={c.minutes} onClick={() => setMinutes(c.minutes)} aria-pressed={minutes === c.minutes} className={chip(minutes === c.minutes)}>
            <span className="block font-medium">{c.minutes} min</span>
            <span className="block text-xs opacity-80">{c.moves} moves</span>
          </button>
        ))}
      </div>
      <p className="mb-2 text-xs text-neutral-500">
        {size.rounds} rounds: {size.work}s of each move, {size.rest}s to switch, {size.roundRest}s rest between rounds. On the floor, no machines.
      </p>
      <ol aria-label="Core moves" className="mb-3 space-y-1 rounded-2xl bg-neutral-50 px-4 py-3 text-sm">
        {items.map((p, i) => (
          <li key={p.exerciseId} className="flex justify-between gap-2">
            <span>{i + 1}. {findExercise(s.custom, p.exerciseId)?.name ?? p.exerciseId}</span>
            {p.seconds && <span className="text-xs text-neutral-400">hold</span>}
          </li>
        ))}
      </ol>
      <button onClick={() => setSeed((n) => n + 1)} className="mb-4 w-full rounded-2xl bg-neutral-100 py-2.5 text-sm text-neutral-600">↻ Different moves</button>
      <button onClick={add} disabled={items.length === 0} className={primaryBtn}>Add to {dayName}</button>
    </Sheet>
  )
}
