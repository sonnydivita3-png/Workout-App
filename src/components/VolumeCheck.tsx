import { useState } from 'react'
import { BUILTIN_BY_ID } from '../data/exercises'
import { partFromName } from '../lib/bodyParts'
import type { Overload } from '../lib/muscles'
import { FINISHER, minutesFor, type ExtraTime, type ExtraTimeOption } from '../lib/randomizer'
import type { PlannedExercise } from '../types'

/** "Up to [−] 5 [+] exercises per muscle". */
export function PerMuscleStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(1, value - 1))} aria-label="Fewer exercises per muscle" className="h-8 w-8 rounded-full bg-neutral-100 text-lg">−</button>
      <span className="w-6 text-center text-sm font-medium tabular-nums" aria-label="Exercises per muscle">{value}</span>
      <button onClick={() => onChange(Math.min(12, value + 1))} aria-label="More exercises per muscle" className="h-8 w-8 rounded-full bg-neutral-100 text-lg">+</button>
    </span>
  )
}

const partOf = (p: PlannedExercise) => {
  const e = BUILTIN_BY_ID.get(p.exerciseId)
  return e && e.kind === 'strength' && !p.warmup && !p.wod ? partFromName(e.group, e.name) : null
}
const lower = (s: string) => s.toLowerCase()
const andJoin = (l: string[]) => (l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} and ${l.at(-1)}`)
const range = (l: number[]) => (l.length === 0 ? '' : Math.min(...l) === Math.max(...l) ? `${l[0]}` : `${Math.min(...l)}–${Math.max(...l)}`)

/** One line on what an option does to the busy muscles, e.g. "4 exercises × 5 sets, 5–8 reps, longer rests · about 58 min". */
function detail(o: ExtraTimeOption, parts: string[]): string {
  const lifts = o.items.filter((p) => parts.includes(partOf(p) ?? ''))
  const sets = lifts.reduce((a, p) => a + p.sets, 0)
  const mins = `about ${Math.round(minutesFor(o.items))} min`
  const n = `${lifts.length} exercise${lifts.length === 1 ? '' : 's'}`
  switch (o.id) {
    case 'heavier': return `${n} × ${range(lifts.map((p) => p.sets))} sets, ${range(lifts.flatMap((p) => (p.reps ? [p.reps] : [])))} reps, longer rests · ${mins}`
    case 'finisher': {
      const cardio = o.items.filter((p) => p.note === FINISHER).reduce((a, p) => a + (p.minutes ?? 0), 0)
      return cardio ? `${n} (${sets} sets), then ${cardio} min easy cardio · ${mins}` : `${n} (${sets} sets) · ${mins}`
    }
    case 'part': return `${n} (${sets} sets), plus ${lower(o.part ?? '')} · ${mins}`
    case 'shorter': return `${n} (${sets} sets) · ${mins}`
  }
}
const LABEL: Record<ExtraTime, (o: ExtraTimeOption) => string> = {
  heavier: () => 'Heavier, fewer exercises',
  finisher: () => 'Add a cardio finisher',
  part: (o) => `Add ${lower(o.part ?? 'a body part')}`,
  shorter: () => 'Shorter workout',
}

interface Props {
  over: Overload[]
  options: ExtraTimeOption[]
  /** What they went with (null: not decided yet). */
  chosen: ExtraTime | 'more' | null
  /** Done for them by their saved choice. */
  auto: boolean
  limit: number
  onLimit: (n: number) => void
  /** An option, or 'more' to keep the workout as made. `remember` saves it as their choice. */
  onChoose: (id: ExtraTime | 'more', remember: boolean) => void
  onReopen: () => void
}

/**
 * When filling the time would give one muscle more than is useful (more exercises than their limit, or past about
 * 10-15 hard sets), say so and offer other ways to use the time. They can keep it as it is, and set their own limit.
 */
export function VolumeCheck({ over, options, chosen, auto, limit, onLimit, onChoose, onReopen }: Props) {
  const [remember, setRemember] = useState(false)
  const parts = over.map((o) => o.part)
  const names = andJoin(parts.map(lower))
  if (chosen) {
    const label = chosen === 'more' ? `Kept all the ${names} exercises` : `${LABEL[chosen](options.find((o) => o.id === chosen)!)} instead of ${over[0].exercises} ${lower(over[0].part)} exercises`
    return (
      <p className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
        <span>{label}{auto ? ' (your setting)' : ''}.</span>
        <button onClick={onReopen} className="shrink-0 font-medium text-neutral-700 underline underline-offset-2">Change</button>
      </p>
    )
  }
  return (
    <section className="mb-4 rounded-2xl bg-amber-50 px-4 py-3" aria-label="Lots for one muscle">
      <h3 className="text-sm font-semibold text-amber-800">That’s a lot of {names}: {over.map((o) => `${o.exercises} exercises, ${o.sets} sets`).join('; ')}</h3>
      <p className="mt-1 text-xs text-neutral-600">
        Most people grow best on about 10–15 hard sets for one muscle in a session, usually 4–5 exercises. Past that, extra sets mostly add fatigue. Use the time another way?
      </p>
      <div className="mt-3 space-y-2">
        {options.map((o) => (
          <button key={o.id} onClick={() => onChoose(o.id, remember)} aria-label={LABEL[o.id](o)} className="block w-full rounded-xl bg-surface px-3 py-2 text-left ring-1 ring-neutral-200/70">
            <span className="block text-sm font-medium">{LABEL[o.id](o)}</span>
            <span className="block text-xs text-neutral-500">{detail(o, parts)}</span>
          </button>
        ))}
        <button onClick={() => onChoose('more', remember)} className="block w-full rounded-xl px-3 py-2 text-left text-sm text-neutral-600 ring-1 ring-neutral-200/70">
          Keep it as is ({over[0].exercises} {lower(over[0].part)} exercises)
        </button>
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-neutral-600">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
        Do this every time (change it in Settings → Workouts)
      </label>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-amber-200/60 pt-3 text-xs text-neutral-600">
        <span>Your limit: exercises per muscle (4–5 is typical)</span>
        <PerMuscleStepper value={limit} onChange={onLimit} />
      </div>
    </section>
  )
}
