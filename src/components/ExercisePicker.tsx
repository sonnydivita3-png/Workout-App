import { useMemo, useState } from 'react'
import { EXERCISES } from '../data/exercises'
import type { Exercise } from '../types'

interface Props {
  taken: Set<string>
  onPick: (e: Exercise) => void
  onClose: () => void
}

const GROUPS = ['All', ...Array.from(new Set(EXERCISES.map((e) => e.group)))]

export function ExercisePicker({ taken, onPick, onClose }: Props) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('All')

  const results = useMemo(
    () =>
      EXERCISES.filter(
        (e) =>
          (group === 'All' || e.group === group) &&
          e.name.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [q, group],
  )

  return (
    <div className="fixed inset-0 z-10 flex items-end bg-black/30 sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-white p-4 sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add exercise</h2>
          <button onClick={onClose} className="text-sm text-neutral-500">Done</button>
        </div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search exercises"
          className="mb-3 w-full shrink-0 rounded-xl bg-neutral-100 px-4 py-2.5 outline-none"
        />
        <div className="mb-3 flex shrink-0 gap-2 overflow-x-auto pb-1">
          {GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={`shrink-0 rounded-full px-3 py-1 text-sm ${
                g === group ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <ul className="-mx-1 overflow-y-auto">
          {results.map((e) => (
            <li key={e.id}>
              <button
                disabled={taken.has(e.id)}
                onClick={() => onPick(e)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-neutral-50 disabled:opacity-40"
              >
                <span>{e.name}</span>
                <span className="text-xs text-neutral-400">{taken.has(e.id) ? 'Added' : e.equipment}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="px-3 py-6 text-center text-neutral-400">No matches</li>}
        </ul>
      </div>
    </div>
  )
}
