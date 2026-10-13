import { useMemo, useState } from 'react'
import { BUILTIN_BY_ID, EXERCISES } from '../data/exercises'
import { hasGear } from '../lib/equipment'
import { BODY_PARTS } from '../lib/bodyParts'
import { isStaple, isTechnical } from '../lib/randomUtil'
import { useStore } from '../store'
import type { Exercise } from '../types'
import { CUSTOM_GROUPS, sameName } from '../lib/customExercises'
import { matchesSearch, searchWords } from '../lib/exerciseSearch'
import { CustomExerciseSheet } from './CustomExercise'

interface Props {
  taken: Set<string>
  onPick: (e: Exercise) => void
  onClose: () => void
  /** e.g. "Swap Bench Press" (default "Add exercise"). */
  title?: string
  /** Muscle group to start on (e.g. the one being swapped). */
  initialGroup?: string
}

const GROUPS = ['All', 'Favorites', ...BODY_PARTS, 'Forearms', 'Cardio', 'Conditioning', 'Mobility', 'Other']
const PART_ORDER: string[] = [...BODY_PARTS, 'Forearms']
// Equipment filters; a few rarer kinds are folded into the closest one or "Other".
const EQUIPMENT = ['Any', 'Mine', 'Barbell', 'Dumbbell', 'Bodyweight', 'Cable', 'Machine', 'Kettlebell', 'Bands', 'Other'] as const
type Equip = (typeof EQUIPMENT)[number]
const equipOf = (e: Exercise): Equip => {
  const k = e.equipment ?? ''
  if (k === 'EZ bar') return 'Barbell'
  return (EQUIPMENT as readonly string[]).includes(k) && k !== 'Any' && k !== 'Mine' ? (k as Equip) : 'Other'
}
const fitsEquip = (e: Exercise, k: Equip) => k === 'Any' || (k === 'Mine' ? hasGear(e) : equipOf(e) === k)
const equipLabel = (k: Equip) => (k === 'Any' ? 'any' : k === 'Mine' ? 'my equipment' : k)
const PAGE = 50
const rank = (e: Exercise) => (e.custom ? 0 : e.fullName ? 1 : e.suggest && isStaple(e) && !isTechnical(e) ? 2 : e.suggest ? 3 : 4)
const partRank = (e: Exercise) => { const i = PART_ORDER.indexOf(e.group); return i < 0 ? PART_ORDER.length : i }

/** A filter as one button ("Equipment ▾", or what's chosen), which shows or hides its options. */
function FilterButton({ label, on, open, onClick, 'aria-label': ariaLabel }: { label: string; on: boolean; open: boolean; onClick: () => void; 'aria-label': string }) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      aria-label={ariaLabel}
      className={`flex min-w-0 flex-1 items-center justify-between gap-1 rounded-xl px-3 py-2 text-sm ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`}
    >
      <span className="truncate">{label}</span>
      <span aria-hidden className={`text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
    </button>
  )
}

function Option({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-3 py-1 text-sm ring-1 ${on ? 'bg-neutral-900 text-surface ring-neutral-900' : 'bg-surface text-neutral-600 ring-neutral-200'}`}
    >
      {children}
    </button>
  )
}

