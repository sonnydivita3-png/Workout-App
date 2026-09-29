import { useState } from 'react'
import { FOCUS_OPTIONS, generateWorkout, LIFT_GROUPS, minutesFor, swapExercise } from '../lib/randomizer'
import { findExercise, useStore } from '../store'
import type { PlannedExercise } from '../types'
import { primaryBtn, Sheet } from './Sheet'

const DURATIONS = [20, 30, 45, 60, 75, 90]
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const chip = (on: boolean) =>
  `rounded-full px-3 py-1.5 text-sm ${on ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`

export function RandomizerSheet({ day, onClose }: { day: number; onClose: () => void }) {
  const { custom, addPlanned, saveRoutine } = useStore()
  const [focus, setFocus] = useState<string[]>([])
  const [minutes, setMinutes] = useState(45)
  const [items, setItems] = useState<PlannedExercise[] | null>(null)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)

  const toggle = (g: string) => setFocus((f) => (f.includes(g) ? f.filter((x) => x !== g) : [...f, g]))
  const fullBody = LIFT_GROUPS.every((g) => focus.includes(g))
  const defaultName = `${focus.length > 3 ? 'Full body' : focus.join(' + ')} · ${minutes} min`

  const generate = (avoid?: PlannedExercise[]) => {
    setItems(generateWorkout(focus, minutes, Math.random, new Set(avoid?.map((p) => p.exerciseId))))
    setSaved(false)
    setNaming(false)
  }

  if (!items) {
    return (
      <Sheet title="Randomize workout" onClose={onClose} closeLabel="Cancel">
        <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-400">What are you training?</h3>
        <div className="mb-2 flex flex-wrap gap-2">
          {FOCUS_OPTIONS.map((g) => (
            <button key={g} onClick={() => toggle(g)} className={chip(focus.includes(g))}>{g}</button>
          ))}
        </div>
        <button
          onClick={() => setFocus(fullBody ? focus.filter((g) => g === 'Cardio') : [...LIFT_GROUPS, ...focus.filter((g) => g === 'Cardio')])}
          className="mb-5 text-sm text-neutral-500 underline-offset-2 hover:underline"
        >
          {fullBody ? 'Clear body parts' : 'Select full body'}
        </button>

        <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-400">How long?</h3>
        <div className="mb-6 flex flex-wrap gap-2">
          {DURATIONS.map((m) => (
            <button key={m} onClick={() => setMinutes(m)} className={chip(m === minutes)}>{m} min</button>
          ))}
        </div>

        <button disabled={focus.length === 0} onClick={() => generate()} className={primaryBtn}>Generate workout</button>
      </Sheet>
    )
  }

  const total = minutesFor(items)

  return (
    <Sheet title="Your workout" onClose={onClose} closeLabel="Close">
      <p className="mb-3 text-sm text-neutral-400">{focus.join(' · ')} · about {Math.round(total)} min</p>
      {items.length === 0 ? (
        <p className="py-6 text-center text-neutral-400">Couldn’t build a workout for that. Try another mix.</p>
      ) : (
        <ul className="mb-4 divide-y divide-neutral-100">
          {items.map((p, i) => {
            const ex = findExercise(custom, p.exerciseId)
            if (!ex) return null
            return (
              <li key={p.exerciseId} className="flex items-center justify-between gap-2 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate">{ex.name}</span>
                  <span className="text-xs tabular-nums text-neutral-400">
                    {ex.kind === 'cardio' ? `${p.minutes} min` : `${p.sets} × ${p.reps}`} · {ex.group}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-neutral-400">
                  <button onClick={() => setItems(swapExercise(items, i))} aria-label={`Swap ${ex.name}`} className="h-8 w-8 rounded-full text-lg hover:bg-neutral-100">↻</button>
                  <button onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label={`Remove ${ex.name}`} className="h-8 w-8 rounded-full text-lg hover:bg-neutral-100">×</button>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {naming ? (
        <div className="mb-3 flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={defaultName}
            className="min-w-0 flex-1 rounded-xl bg-neutral-100 px-4 py-2.5 outline-none"
          />
          <button
            onClick={() => { saveRoutine(name.trim() || defaultName, items); setSaved(true); setNaming(false) }}
            className="rounded-xl bg-neutral-900 px-4 text-sm text-white"
          >
            Save
          </button>
        </div>
      ) : (
        <div className="mb-3 flex gap-2">
          <button onClick={() => generate(items)} className="flex-1 rounded-2xl bg-neutral-100 py-3 text-sm font-medium">Reroll</button>
          <button
            disabled={items.length === 0 || saved}
            onClick={() => setNaming(true)}
            className="flex-1 rounded-2xl bg-neutral-100 py-3 text-sm font-medium disabled:opacity-40"
          >
            {saved ? 'Saved ✓' : 'Save as routine'}
          </button>
        </div>
      )}

      <button
        disabled={items.length === 0}
        onClick={() => { addPlanned(day, items); onClose() }}
        className={primaryBtn}
      >
        Add to {DAY_NAMES[day]}
      </button>
      <button onClick={() => setItems(null)} className="mt-3 w-full text-center text-sm text-neutral-400">Change focus or time</button>
    </Sheet>
  )
}
