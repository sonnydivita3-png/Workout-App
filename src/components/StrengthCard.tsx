import { showWeight, storeWeight } from '../lib/units'
import { useStore } from '../store'
import type { Exercise, ExerciseLog, StrengthSet } from '../types'
import { NumberInput } from './NumberInput'

interface Props {
  exercise: Exercise
  setCount: number
  current?: ExerciseLog
  last?: ExerciseLog
  onSetCount: (n: number) => void
  onChange: (sets: StrengthSet[]) => void
  onRemove: () => void
}

export function StrengthCard({ exercise, setCount, current, last, onSetCount, onChange, onRemove }: Props) {
  const units = useStore((s) => s.units)
  const sets = Array.from({ length: setCount }, (_, i) => current?.sets?.[i] ?? { weight: null, reps: null })

  const update = (i: number, patch: Partial<StrengthSet>) =>
    onChange(sets.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200/70">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">{exercise.name}</h3>
          <p className="text-xs text-neutral-400">{exercise.group}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-neutral-400">
          <div className="flex items-center gap-1 text-sm">
            <button onClick={() => onSetCount(Math.max(1, setCount - 1))} className="h-6 w-6 rounded-full bg-neutral-100">−</button>
            <span className="w-12 text-center text-neutral-600">{setCount} sets</span>
            <button onClick={() => onSetCount(setCount + 1)} className="h-6 w-6 rounded-full bg-neutral-100">+</button>
          </div>
          <button onClick={onRemove} aria-label="Remove" className="text-lg leading-none">×</button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[1.5rem_1fr_1fr_5rem] gap-2 text-[11px] uppercase tracking-wide text-neutral-400">
          <span>Set</span><span className="text-center">{units.weight}</span><span className="text-center">Reps</span><span className="text-right">Last</span>
        </div>
        {sets.map((s, i) => {
          const prev = last?.sets?.[i]
          return (
            <div key={i} className="grid grid-cols-[1.5rem_1fr_1fr_5rem] items-center gap-2">
              <span className="text-sm text-neutral-400">{i + 1}</span>
              <NumberInput value={showWeight(s.weight, units)} step={units.weight === 'kg' ? 1 : 2.5} placeholder={showWeight(prev?.weight ?? null, units)?.toString() ?? '–'} onChange={(v) => update(i, { weight: storeWeight(v, units) })} />
              <NumberInput value={s.reps} placeholder={prev?.reps?.toString() ?? '–'} onChange={(v) => update(i, { reps: v })} />
              <span className="text-right text-xs text-neutral-400 tabular-nums">
                {prev?.weight != null ? `${showWeight(prev.weight, units)} × ${prev.reps ?? '–'}` : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
