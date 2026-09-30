import { cardioFor } from '../lib/cardioPrefs'
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
