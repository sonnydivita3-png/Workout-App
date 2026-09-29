import { useMemo, useState } from 'react'
import { EXERCISES } from '../data/exercises'
import { useStore } from '../store'
import type { Exercise, ExerciseMode } from '../types'

interface Props {
  taken: Set<string>
  onPick: (e: Exercise) => void
  onClose: () => void
}

const GROUPS = ['All', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core', 'Cardio', 'Other']
const PAGE = 50
const CREATE_AS: [string, 'strength' | 'cardio', ExerciseMode | undefined][] = [
  ['Weights', 'strength', 'weight'],
  ['Bodyweight reps', 'strength', 'reps'],
  ['Timed hold', 'strength', 'time'],
  ['Cardio', 'cardio', undefined],
]

export function ExercisePicker({ taken, onPick, onClose }: Props) {
  const custom = useStore((s) => s.custom)
  const createCustom = useStore((s) => s.createCustom)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('All')
  const [limit, setLimit] = useState(PAGE)

  const query = q.trim().toLowerCase()
  const results = useMemo(
    () =>
      [...custom, ...EXERCISES].filter(
        (e) =>
          (group === 'All' || e.group === group) &&
          query.split(/\s+/).every((w) => e.name.toLowerCase().includes(w)),
      ),
    [custom, query, group],
  )
  const exact = results.some((e) => e.name.toLowerCase() === query)

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/30 sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h2 className="text-lg font-semibold">Add exercise</h2>
          <button onClick={onClose} className="text-sm text-neutral-500">Done</button>
        </div>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }}
          placeholder={`Search ${EXERCISES.length}+ exercises`}
          className="mb-3 w-full shrink-0 rounded-xl bg-neutral-100 px-4 py-2.5 outline-none"
        />
        <div className="mb-3 flex shrink-0 gap-2 overflow-x-auto pb-1">
          {GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => { setGroup(g); setLimit(PAGE) }}
              className={`shrink-0 rounded-full px-3 py-1 text-sm ${
                g === group ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <ul className="-mx-1 overflow-y-auto">
          {q.trim() && !exact && (
            <li className="mb-1 rounded-xl bg-neutral-50 px-3 py-2.5">
              <span className="mb-2 block truncate text-sm">Create “{q.trim()}” as</span>
              <span className="flex flex-wrap gap-2 text-xs">
                {CREATE_AS.map(([label, kind, mode]) => (
                  <button
                    key={label}
                    onClick={() => { onPick(createCustom(q, kind, mode)); setQ('') }}
                    className="rounded-full bg-accent px-3 py-1 text-on-accent"
                  >
                    {label}
                  </button>
                ))}
              </span>
            </li>
          )}
          {results.slice(0, limit).map((e) => (
            <li key={e.id}>
              <button
                disabled={taken.has(e.id)}
                onClick={() => onPick(e)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-neutral-50 disabled:opacity-40"
              >
                <span>{e.name}</span>
                <span className="shrink-0 text-xs text-neutral-400">{taken.has(e.id) ? 'Added' : e.equipment}</span>
              </button>
            </li>
          ))}
          {results.length > limit && (
            <li>
              <button onClick={() => setLimit(limit + PAGE)} className="w-full py-3 text-sm text-neutral-500">
                Show more ({results.length - limit})
              </button>
            </li>
          )}
          {results.length === 0 && !q.trim() && <li className="px-3 py-6 text-center text-neutral-400">No matches</li>}
        </ul>
      </div>
    </div>
  )
}
