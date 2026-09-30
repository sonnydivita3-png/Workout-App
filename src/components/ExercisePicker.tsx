import { useMemo, useState } from 'react'
import { EXERCISES } from '../data/exercises'
import { hasGear } from '../lib/equipment'
import { useStore } from '../store'
import type { Exercise, ExerciseMode } from '../types'

interface Props {
  taken: Set<string>
  onPick: (e: Exercise) => void
  onClose: () => void
}

const GROUPS = ['All', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core', 'Cardio', 'Conditioning', 'Mobility', 'Other']
// Equipment filters; a few rarer kinds are folded into the closest one or "Other".
const EQUIPMENT = ['Any', 'Mine', 'Barbell', 'Dumbbell', 'Bodyweight', 'Cable', 'Machine', 'Kettlebell', 'Bands', 'Other'] as const
type Equip = (typeof EQUIPMENT)[number]
const equipOf = (e: Exercise): Equip => {
  const k = e.equipment ?? ''
  if (k === 'EZ bar') return 'Barbell'
  return (EQUIPMENT as readonly string[]).includes(k) && k !== 'Any' && k !== 'Mine' ? (k as Equip) : 'Other'
}
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
  // Remembered between visits: someone with a home gym usually wants the same equipment every time.
  const owned = useStore((s) => s.equipment)
  // "My equipment" only makes sense once someone has said what they have.
  const saved = useStore((s) => s.pickerEquipment) as Equip
  const equip: Equip = saved === 'Mine' && !owned ? 'Any' : saved
  const setEquip = useStore((s) => s.setPickerEquipment)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('All')
  const [limit, setLimit] = useState(PAGE)

  const query = q.trim().toLowerCase()
  const words = query.split(/\s+/)
  const matches = (e: Exercise) => words.every((w) => `${e.name} ${e.fullName ?? ''}`.toLowerCase().includes(w))
  // Muscle group and search first, so each equipment chip can say how many it would leave.
  const inGroup = useMemo(
    () => [...custom, ...EXERCISES].filter((e) => (group === 'All' || e.group === group) && matches(e)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [custom, query, group],
  )
  const counts = useMemo(() => {
    const c = new Map<Equip, number>()
    for (const e of inGroup) c.set(equipOf(e), (c.get(equipOf(e)) ?? 0) + 1)
    c.set('Mine', inGroup.filter(hasGear).length)
    return c
  }, [inGroup])
  const results = useMemo(
    () =>
      inGroup
        .filter((e) => equip === 'Any' || (equip === 'Mine' ? hasGear(e) : equipOf(e) === equip))
        // Your own exercises, then the everyday ones, then the rest alphabetically.
        .sort((a, b) => Number(!!b.custom) - Number(!!a.custom) || Number(!!b.suggest) - Number(!!a.suggest) || a.name.localeCompare(b.name)),
    [inGroup, equip],
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
        <div className="mb-3 flex shrink-0 gap-2 overflow-x-auto pb-1" role="group" aria-label="Equipment">
          {EQUIPMENT.filter((k) => k === 'Any' || k === equip || (k === 'Mine' ? !!owned : counts.get(k))).map((k) => (
            <button
              key={k}
              onClick={() => { setEquip(k); setLimit(PAGE) }}
              aria-pressed={k === equip}
              className={`shrink-0 rounded-full px-3 py-1 text-sm ring-1 ${
                k === equip ? 'bg-neutral-900 text-surface ring-neutral-900' : 'text-neutral-600 ring-neutral-200'
              }`}
            >
              {k === 'Any' ? 'Any equipment' : k === 'Mine' ? `My equipment ${counts.get(k) ?? 0}` : `${k} ${counts.get(k) ?? 0}`}
            </button>
          ))}
        </div>
        <p className="mb-1 shrink-0 text-xs text-neutral-400">{results.length} exercise{results.length === 1 ? '' : 's'}{equip === 'Mine' ? ' · my equipment' : equip !== 'Any' ? ` · ${equip.toLowerCase()}` : ''}{group !== 'All' ? ` · ${group.toLowerCase()}` : ''}</p>
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
          {results.length === 0 && !q.trim() && (
            <li className="px-3 py-6 text-center text-neutral-400">
              No matches.{equip !== 'Any' && <> <button onClick={() => setEquip('Any')} className="underline">Show any equipment</button></>}
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
