import { formatPace, showDistance, storeDistance } from '../lib/units'
import { useStore } from '../store'
import type { CardioEntry, Exercise, ExerciseLog } from '../types'
import { NumberInput } from './NumberInput'

interface Props {
  exercise: Exercise
  current?: ExerciseLog
  last?: ExerciseLog
  onChange: (c: CardioEntry) => void
  onRemove: () => void
}

export function CardioCard({ exercise, current, last, onChange, onRemove }: Props) {
  const units = useStore((s) => s.units)
  const c = current?.cardio ?? { distance: null, minutes: null }
  const prev = last?.cardio
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200/70">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{exercise.name}</h3>
          <p className="text-xs text-neutral-400">Cardio</p>
        </div>
        <button onClick={onRemove} aria-label="Remove" className="text-lg leading-none text-neutral-400">×</button>
      </div>
      <div className="grid grid-cols-3 items-end gap-3">
        <label className="text-[11px] uppercase tracking-wide text-neutral-400">
          {units.distance === 'km' ? 'Km' : 'Miles'}
          <NumberInput value={showDistance(c.distance, units)} step={0.1} placeholder={showDistance(prev?.distance ?? null, units)?.toString() ?? '–'} onChange={(v) => onChange({ ...c, distance: storeDistance(v, units) })} />
        </label>
        <label className="text-[11px] uppercase tracking-wide text-neutral-400">
          Minutes
          <NumberInput value={c.minutes} step={0.5} placeholder={prev?.minutes?.toString() ?? '–'} onChange={(v) => onChange({ ...c, minutes: v })} />
        </label>
        <div className="text-[11px] uppercase tracking-wide text-neutral-400">
          Pace
          <div className="py-2 text-center text-base normal-case tabular-nums text-neutral-900">{formatPace(c.distance, c.minutes, units) ?? '–'}</div>
        </div>
      </div>
      {prev && (
        <p className="mt-2 text-xs text-neutral-400">
          Last time: {showDistance(prev.distance, units) ?? '–'} {units.distance} · {prev.minutes ?? '–'} min · {formatPace(prev.distance, prev.minutes, units) ?? '–'}
        </p>
      )}
    </div>
  )
}
