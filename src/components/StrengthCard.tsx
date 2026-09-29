import { formatSeconds, showWeight, storeWeight } from '../lib/units'
import { useStore } from '../store'
import type { Exercise, ExerciseLog, StrengthSet } from '../types'
import { NumberInput } from './NumberInput'

interface Props {
  exercise: Exercise
  setCount: number
  targetReps?: number
  targetSeconds?: number
  note?: string
  current?: ExerciseLog
  last?: ExerciseLog
  onSetCount: (n: number) => void
  onChange: (sets: StrengthSet[]) => void
  onRemove: () => void
}

export function StrengthCard({ exercise, setCount, targetReps, targetSeconds, note, current, last, onSetCount, onChange, onRemove }: Props) {
  const units = useStore((s) => s.units)
  const mode = exercise.mode ?? 'weight'
  const sets = Array.from({ length: setCount }, (_, i) => current?.sets?.[i] ?? { weight: null, reps: null, seconds: null })

  const update = (i: number, patch: Partial<StrengthSet>) =>
    onChange(sets.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  const target = mode === 'time' ? (targetSeconds ? `${setCount} × ${targetSeconds}s` : '') : targetReps ? `${setCount} × ${targetReps}` : ''
  const cols = mode === 'weight' ? 'grid-cols-[1.5rem_1fr_1fr_5rem]' : 'grid-cols-[1.5rem_1fr_5rem]'
  const lastText = (p?: StrengthSet) => {
    if (!p) return '—'
    if (mode === 'time') return p.seconds ? formatSeconds(p.seconds) : '—'
    if (mode === 'reps') return p.reps ? `${p.reps} reps` : '—'
    return p.weight != null ? `${showWeight(p.weight, units)} × ${p.reps ?? '–'}` : '—'
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200/70">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">{exercise.name}</h3>
          <p className="text-xs text-neutral-400">
            {exercise.group}
            {mode === 'time' && ' · timed'}
            {target && ` · target ${target}`}
            {note && ` · ${note}`}
          </p>
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
        <div className={`grid ${cols} gap-2 text-[11px] uppercase tracking-wide text-neutral-400`}>
          <span>Set</span>
          {mode === 'weight' && <span className="text-center">{units.weight}</span>}
          <span className="text-center">{mode === 'time' ? 'Seconds' : 'Reps'}</span>
          <span className="text-right">Last</span>
        </div>
        {sets.map((s, i) => {
          const prev = last?.sets?.[i]
          return (
            <div key={i} className={`grid ${cols} items-center gap-2`}>
              <span className="text-sm text-neutral-400">{i + 1}</span>
              {mode === 'weight' && (
                <NumberInput
                  value={showWeight(s.weight, units)}
                  step={units.weight === 'kg' ? 1 : 2.5}
                  placeholder={showWeight(prev?.weight ?? null, units)?.toString() ?? '–'}
                  onChange={(v) => update(i, { weight: storeWeight(v, units) })}
                />
              )}
              {mode === 'time' ? (
                <NumberInput value={s.seconds ?? null} step={5} placeholder={(prev?.seconds ?? targetSeconds)?.toString() ?? '–'} onChange={(v) => update(i, { seconds: v })} />
              ) : (
                <NumberInput value={s.reps} placeholder={(prev?.reps ?? targetReps)?.toString() ?? '–'} onChange={(v) => update(i, { reps: v })} />
              )}
              <span className="text-right text-xs tabular-nums text-neutral-400">{lastText(prev)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
