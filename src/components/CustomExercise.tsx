import { useState } from 'react'
import { CUSTOM_GROUPS, MODE_CHOICES, cleanName, customDetail, defaultMode, equipmentFor, findDuplicate, kindOf, usageOf } from '../lib/customExercises'
import { modeOf } from '../lib/exerciseModes'
import { useStore } from '../store'
import type { Exercise, ExerciseMode } from '../types'
import { Sheet, primaryBtn } from './Sheet'

function Chips({ label, options, value, onChange, disabled }: { label: string; options: string[]; value: string | null; onChange: (v: string) => void; disabled?: (v: string) => boolean }) {
  return (
    <>
      <p className="mb-1.5 mt-4 text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            disabled={disabled?.(o)}
            aria-pressed={o === value}
            className={`rounded-full px-3 py-1 text-sm disabled:opacity-30 ${o === value ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`}
          >
            {o}
          </button>
        ))}
      </div>
    </>
  )
}

interface Props {
  /** The exercise being changed; none for a new one. */
  exercise?: Exercise
  /** For a new one: what was typed in search, and the body part being browsed. */
  name?: string
  group?: string
  onSaved: (e: Exercise) => void
  /** Go with an exercise already in the list instead (offered when the name is taken). */
  onUse?: (e: Exercise) => void
  onClose: () => void
}

/** An exercise of their own: name, body part, equipment and how it's logged. Saved with the rest of their workouts. */
export function CustomExerciseSheet({ exercise, name: typed = '', group: browsing, onSaved, onUse, onClose }: Props) {
  const custom = useStore((s) => s.custom)
  const createCustom = useStore((s) => s.createCustom)
  const updateCustom = useStore((s) => s.updateCustom)
  const removeCustom = useStore((s) => s.removeCustom)
  // Worked out once: once it's logged or planned it stays lifting or cardio, and deleting it only hides it.
  const [usage] = useState(() => (exercise ? usageOf(useStore.getState() as unknown as Record<string, unknown>, exercise.id) : { days: 0, used: false }))
  const [name, setName] = useState(exercise?.name ?? cleanName(typed))
  const [group, setGroup] = useState<string | null>(exercise?.group ?? (browsing && CUSTOM_GROUPS.includes(browsing) ? browsing : null))
  const [equipment, setEquipment] = useState<string | null>(exercise && equipmentFor(exercise.group).includes(exercise.equipment ?? '') ? exercise.equipment! : null)
  // How sets are logged follows the equipment (bodyweight: reps only) until they choose.
  const [mode, setMode] = useState<ExerciseMode | null>(exercise?.kind === 'strength' ? modeOf(exercise) ?? 'weight' : null)
  const [deleting, setDeleting] = useState(false)

  const kind = group ? kindOf(group) : null
  const locked = exercise && usage.used ? exercise.kind : null
  const track = kind === 'strength' ? mode ?? defaultMode(group, equipment) : undefined
  const taken = findDuplicate(name, custom, exercise?.id)
  const ready = !!cleanName(name) && !!group && !!equipment && !taken

  const pickGroup = (g: string) => {
    setGroup(g)
    if (equipment && !equipmentFor(g).includes(equipment)) setEquipment(null)
  }
  const save = () => {
    if (!ready) return
    const input = { name, group: group!, equipment: equipment!, mode: track }
    const saved = exercise ? updateCustom(exercise.id, input) : createCustom(input)
    if (saved) onSaved(saved)
  }

  return (
    <Sheet title={exercise ? 'Edit exercise' : 'New exercise'} onClose={onClose} closeLabel="Cancel">
      <label htmlFor="custom-exercise-name" className="mb-1.5 block text-sm font-medium">Name</label>
      <input
        id="custom-exercise-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        autoFocus={!name}
        placeholder="e.g. Landmine Press"
        className="w-full rounded-xl bg-neutral-100 px-4 py-2.5 outline-none"
      />
      {taken && (
        <p className="mt-2 text-xs text-amber-800">
          “{taken.name}” is already in the list{taken.custom ? ' (one of yours)' : ''}.
          {onUse && <> <button onClick={() => onUse(taken)} className="font-medium underline underline-offset-2">Use it</button></>}
        </p>
      )}
      <Chips label="Body part" options={CUSTOM_GROUPS} value={group} onChange={pickGroup} disabled={(g) => !!locked && kindOf(g) !== locked} />
      {locked && (
        <p className="mt-1.5 text-xs text-neutral-400">
          {usage.days ? `Logged on ${usage.days} day${usage.days === 1 ? '' : 's'}` : 'In your plans'}, so it stays {locked === 'cardio' ? 'cardio' : 'a lifting exercise'}.
        </p>
      )}
      <Chips label="Equipment" options={equipmentFor(group)} value={equipment} onChange={setEquipment} />
      {kind === 'strength' && <Chips label="Log it with" options={MODE_CHOICES.map(([, l]) => l)} value={MODE_CHOICES.find(([m]) => m === track)![1]} onChange={(l) => setMode(MODE_CHOICES.find(([, x]) => x === l)![0])} />}
      {kind === 'cardio' && <p className="mt-4 text-sm text-neutral-500">Logged with time and distance, like other cardio.</p>}
      <button onClick={save} disabled={!ready} className={`${primaryBtn} mt-5`}>{exercise ? 'Save changes' : 'Save exercise'}</button>
      {!ready && !taken && <p className="mt-2 text-center text-xs text-neutral-400">{!cleanName(name) ? 'Give it a name' : !group ? 'Pick a body part' : 'Pick the equipment'}</p>}
      {exercise && (
        <div className="mt-4 flex justify-center gap-4 text-sm">
          {deleting ? (
            <>
              <span className="text-neutral-500">Delete it?{usage.days ? ' Your history keeps it.' : usage.used ? ' Plans with it keep it.' : ''}</span>
              <button onClick={() => { removeCustom(exercise.id); onClose() }} className="font-medium text-red-600">Delete</button>
              <button onClick={() => setDeleting(false)} className="text-neutral-500">Keep</button>
            </>
          ) : (
            <button onClick={() => setDeleting(true)} className="text-red-600">Delete exercise</button>
          )}
        </div>
      )}
    </Sheet>
  )
}

/** Their own exercises (Settings → Workouts): change, delete or add one. */
export function CustomExercisesList() {
  const custom = useStore((s) => s.custom)
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null)
  const mine = custom.filter((e) => !e.retired).sort((a, b) => a.name.localeCompare(b.name))
  return (
    <>
      <ul className="divide-y divide-neutral-100 rounded-2xl bg-surface ring-1 ring-neutral-200/70" aria-label="Your own exercises">
        {mine.map((e) => (
          <li key={e.id}>
            <button onClick={() => setEditing(e)} aria-label={`Edit ${e.name}`} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{e.name}</span>
                <span className="block truncate text-xs text-neutral-400">{customDetail(e)}</span>
              </span>
              <span aria-hidden className="text-neutral-300">›</span>
            </button>
          </li>
        ))}
        <li>
          <button onClick={() => setEditing('new')} className="w-full px-3 py-2.5 text-left text-sm font-medium text-neutral-700">+ New exercise</button>
        </li>
      </ul>
      {editing && (
        <CustomExerciseSheet
          key={editing === 'new' ? 'new' : editing.id}
          exercise={editing === 'new' ? undefined : editing}
          onSaved={() => setEditing(null)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
