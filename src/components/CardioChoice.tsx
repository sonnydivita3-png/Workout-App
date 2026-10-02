import { allCardio, cardioFor } from '../lib/cardioPrefs'
import { useStore } from '../store'

const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`

export interface CardioPick { cardio: string[]; split: boolean }

/**
 * Which cardio to use: none picked means "surprise me"; several can take turns or share the time.
 * Starts from the profile; a different choice applies here only, with a one-tap way to keep it.
 */
export function CardioChoice({ value, onChange, gear, hint }: { value: CardioPick; onChange: (v: CardioPick) => void; gear: string[] | null; hint: string }) {
  const prefs = useStore((s) => s.trainingPrefs)
  const setTrainingPrefs = useStore((s) => s.setTrainingPrefs)
  // What the equipment allows, plus anything they've said they do (a treadmill at home).
  const options = allCardio().filter((c) => cardioFor(gear).some((x) => x.id === c.id) || prefs.cardio.includes(c.id) || value.cardio.includes(c.id))
  const picked = value.cardio.filter((id) => options.some((c) => c.id === id))
  const toggle = (id: string) => onChange({ ...value, cardio: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id] })
  const same = picked.length === prefs.cardio.length && picked.every((x) => prefs.cardio.includes(x)) && (picked.length < 2 || value.split === prefs.cardioSplit)
  return (
    <div className="mb-5">
      <h3 className="mb-1 text-sm font-medium">Cardio</h3>
      <p className="mb-2 text-xs text-neutral-400">{hint}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Cardio">
        <button onClick={() => onChange({ ...value, cardio: [] })} aria-pressed={picked.length === 0} className={chip(picked.length === 0)}>Any</button>
        {options.map((c) => <button key={c.id} onClick={() => toggle(c.id)} aria-pressed={picked.includes(c.id)} className={chip(picked.includes(c.id))}>{c.label}</button>)}
      </div>
      {picked.length > 1 && (
        <div className="mt-2 flex gap-2 text-sm" role="radiogroup" aria-label="Several kinds of cardio">
          <button role="radio" aria-checked={!value.split} onClick={() => onChange({ ...value, split: false })} className={chip(!value.split)}>One per workout</button>
          <button role="radio" aria-checked={value.split} onClick={() => onChange({ ...value, split: true })} className={chip(value.split)}>Split the time</button>
        </div>
      )}
      {!same && (
        <p className="mt-2 text-xs text-neutral-400">
          Just for this workout.{' '}
          <button onClick={() => setTrainingPrefs({ cardio: picked, cardioSplit: value.split })} className="underline underline-offset-2">Make it my default</button>
        </p>
      )}
    </div>
  )
}
