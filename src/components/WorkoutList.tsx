import { describeItem, groupByBlock } from '../lib/describe'
import { hyroxRoute, isHyroxBlock, runsAs } from '../lib/hyrox'
import { formatCardioTime } from '../lib/units'
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
      {groupByBlock(items).map((g, gi) => isHyroxBlock(g.block) ? (
        // Hyrox: the route, a line per station with the run before it, once through.
        (() => {
          const { run, runM, stations } = hyroxRoute(g.items)
          const runEx = run && findExercise(custom, run.item.exerciseId)
          return (
            <div key={gi} className="rounded-2xl bg-neutral-50 px-3 py-2">
              <p className="pt-0.5 text-xs uppercase tracking-wide text-neutral-500">{g.label}</p>
              <p className="pb-1 text-xs text-neutral-500">Once through: run{runM ? ` ${runM} m` : ''}, then the next station. {stations.length} runs, {stations.length} stations.</p>
              <ol aria-label="Hyrox route" className="divide-y divide-neutral-100">
                {stations.map(({ item: p, index }, n) => {
                  const ex = findExercise(custom, p.exerciseId)
                  if (!ex) return null
                  return (
                    <li key={p.exerciseId} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="w-4 shrink-0 text-right text-xs tabular-nums text-neutral-400">{n + 1}</span>
                        <span className="min-w-0">
                          <span className="text-neutral-400">{runM ? `${runM} m run → ` : 'Run → '}</span>
                          <span className="font-medium">{ex.name}</span>
                          <span className="text-neutral-500"> {describeItem(p, ex, units)}</span>
                        </span>
                      </span>
                      {editable && (
                        <span className="flex shrink-0 items-center text-neutral-400">
                          {onSwap && <button onClick={() => onSwap(index)} aria-label={`Random swap for ${ex.name}`} title="Random swap" className="h-7 w-7 rounded-full text-base hover:bg-neutral-100">↻</button>}
                          {onChoose && <button onClick={() => onChoose(index)} aria-label={`Choose a replacement for ${ex.name}`} title="Choose exercise" className="h-7 w-7 rounded-full text-sm hover:bg-neutral-100">✎</button>}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ol>
              {runEx && <p className="pt-1 text-xs text-neutral-500">Runs: {runsAs(runEx.name)}, about {formatCardioTime(run!.item.minutes ?? 0)} in all.</p>}
            </div>
          )
        })()
      ) : (
        <div key={gi} className={g.block ? 'rounded-2xl bg-neutral-50 px-3 py-2' : ''}>
          {g.block && g.label && <p className="pb-1 pt-0.5 text-xs uppercase tracking-wide text-neutral-500">{g.label}</p>}
          <ul className="divide-y divide-neutral-100">
            {g.items.map(({ item: p, index }) => {
              const ex = findExercise(custom, p.exerciseId)
              if (!ex) return null
              return (
                <li key={p.exerciseId} className="flex items-center justify-between gap-2 py-2.5">
                  <span className="min-w-0">
                    <span className="block line-clamp-2">{ex.name}</span>
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
