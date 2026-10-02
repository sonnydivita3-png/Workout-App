import { fmtLong } from '../lib/dates'
import { dropSetsOf, formatSet, workSets } from '../lib/progression'
import { cardioLine } from '../lib/units'
import { useStore } from '../store'
import type { Exercise, StrengthSet } from '../types'
import { Sheet } from './Sheet'

/** Recent sessions of one exercise, right from the workout (what you did, set by set). */
export function ExerciseHistorySheet({ exercise, before, onClose }: { exercise: Exercise; before: string; onClose: () => void }) {
  const units = useStore((s) => s.units)
  const logs = useStore((s) => s.logs)
    .filter((l) => l.exerciseId === exercise.id && l.date < before && (l.cardio ? l.cardio.distance || l.cardio.minutes : workSets(l).length))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)
  const mode = exercise.mode ?? 'weight'
  const setText = (p: StrengthSet) => formatSet(p, mode, units)
  return (
    <Sheet title={`${exercise.name} · history`} onClose={onClose}>
      {logs.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-400">Nothing logged before this day yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {logs.map((l) => (
            <li key={l.date} className="py-2.5">
              <p className="text-sm font-medium">{fmtLong(l.date)}</p>
              <p className="text-sm tabular-nums text-neutral-500">
                {l.cardio
                  ? cardioLine(l.cardio, exercise.id, units)
                  : `${workSets(l).map(setText).join(' · ')}${dropSetsOf(l).length ? ` · drops ${dropSetsOf(l).map(setText).join(', ')}` : ''}`}
              </p>
              {l.note && <p className="text-xs text-neutral-400">“{l.note}”</p>}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
