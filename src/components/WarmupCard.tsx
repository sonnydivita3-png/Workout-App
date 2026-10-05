import { useState } from 'react'
import { describeItem } from '../lib/describe'
import type { Segment } from '../lib/wod'
import { findExercise, useStore } from '../store'
import type { Exercise, PlannedExercise } from '../types'
import { IntervalTimerSheet } from './IntervalTimerSheet'

/** The warm-up block: easy cardio and mobility moves with a guided timer. Not logged as progress. */
export function WarmupCard({ items, onRemove }: { items: PlannedExercise[]; onRemove: () => void }) {
  const { custom, units } = useStore()
  const [timer, setTimer] = useState(false)
  const rows = items.map((p) => ({ p, ex: findExercise(custom, p.exerciseId) })).filter((r): r is { p: PlannedExercise; ex: Exercise } => !!r.ex)
  const minutes = Math.round(rows.reduce((a, { p }) => a + (p.est ?? (p.minutes ?? 0) + (p.seconds ?? 0) / 60), 0))

  // Cardio as one easy block, then each move with a short switch in between.
  const segments: Segment[] = []
  rows.forEach(({ p, ex }, i) => {
    const next = rows[i + 1]?.ex.name
    if (ex.kind === 'cardio') segments.push({ phase: 'work', seconds: Math.round((p.minutes ?? 5) * 60), label: `${ex.name}, easy`, detail: 'Build up gradually' })
    else segments.push({ phase: 'work', seconds: p.seconds ?? 30, label: ex.name, detail: `Move ${i + 1} of ${rows.length}` })
    if (next) segments.push({ phase: 'rest', seconds: 10, label: 'Switch', detail: `Next: ${next}` })
  })

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
          <li key={p.exerciseId} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
            <span className="min-w-0 line-clamp-2">{ex.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-neutral-400">{ex.kind === 'cardio' ? `${p.minutes} min easy` : describeItem(p, ex, units)}</span>
          </li>
        ))}
      </ul>
      <button onClick={() => setTimer(true)} className="w-full rounded-xl bg-neutral-100 py-2 text-sm font-medium text-neutral-700">⏱ Start warm-up</button>
      {timer && <IntervalTimerSheet title="Warm-up" segments={segments} onClose={() => setTimer(false)} />}
    </div>
  )
}