export function ExercisePicker({ taken, onPick, onClose, title = 'Add exercise', initialGroup = 'All' }: Props) {
  const custom = useStore((s) => s.custom)
  // An exercise of their own being made (with what was typed) or changed.
  const [making, setMaking] = useState<{ name?: string; exercise?: Exercise } | null>(null)
  // Starred exercises: listed first, all together under Favorites, and picked more often in generated workouts.
  const favorites = useStore((s) => s.favorites)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const isFav = (e: Exercise) => favorites.includes(e.id)
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
  // Which filter's options are showing (one at a time).
  const [open, setOpen] = useState<'muscle' | 'gear' | null>(null)
  const toggle = (f: 'muscle' | 'gear') => setOpen(open === f ? null : f)

  const query = q.trim().toLowerCase()
  // Gym shorthand works too (RDL, OHP, DB…), plurals, and the muscle group ("bicep curl", "dumbbell overhead press").
  const words = searchWords(query)
  const matches = (e: Exercise) => matchesSearch(e, words)
  // Retired exercises (no longer in the library) stay pickable for anyone who has logged them, or starred them.
  const yours = useMemo(
    () => [...new Set([...recent.keys(), ...favorites])].map((id) => BUILTIN_BY_ID.get(id)).filter((e): e is Exercise => !!e?.retired),
    [recent, favorites],
  )
  const all = useMemo(() => [...custom.filter((e) => !e.retired), ...EXERCISES, ...yours], [custom, yours])
  // Favorites with something typed searches everything (favorites still first).
  const inPart = (e: Exercise) => group === 'All' || (group === 'Favorites' ? !!query || favorites.includes(e.id) : e.group === group)
  // Muscle group and search first, so each equipment chip can say how many it would leave.
  const inGroup = useMemo(
    () => all.filter((e) => inPart(e) && matches(e)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, query, group, favorites],
  )
  // And search and equipment first, so each muscle group can say how many it has.
  const groupCounts = useMemo(() => {
    const c = new Map<string, number>()
    for (const e of all) {
      if (!matches(e) || !fitsEquip(e, equip)) continue
      c.set(e.group, (c.get(e.group) ?? 0) + 1)
      if (favorites.includes(e.id)) c.set('Favorites', (c.get('Favorites') ?? 0) + 1)
    }
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, query, equip, favorites])
  const counts = useMemo(() => {
    const c = new Map<Equip, number>()
    for (const e of inGroup) c.set(equipOf(e), (c.get(equipOf(e)) ?? 0) + 1)
    c.set('Mine', inGroup.filter(hasGear).length)
    return c
  }, [inGroup])
  const results = useMemo(
    () =>
      inGroup
        .filter((e) => fitsEquip(e, equip))
        // Favorites (by body part when they're all listed), then what you've done lately, then your own exercises,
        // everyday lifts (Back Squat, Leg Curl…), common moves, and the rest, A to Z.
        .sort((a, b) =>
          Number(favorites.includes(b.id)) - Number(favorites.includes(a.id))
          || (group === 'Favorites' && !query ? partRank(a) - partRank(b) : 0)
          || (recent.get(b.id) ?? '').localeCompare(recent.get(a.id) ?? '') || rank(a) - rank(b) || a.name.localeCompare(b.name)),
    [inGroup, equip, recent, favorites, group, query],
  )
  const exact = results.some((e) => sameName(e.name, query))

  return (
    <>
    <div className="fixed inset-0 z-20 flex items-end bg-black/30 sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-sm text-neutral-500">Done</button>
        </div>
        {/* Search, then the muscle group and equipment filters: each one button that opens a panel showing every option at once. */}
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }}
          placeholder={`Search ${EXERCISES.length} exercises`}
          className="mb-2 w-full shrink-0 rounded-xl bg-neutral-100 px-4 py-2.5 outline-none"
        />
        <div className="mb-3 flex shrink-0 gap-2">
          <FilterButton
            label={group === 'All' ? 'Muscle group' : group}
            aria-label={`Muscle group filter: ${group === 'All' ? 'all' : group}`}
            on={group !== 'All'}
            open={open === 'muscle'}
            onClick={() => toggle('muscle')}
          />
          <FilterButton
            label={equip === 'Any' ? 'Equipment' : equip === 'Mine' ? 'My gear' : equip}
            aria-label={`Equipment filter: ${equipLabel(equip)}`}
            on={equip !== 'Any'}
            open={open === 'gear'}
            onClick={() => toggle('gear')}
          />
        </div>
        {open === 'muscle' && (
          <div className="mb-3 flex shrink-0 flex-wrap gap-2 rounded-2xl bg-neutral-50 p-2" role="group" aria-label="Muscle group">
            {GROUPS.filter((g) => g === 'All' || g === 'Favorites' || g === group || groupCounts.get(g)).map((g) => (
              <Option key={g} on={g === group} onClick={() => { setGroup(g); setLimit(PAGE); setOpen(null) }}>
                {g === 'All' ? 'All muscle groups' : `${g} ${groupCounts.get(g) ?? 0}`}
              </Option>
            ))}
          </div>
        )}
        {open === 'gear' && (
          <div className="mb-3 flex shrink-0 flex-wrap gap-2 rounded-2xl bg-neutral-50 p-2" role="group" aria-label="Equipment">
            {EQUIPMENT.filter((k) => k === 'Any' || k === equip || (k === 'Mine' ? !!owned : counts.get(k))).map((k) => (
              <Option key={k} on={k === equip} onClick={() => { setEquip(k); setLimit(PAGE); setOpen(null) }}>
                {k === 'Any' ? 'Any equipment' : k === 'Mine' ? `My equipment ${counts.get(k) ?? 0}` : `${k} ${counts.get(k) ?? 0}`}
              </Option>
            ))}
          </div>
        )}
        <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs text-neutral-400">{results.length} exercise{results.length === 1 ? '' : 's'}{equip === 'Mine' ? ' · my equipment' : equip !== 'Any' ? ` · ${equip.toLowerCase()}` : ''}{group !== 'All' ? ` · ${group.toLowerCase()}` : ''}</p>
          <button onClick={() => setMaking({ name: q })} className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">+ Custom exercise</button>
        </div>
        <ul className="-mx-1 overflow-y-auto">
          {q.trim() && !exact && (
            <li className="mb-1">
              <button onClick={() => setMaking({ name: q })} className="w-full truncate rounded-xl bg-neutral-50 px-3 py-2.5 text-left text-sm">
                Can’t find it? <span className="font-medium">Create “{q.trim()}”</span>
              </button>
            </li>
          )}
          {results.slice(0, limit).map((e) => (
            <li key={e.id} className="flex items-center">
              <button
                disabled={taken.has(e.id)}
                onClick={() => onPick(e)}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl py-2.5 pl-3 pr-1 text-left hover:bg-neutral-50 disabled:opacity-40"
              >
                <span>{e.name}</span>
                <span className="shrink-0 text-xs text-neutral-400">{taken.has(e.id) ? 'Added' : group === 'All' || group === 'Favorites' ? `${e.group} · ${e.equipment}` : e.equipment}</span>
              </button>
              {e.custom && (
                <button onClick={() => setMaking({ exercise: e })} aria-label={`Edit ${e.name}`} title="Edit your exercise" className="flex h-10 w-8 shrink-0 items-center justify-center text-neutral-400">✎</button>
              )}
              {e.kind === 'strength' ? (
                <button
                  onClick={() => toggleFavorite(e.id)}
                  aria-pressed={isFav(e)}
                  aria-label={`Favorite: ${e.name}`}
                  title={isFav(e) ? 'Remove from favorites' : 'Add to favorites'}
                  className={`flex h-10 w-9 shrink-0 items-center justify-center text-lg leading-none ${isFav(e) ? 'text-amber-700' : 'text-neutral-300'}`}
                >
                  {isFav(e) ? '★' : '☆'}
                </button>
              ) : <span className="w-9 shrink-0" />}
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
              {group === 'Favorites' && favorites.length === 0
                ? <>No favorites yet. Tap ☆ next to an exercise to add it: favorites are listed first and turn up more in workouts made for you.</>
                : <>No matches.{equip !== 'Any' && <> <button onClick={() => setEquip('Any')} className="underline">Show any equipment</button></>}</>}
            </li>
          )}
        </ul>
      </div>
    </div>
    {making && (
      <CustomExerciseSheet
        exercise={making.exercise}
        name={making.name}
        group={CUSTOM_GROUPS.includes(group) ? group : undefined}
        // A new one goes straight in, like any exercise picked from the list.
        onSaved={(e) => { setMaking(null); if (!making.exercise) { setQ(''); onPick(e) } }}
        onUse={(e) => { setMaking(null); if (taken.has(e.id)) setQ(e.name); else onPick(e) }}
        onClose={() => setMaking(null)}
      />
    )}
    </>
  )
}
