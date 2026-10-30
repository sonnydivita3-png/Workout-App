import { useState } from 'react'
import { describeItem } from '../lib/describe'
import { hasDemo } from '../lib/moveDemos'
import type { Segment } from '../lib/wod'
import { findExercise, useStore } from '../store'
import type { Exercise, PlannedExercise } from '../types'
import { IntervalTimerSheet } from './IntervalTimerSheet'
import { MoveDemo } from './MoveDemo'
import { Sheet } from './Sheet'

/**
 * The warm-up block: easy cardio and mobility moves, each move with a demo, and a guided timer that shows them as it
 * goes. Not logged as progress; marking it done folds it to one line, like a finished exercise.
 */
export function WarmupCard({ date, items, onRemove }: { date: string; items: PlannedExercise[]; onRemove: () => void }) {
  const { custom, units, warmupsDone, setWarmupDone } = useStore()
  const [timer, setTimer] = useState(false)
  const [demo, setDemo] = useState<Exercise | null>(null)
  const done = warmupsDone.includes(date)
  // Folded once done; tapping opens it again until it's marked done or not done.
  const [fold, setFold] = useState<{ collapsed: boolean; whenDone: boolean } | null>(null)
  const collapsed = fold && fold.whenDone === done ? fold.collapsed : done
  const toggleFold = () => setFold({ collapsed: !collapsed, whenDone: done })
  const rows = items.map((p) => ({ p, ex: findExercise(custom, p.exerciseId) })).filter((r): r is { p: PlannedExercise; ex: Exercise } => !!r.ex)
  const minutes = Math.round(rows.reduce((a, { p }) => a + (p.est ?? (p.minutes ?? 0) + (p.seconds ?? 0) / 60), 0))

  // Cardio as one easy block, then each move with a short switch in between (showing the next move).
  const segments: Segment[] = []
  rows.forEach(({ p, ex }, i) => {
    const next = rows[i + 1]?.ex
    const demoOf = (e?: Exercise) => (e && hasDemo(e.id) ? { demo: e.id } : {})
    if (ex.kind === 'cardio') segments.push({ phase: 'work', seconds: Math.round((p.minutes ?? 5) * 60), label: `${ex.name}, easy`, detail: 'Build up gradually' })
    else segments.push({ phase: 'work', seconds: p.seconds ?? 30, label: ex.name, detail: `Move ${i + 1} of ${rows.length}`, ...demoOf(ex) })
    if (next) segments.push({ phase: 'rest', seconds: 10, label: 'Switch', detail: `Next: ${next.name}`, ...demoOf(next) })
  })

  if (collapsed) {
    return (
      <div className="flex items-start justify-between gap-2 rounded-2xl bg-surface px-4 py-3 shadow-sm ring-1 ring-neutral-200/70">
        <button onClick={toggleFold} className="min-w-0 text-left">
          <span className="block font-semibold">✓ Warm-up</span>
          <span className="block text-xs text-neutral-400">About {minutes} min · {rows.length} {rows.length === 1 ? 'part' : 'parts'}</span>
        </button>
        <button onClick={toggleFold} aria-label="Open warm-up" aria-expanded={false} className="-mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm leading-none text-neutral-400 hover:bg-neutral-100">⌄</button>
      </div>
    )
  }
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-neutral-500">Warm-up · about {minutes} min</p>
          <h3 className="font-semibold">Get loose first</h3>
        </div>
        <button onClick={() => confirm('Remove the warm-up from this day?') && onRemove()} aria-label="Remove warm-up" className="text-lg leading-none text-neutral-400">×</button>
      </div>
      <ul className="mb-3 divide-y divide-neutral-100">
        {rows.map(({ p, ex }) => (
          <li key={p.exerciseId} className="flex items-center justify-between gap-3 py-1.5 text-sm">
            {hasDemo(ex.id) ? (
              <button onClick={() => setDemo(ex)} aria-label={`Show how to do ${ex.name}`} className="flex min-w-0 items-center gap-3 text-left">
                <MoveDemo id={ex.id} name={ex.name} className="w-16 shrink-0 rounded-lg" />
                <span className="min-w-0 line-clamp-2">{ex.name}</span>
              </button>
            ) : <span className="min-w-0 line-clamp-2">{ex.name}</span>}
            <span className="shrink-0 text-xs tabular-nums text-neutral-400">{ex.kind === 'cardio' ? `${p.minutes} min easy` : describeItem(p, ex, units)}</span>
          </li>
        ))}
      </ul>
      <button onClick={() => setTimer(true)} className="w-full rounded-xl bg-neutral-100 py-2 text-sm font-medium text-neutral-700">⏱ Start warm-up</button>
      <button onClick={() => setWarmupDone(date, !done)} aria-pressed={done} className={`mt-2 w-full rounded-xl py-2.5 text-sm font-medium ${done ? 'bg-neutral-100 text-neutral-600' : 'bg-accent text-on-accent'}`}>
        {done ? 'Done ✓ · tap to undo' : '✓ Warm-up done'}
      </button>
      {timer && <IntervalTimerSheet title="Warm-up" segments={segments} onClose={() => setTimer(false)} onComplete={() => setWarmupDone(date, true)} completeLabel="✓ Mark warm-up done" />}
      {demo && (
        <Sheet title={demo.name} onClose={() => setDemo(null)}>
          <MoveDemo id={demo.id} name={demo.name} className="mb-3 w-full rounded-2xl" />
          <p className="pb-2 text-sm text-neutral-500">Start and end positions. Move smoothly between them, staying in a comfortable range.</p>
        </Sheet>
      )}
    </div>
  )
}
