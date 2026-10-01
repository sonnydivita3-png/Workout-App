import { resultsFor } from '../lib/conditioning'
import { formatResult, wodOf, wodTitle } from '../lib/wod'
import { useStore } from '../store'
import { rowBtn, Sheet } from './Sheet'

/** Add a saved benchmark to a day, to repeat it and compare with last time. */
export function BenchmarkSheet({ date, dayName, onClose }: { date: string; dayName: string; onClose: () => void }) {
  const { benchmarks, timedLogs, addBenchmark, deleteBenchmark } = useStore()
  return (
    <Sheet title="Benchmark workouts" onClose={onClose}>
      {benchmarks.length === 0 && <p className="py-6 text-center text-sm text-neutral-400">None saved yet. Tap ☆ Save as benchmark on any timed workout.</p>}
      {benchmarks.map((b) => {
        const wod = wodOf(b.items)
        const last = wod ? resultsFor(timedLogs, { kind: wod.kind, movements: b.items.map((p) => p.exerciseId) }).at(-1) : undefined
        return (
          <div key={b.id} className="flex items-center gap-2">
            <button onClick={() => { addBenchmark(date, b.id); onClose() }} className={`${rowBtn} flex-1`}>
              <span className="min-w-0">
                <span className="block text-sm font-medium">★ {b.name}</span>
                <span className="block text-xs text-neutral-400">{wod ? wodTitle(wod) : ''}{last ? ` · last: ${formatResult(last)}` : ' · not done yet'}</span>
              </span>
              <span className="text-neutral-300">›</span>
            </button>
            <button onClick={() => confirm(`Delete the benchmark “${b.name}”? Its results stay in your history.`) && deleteBenchmark(b.id)} aria-label={`Delete ${b.name}`} className="px-2 text-lg text-neutral-400">×</button>
          </div>
        )
      })}
      <p className="pt-2 text-xs text-neutral-400">Adds it to {dayName}. Repeat a benchmark every few weeks to see real progress.</p>
    </Sheet>
  )
}
