import { useState } from 'react'
import { MOVE_TYPES, movePrefsSummary, type Lean, type MoveType } from '../lib/movePrefs'
import { cardioFor } from '../lib/cardioPrefs'
import { baseTarget } from '../lib/muscles'
import { PROGRAM_GOALS } from '../lib/program'
import { NumberInput } from './NumberInput'
import type { WorkoutStyle } from '../lib/randomizer'
import { useStore } from '../store'

// What people call the kinds of workout they like; one choice can cover several generator styles.
const LIKES: { label: string; blurb: string; styles: WorkoutStyle[] }[] = [
  { label: 'Classic gym workouts', blurb: 'Straight sets for each muscle', styles: ['standard'] },
  { label: 'Heavy strength', blurb: 'Squat, bench, deadlift, low reps', styles: ['strength'] },
  { label: 'Supersets', blurb: 'Exercises paired back to back', styles: ['supersets'] },
  { label: 'HIIT circuits', blurb: 'Timed rounds, short rests', styles: ['circuit'] },
  { label: 'CrossFit-style', blurb: 'Strength primer, then a WOD', styles: ['crossfit'] },
  { label: 'Hyrox-style', blurb: 'Running plus stations', styles: ['hyrox'] },
  { label: 'AMRAP, EMOM & for time', blurb: 'Against the clock', styles: ['amrap', 'emom', 'fortime'] },
  { label: 'Tabata', blurb: '20s all-out, 10s rest', styles: ['tabata'] },
  { label: 'Bodyweight', blurb: 'No equipment needed', styles: ['bodyweight'] },
]

/** Kinds of workout someone enjoys. Plans and the workout generator lean towards these. */
export function LikedStylesPicker() {
  const liked = useStore((s) => s.trainingPrefs.styles)
  const setTrainingPrefs = useStore((s) => s.setTrainingPrefs)
  const toggle = (styles: WorkoutStyle[]) => {
    const on = styles.every((st) => liked.includes(st))
    setTrainingPrefs({ styles: on ? liked.filter((st) => !styles.includes(st)) : [...liked, ...styles.filter((st) => !liked.includes(st))] })
  }
  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Workouts you like">
      {LIKES.map((l) => {
        const on = l.styles.every((st) => liked.includes(st))
        return (
          <button key={l.label} onClick={() => toggle(l.styles)} aria-pressed={on} className={`rounded-2xl px-3 py-2.5 text-left ring-1 ${on ? 'bg-accent/15 ring-accent' : 'bg-surface ring-neutral-200'}`}>
            <span className="block text-sm font-medium">{l.label}</span>
            <span className="block text-xs text-neutral-500">{l.blurb}</span>
          </button>
        )
      })}
    </div>
  )
}

