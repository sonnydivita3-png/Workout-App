import { describeItem, groupByBlock } from '../lib/describe'
import { findExercise, useStore } from '../store'
import type { PlannedExercise } from '../types'

interface Props {
  items: PlannedExercise[]
  /** When given, each row gets swap / choose / remove buttons. */
  onSwap?: (index: number) => void
  onChoose?: (index: number) => void
  onRemove?: (index: number) => void
}

export function WorkoutList({ items, onSwap, onChoose, onRemove }: Props) {
  const custom = useStore((s) => s.custom)
  const units = useStore((s) => s.units)
  const editable = !!(onSwap || onChoose || onRemove)

  return (
    <div className="space-y-3">
      {groupByBlock(items).map((g, gi) => (
        <div key={gi} className={g.block ? 'rounded-2xl bg-neutral-50 px-3 py-2' : ''}>
          {g.block && g.label && <p className="pb-1 pt-0.5 text-[11px] uppercase tracking-wide text-neutral-500">{g.label}</p>}
          <ul className="divide-y divide-neutral-100">
            {g.items.map(({ item: p, index }) => {
              const ex = findExercise(custom, p.exerciseId)
              if (!ex) return null
              return (
                <li key={p.exerciseId} className="flex items-center justify-between gap-2 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate">{ex.name}</span>
                    <span className="text-xs tabular-nums text-neutral-400">
                      {[describeItem(p, ex, units), ex.group].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {editable && (
                    <span className="flex shrink-0 items-center gap-1 text-neutral-400">
                      {onSwap && <button onClick={() => onSwap(index)} aria-label={`Random swap for ${ex.name}`} title="Random swap" className="h-8 w-8 rounded-full text-lg hover:bg-neutral-100">↻</button>}
                      {onChoose && <button onClick={() => onChoose(index)} aria-label={`Choose a replacement for ${ex.name}`} title="Choose exercise" className="h-8 w-8 rounded-full text-base hover:bg-neutral-100">✎</button>}
                      {onRemove && <button onClick={() => onRemove(index)} aria-label={`Remove ${ex.name}`} className="h-8 w-8 rounded-full text-lg hover:bg-neutral-100">×</button>}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
