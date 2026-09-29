import { pace } from '../lib/dates'
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
          Miles
          <NumberInput value={c.distance} step={0.1} placeholder={prev?.distance?.toString() ?? '–'} onChange={(v) => onChange({ ...c, distance: v })} />
        </label>
        <label className="text-[11px] uppercase tracking-wide text-neutral-400">
          Minutes
          <NumberInput value={c.minutes} step={0.5} placeholder={prev?.minutes?.toString() ?? '–'} onChange={(v) => onChange({ ...c, minutes: v })} />
        </label>
        <div className="text-[11px] uppercase tracking-wide text-neutral-400">
          Pace
          <div className="py-2 text-center text-base normal-case tabular-nums text-neutral-900">{pace(c.distance, c.minutes) ?? '–'}</div>
        </div>
      </div>
      {prev && (
        <p className="mt-2 text-xs text-neutral-400">
          Last time: {prev.distance ?? '–'} mi · {prev.minutes ?? '–'} min · {pace(prev.distance, prev.minutes) ?? '–'}
        </p>
      )}
    </div>
  )
}
