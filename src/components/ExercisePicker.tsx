import { useMemo, useState } from 'react'
import { EXERCISES } from '../data/exercises'
import { hasGear } from '../lib/equipment'
import { BODY_PARTS } from '../lib/bodyParts'
import { isStaple, isTechnical } from '../lib/randomUtil'
import { useStore } from '../store'
import type { Exercise, ExerciseMode } from '../types'

interface Props {
  taken: Set<string>
  onPick: (e: Exercise) => void
  onClose: () => void
  /** e.g. "Swap Bench Press" (default "Add exercise"). */
  title?: string
  /** Body part to start on (e.g. the one being swapped). */
  initialGroup?: string
}

const GROUPS = ['All', ...BODY_PARTS, 'Forearms', 'Cardio', 'Conditioning', 'Mobility', 'Other']
// Body parts a new custom exercise can be filed under (the one being browsed).
const PARTS: string[] = [...BODY_PARTS, 'Forearms']
// Equipment filters; a few rarer kinds are folded into the closest one or "Other".
const EQUIPMENT = ['Any', 'Mine', 'Barbell', 'Dumbbell', 'Bodyweight', 'Cable', 'Machine', 'Kettlebell', 'Bands', 'Other'] as const
type Equip = (typeof EQUIPMENT)[number]
const equipOf = (e: Exercise): Equip => {
  const k = e.equipment ?? ''
  if (k === 'EZ bar') return 'Barbell'
  return (EQUIPMENT as readonly string[]).includes(k) && k !== 'Any' && k !== 'Mine' ? (k as Equip) : 'Other'
}
const equipLabel = (k: Equip) => (k === 'Any' ? 'any' : k === 'Mine' ? 'my equipment' : k)
const PAGE = 50
const squash = (t: string) => t.toLowerCase().replace(/[-\s]/g, '')
const ALIASES: Record<string, string> = {
  rdl: 'romanian deadlift', sldl: 'stiff legged', ohp: 'overhead press', db: 'dumbbell', bb: 'barbell', kb: 'kettlebell',
  bw: 'bodyweight', tri: 'tricep', bi: 'bicep', ghr: 'glute ham',
}
const rank = (e: Exercise) => (e.custom ? 0 : e.fullName ? 1 : e.suggest && isStaple(e) && !isTechnical(e) ? 2 : e.suggest ? 3 : 4)
const CREATE_AS: [string, 'strength' | 'cardio', ExerciseMode | undefined][] = [
  ['Weights', 'strength', 'weight'],
  ['Bodyweight reps', 'strength', 'reps'],
  ['Timed hold', 'strength', 'time'],
  ['Cardio', 'cardio', undefined],
]

export function ExercisePicker({ taken, onPick, onClose, title = 'Add exercise', initialGroup = 'All' }: Props) {
  const custom = useStore((s) => s.custom)
  const createCustom = useStore((s) => s.createCustom)
  // Remembered between visits: someone with a home gym usually wants the same equipment every time.
  const owned = useStore((s) => s.equipment)
  const logs = useStore((s) => s.logs)
  // What you've done lately comes first, most recent on top (like any gym log).
  const recent = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of logs) if ((m.get(l.exerciseId) ?? '') < l.date) m.set(l.exerciseId, l.date)
    return m
  }, [logs])
  // "My equipment" only makes sense once someone has said what they have.
  const saved = useStore((s) => s.pickerEquipment) as Equip
  const equip: Equip = saved === 'Mine' && !owned ? 'Any' : saved
  const setEquip = useStore((s) => s.setPickerEquipment)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState(GROUPS.includes(initialGroup) ? initialGroup : 'All')
  const [limit, setLimit] = useState(PAGE)
  const [gearOpen, setGearOpen] = useState(false)

  const query = q.trim().toLowerCase()
  // Gym shorthand works too (RDL, OHP, DB…), and hyphens and spaces don't matter (pushup finds Push-Up).
  const words = query.split(/\s+/).flatMap((w) => (ALIASES[w] ?? w).split(' ')).map(squash).filter(Boolean)
  const matches = (e: Exercise) => { const hay = squash(`${e.name} ${e.fullName ?? ''}`); return words.every((w) => hay.includes(w)) }
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
        // Your own exercises, then everyday lifts (Back Squat, Leg Curl…), then common moves, then the rest, A to Z.
        .sort((a, b) => (recent.get(b.id) ?? '').localeCompare(recent.get(a.id) ?? '') || rank(a) - rank(b) || a.name.localeCompare(b.name)),
    [inGroup, equip, recent],
  )
  const exact = results.some((e) => e.name.toLowerCase() === query)

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/30 sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-sm text-neutral-500">Done</button>
        </div>
        {/* Search, with the equipment filter as one button beside it (it opens a panel showing every option at once). */}
        <div className="mb-3 flex shrink-0 gap-2">
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }}
            placeholder={`Search ${EXERCISES.length}+ exercises`}
            className="min-w-0 flex-1 rounded-xl bg-neutral-100 px-4 py-2.5 outline-none"
          />
          <button
            onClick={() => setGearOpen(!gearOpen)}
            aria-expanded={gearOpen}
            aria-label={`Equipment filter: ${equipLabel(equip)}`}
            className={`flex shrink-0 items-center gap-1 rounded-xl px-3 text-sm ${equip === 'Any' ? 'bg-neutral-100 text-neutral-600' : 'bg-accent text-on-accent'}`}
          >
            <span className="max-w-[6.5rem] truncate">{equip === 'Any' ? 'Equipment' : equip === 'Mine' ? 'My gear' : equip}</span>
            <span aria-hidden className={`text-xs transition-transform ${gearOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>
        </div>
        {gearOpen && (
          <div className="mb-3 flex shrink-0 flex-wrap gap-2 rounded-2xl bg-neutral-50 p-2" role="group" aria-label="Equipment">
            {EQUIPMENT.filter((k) => k === 'Any' || k === equip || (k === 'Mine' ? !!owned : counts.get(k))).map((k) => (
              <button
                key={k}
                onClick={() => { setEquip(k); setLimit(PAGE); setGearOpen(false) }}
                aria-pressed={k === equip}
                className={`rounded-full px-3 py-1 text-sm ring-1 ${
                  k === equip ? 'bg-neutral-900 text-surface ring-neutral-900' : 'bg-surface text-neutral-600 ring-neutral-200'
                }`}
              >
                {k === 'Any' ? 'Any equipment' : k === 'Mine' ? `My equipment ${counts.get(k) ?? 0}` : `${k} ${counts.get(k) ?? 0}`}
              </button>
            ))}
          </div>
        )}
        <div className="mb-3 flex shrink-0 gap-2 overflow-x-auto pb-1" role="group" aria-label="Body part">
          {GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => { setGroup(g); setLimit(PAGE) }}
              aria-pressed={g === group}
              className={`shrink-0 rounded-full px-3 py-1 text-sm ${
                g === group ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {g}
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
                    onClick={() => { onPick(createCustom(q, kind, mode, PARTS.includes(group) ? group : undefined)); setQ('') }}
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
                <span className="shrink-0 text-xs text-neutral-400">{taken.has(e.id) ? 'Added' : group === 'All' ? `${e.group} · ${e.equipment}` : e.equipment}</span>
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