const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`

/** Cardio someone likes (only what their equipment allows), and whether to split the time between several. */
export function LikedCardioPicker() {
  const { cardio, cardioSplit } = useStore((s) => s.trainingPrefs)
  const equipment = useStore((s) => s.equipment)
  const setTrainingPrefs = useStore((s) => s.setTrainingPrefs)
  const options = cardioFor(equipment)
  const picked = cardio.filter((id) => options.some((c) => c.id === id))
  const toggle = (id: string) => setTrainingPrefs({ cardio: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id] })
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Cardio you like">
        {options.map((c) => <button key={c.id} onClick={() => toggle(c.id)} aria-pressed={picked.includes(c.id)} className={chip(picked.includes(c.id))}>{c.label}</button>)}
      </div>
      {picked.length > 1 && (
        <div className="mt-3">
          <p className="mb-2 text-sm font-medium">With more than one</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="With more than one kind of cardio">
            <button role="radio" aria-checked={!cardioSplit} onClick={() => setTrainingPrefs({ cardioSplit: false })} className={chip(!cardioSplit)}>One per workout, taking turns</button>
            <button role="radio" aria-checked={cardioSplit} onClick={() => setTrainingPrefs({ cardioSplit: true })} className={chip(cardioSplit)}>Split the time between them</button>
          </div>
        </div>
      )}
      {picked.length === 0 && <p className="mt-2 text-xs text-neutral-400">None picked: any cardio your equipment allows.</p>}
    </div>
  )
}

/** More or less of each kind of movement (compound, free weights, one arm / one leg…). Generated workouts lean that way. */
export function MovePrefsPicker() {
  const moves = useStore((s) => s.trainingPrefs.moves) ?? {}
  const setTrainingPrefs = useStore((s) => s.setTrainingPrefs)
  const set = (id: MoveType, lean: Lean) => setTrainingPrefs({ moves: { ...moves, [id]: lean } })
  return (
    <ul className="divide-y divide-neutral-100 rounded-2xl bg-surface ring-1 ring-neutral-200/70">
      {MOVE_TYPES.map((t) => {
        const v = moves[t.id] ?? 0
        return (
          <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="min-w-0">
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="block truncate text-xs text-neutral-400">{t.hint}</span>
            </span>
            <span className="flex shrink-0 rounded-full bg-neutral-100 p-0.5 text-xs" role="radiogroup" aria-label={t.label}>
              {([[-1, 'Less'], [0, 'Normal'], [1, 'More']] as [Lean, string][]).map(([lean, label]) => (
                <button
                  key={lean}
                  role="radio"
                  aria-checked={v === lean}
                  onClick={() => set(t.id, lean)}
                  className={`rounded-full px-2.5 py-1 ${v === lean ? (lean === 0 ? 'bg-surface text-neutral-700 shadow-sm' : 'bg-accent text-on-accent') : 'text-neutral-500'}`}
                >
                  {label}
                </button>
              ))}
            </span>
          </li>
        )
      })}
    </ul>
  )
}


/** Exercise types for a generated workout: one summary line, and Change to set them (saved as the default). */
export function MoveChoice() {
  const moves = useStore((s) => s.trainingPrefs.moves)
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl bg-neutral-50 px-4 py-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium">Exercise types</span>
          <span className="block truncate text-xs text-neutral-500">{movePrefsSummary(moves) ?? 'No preference'}</span>
        </span>
        <button onClick={() => setOpen(true)} aria-label="Change exercise types" className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700">Change</button>
      </div>
    )
  }
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-sm font-medium">Exercise types you prefer</h3>
      <MovePrefsPicker />
      <p className="mt-2 text-xs text-neutral-400">Saved as your default (also in Settings → Profile). Workouts lean towards “More” and away from “Less”, without dropping a body part.</p>
    </div>
  )
}

/** Main goal, and the weekly hard sets per muscle it sets (or their own number). */
export function GoalPicker() {
  const { goal, setTarget } = useStore((s) => s.trainingPrefs)
  const setTrainingPrefs = useStore((s) => s.setTrainingPrefs)
  const auto = baseTarget(goal)
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Main goal">
        {PROGRAM_GOALS.map((g) => <button key={g.id} role="radio" aria-checked={goal === g.id} onClick={() => setTrainingPrefs({ goal: g.id })} className={chip(goal === g.id)}>{g.label}</button>)}
        <button role="radio" aria-checked={!goal} onClick={() => setTrainingPrefs({ goal: null })} className={chip(!goal)}>Not set</button>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium">Weekly sets per muscle</span>
          <span className="block text-xs text-neutral-400">{setTarget ? `Your own number (your goal suggests ${auto}).` : `${auto}, from ${goal ? 'your goal' : 'the usual advice'}. Type your own to change it.`}</span>
        </span>
        <span className="w-20 shrink-0">
          <NumberInput label="Weekly sets per muscle" value={setTarget ?? null} placeholder={String(auto)} onChange={(v) => setTrainingPrefs({ setTarget: v && v > 0 ? Math.min(40, Math.round(v)) : null })} />
        </span>
      </div>
      <p className="mt-2 text-xs text-neutral-400">Hard sets are working sets taken close to failure (warm-ups don’t count). Arms, glutes, calves and core also work in the big lifts, so their targets are about 60% of this.</p>
    </div>
  )
}
