import { useState } from 'react'
import { storeWeight } from '../lib/units'
import { findExercise, useStore } from '../store'
import { ExercisePicker } from './ExercisePicker'
import { NumberInput } from './NumberInput'
import { primaryBtn, Sheet } from './Sheet'

type Kind = 'workouts' | 'bodyweight' | 'lift'

const KINDS: { id: Kind; label: string }[] = [
  { id: 'workouts', label: 'Workouts / week' },
  { id: 'bodyweight', label: 'Body weight' },
  { id: 'lift', label: 'Lift' },
]

export function GoalSheet({ onClose }: { onClose: () => void }) {
  const { units, bodyweight, custom, addGoal } = useStore()
  const [kind, setKind] = useState<Kind>('workouts')
  const [perWeek, setPerWeek] = useState<number | null>(4)
  const [target, setTarget] = useState<number | null>(null)
  const [exerciseId, setExerciseId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  const exercise = exerciseId ? findExercise(custom, exerciseId) : undefined
  const valid = kind === 'workouts' ? !!perWeek && perWeek >= 1 && perWeek <= 7 : !!target && (kind === 'bodyweight' || !!exercise)

  const save = () => {
    if (kind === 'workouts') addGoal({ type: 'workouts', perWeek: perWeek! })
    else if (kind === 'bodyweight')
      addGoal({ type: 'bodyweight', target: storeWeight(target, units)!, start: bodyweight.at(-1)?.lb ?? null })
    else addGoal({ type: 'lift', exerciseId: exerciseId!, target: storeWeight(target, units)! })
    onClose()
  }

  return (
    <>
      <Sheet title="New goal" onClose={onClose} closeLabel="Cancel">
        <div className="mb-4 flex gap-2">
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              className={`rounded-full px-3 py-1 text-sm ${k.id === kind ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}
            >
              {k.label}
            </button>
          ))}
        </div>

        {kind === 'workouts' && (
          <label className="mb-4 block text-sm text-neutral-500">
            Days per week (1–7)
            <div className="mt-1 w-24"><NumberInput value={perWeek} onChange={setPerWeek} /></div>
          </label>
        )}

        {kind === 'lift' && (
          <button
            onClick={() => setPicking(true)}
            className="mb-3 flex w-full items-center justify-between rounded-xl bg-neutral-100 px-4 py-2.5 text-left"
          >
            <span className={exercise ? '' : 'text-neutral-400'}>{exercise?.name ?? 'Choose an exercise'}</span>
            <span className="text-neutral-300">›</span>
          </button>
        )}

        {kind !== 'workouts' && (
          <label className="mb-4 block text-sm text-neutral-500">
            Target ({units.weight})
            <div className="mt-1 w-28"><NumberInput value={target} step={kind === 'lift' ? 2.5 : 0.5} onChange={setTarget} /></div>
          </label>
        )}

        <button disabled={!valid} onClick={save} className={primaryBtn}>Add goal</button>
      </Sheet>

      {picking && (
        <ExercisePicker
          taken={new Set()}
          onPick={(e) => { if (e.kind === 'strength') { setExerciseId(e.id); setPicking(false) } }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}
