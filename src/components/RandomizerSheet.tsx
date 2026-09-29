import { useState } from 'react'
import { parseISO, weekdayIndex } from '../lib/dates'
import {
  FOCUS_OPTIONS, generateWorkout, LIFT_GROUPS, minutesFor, replaceExercise, STYLES, styleInfo, swapExercise, type WorkoutStyle,
} from '../lib/randomizer'
import { useStore } from '../store'
import type { PlannedExercise } from '../types'
import { ExercisePicker } from './ExercisePicker'
import { ModeSwitch, type GeneratorMode } from './ModeSwitch'
import { primaryBtn, Sheet } from './Sheet'
import { WorkoutList } from './WorkoutList'

const MAX_HISTORY = 50
const DURATIONS = [20, 30, 45, 60, 75, 90]
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const chip = (on: boolean, disabled = false) =>
  `rounded-full px-3 py-1.5 text-sm ${disabled ? 'bg-neutral-100 text-neutral-300' : on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`

interface Props {
  date: string
  onClose: () => void
  onSwitchMode: (m: GeneratorMode) => void
  /** Use the workout for something else (e.g. sending to a friend) instead of adding it to the day. */
  onUse?: (items: PlannedExercise[]) => void
}

export function RandomizerSheet({ date, onClose, onSwitchMode, onUse }: Props) {
  const { addPlanned, saveRoutine } = useStore()
  const dayName = DAY_NAMES[weekdayIndex(parseISO(date))]
  const [focus, setFocus] = useState<string[]>([])
  const [minutes, setMinutes] = useState(45)
  const [styles, setStyles] = useState<WorkoutStyle[]>(['standard'])
  // Every version of the workout, so an accidental reroll or swap can be walked back.
  const [history, setHistory] = useState<{ list: PlannedExercise[][]; at: number }>({ list: [], at: 0 })
  const [pickIndex, setPickIndex] = useState<number | null>(null)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)
  const items = history.list[history.at] ?? null

  const infos = styles.map(styleInfo)
  const info = infos[0]
  const focusIgnored = infos.every((i) => i.focus === 'ignored')
  const canGenerate = !infos.some((i) => i.focus === 'required') || focus.length > 0
  const styleLabel = infos.map((i) => i.label).join(' + ')
  const toggleStyle = (id: WorkoutStyle) => setStyles((cur) => (cur.includes(id) ? (cur.length > 1 ? cur.filter((x) => x !== id) : cur) : [...cur, id]))

  const commit = (next: PlannedExercise[]) => {
    if (next === items) return // nothing changed (e.g. no alternative to swap in)
    setHistory((h) => {
      const list = [...h.list.slice(0, h.at + 1), next].slice(-MAX_HISTORY)
      return { list, at: list.length - 1 }
    })
    setSaved(false)
    setNaming(false)
  }
  const go = (delta: number) => {
    setHistory((h) => ({ ...h, at: Math.min(h.list.length - 1, Math.max(0, h.at + delta)) }))
    setSaved(false)
    setNaming(false)
  }

  const toggle = (g: string) => setFocus((f) => (f.includes(g) ? f.filter((x) => x !== g) : [...f, g]))
  const fullBody = LIFT_GROUPS.every((g) => focus.includes(g))
  const body = focus.filter((g) => g !== 'Cardio')
  const cardioOnly = !focusIgnored && body.length === 0 && focus.includes('Cardio')
  const focusLabel = focusIgnored ? 'Full body' : cardioOnly ? 'Cardio' : body.length === 0 ? 'Full body' : body.length > 3 ? 'Full body' : body.join(' + ')
  const defaultName = `${styleLabel} · ${focusLabel} · ${minutes} min`

  const generate = (avoid?: PlannedExercise[]) =>
    commit(generateWorkout(focus, minutes, { style: styles[0], styles, avoid: new Set(avoid?.map((p) => p.exerciseId)) }))

  if (!items) {
    return (
      <Sheet title="Randomize" onClose={onClose} closeLabel="Cancel">
        <ModeSwitch mode="one" onChange={onSwitchMode} />

        <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-400">Workout style <span className="normal-case">(pick one or more)</span></h3>
        <div className="mb-1 flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <button key={s.id} onClick={() => toggleStyle(s.id)} aria-pressed={styles.includes(s.id)} className={chip(styles.includes(s.id))}>{s.label}</button>
          ))}
        </div>
        <p className="mb-5 text-xs text-neutral-400">
          {styles.length > 1 ? `${styleLabel}: the time is split between them, in that order, with cardio last.` : info.blurb}
        </p>

        <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-400">
          What are you training?{infos.every((i) => i.focus !== 'required') && ' (optional)'}
        </h3>
        <div className="mb-2 flex flex-wrap gap-2">
          {FOCUS_OPTIONS.map((g) => (
            <button key={g} disabled={focusIgnored} onClick={() => toggle(g)} className={chip(focus.includes(g), focusIgnored)}>{g}</button>
          ))}
        </div>
        <p className="mb-2 text-xs text-neutral-400">Tip: add <b className="font-medium">Cardio</b> to finish with a run, ride or row.</p>
        {focusIgnored ? (
          <p className="mb-5 text-xs text-neutral-400">{styleLabel} {styles.length > 1 ? 'are full-body formats' : 'is a full-body format'}, so body parts aren’t used.</p>
        ) : (
          <button
            onClick={() => setFocus(fullBody ? focus.filter((g) => g === 'Cardio') : [...LIFT_GROUPS, ...focus.filter((g) => g === 'Cardio')])}
            className="mb-5 text-sm text-neutral-500 underline-offset-2 hover:underline"
          >
            {fullBody ? 'Clear body parts' : 'Select full body'}
          </button>
        )}

        <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-400">How long?</h3>
        <div className="mb-6 flex flex-wrap gap-2">
          {DURATIONS.map((m) => (
            <button key={m} onClick={() => setMinutes(m)} className={chip(m === minutes)}>{m} min</button>
          ))}
        </div>

        <button disabled={!canGenerate} onClick={() => generate()} className={primaryBtn}>Generate workout</button>
      </Sheet>
    )
  }

  const total = minutesFor(items)

  return (
    <Sheet title="Your workout" onClose={onClose} closeLabel="Close">
      <div className="mb-2 flex items-center justify-between text-sm">
        <button
          onClick={() => go(-1)}
          disabled={history.at === 0}
          aria-label="Previous version"
          className="rounded-full bg-neutral-100 px-3 py-1 disabled:opacity-30"
        >
          ‹ Back
        </button>
        <span className="text-xs text-neutral-400">Version {history.at + 1} of {history.list.length}</span>
        <button
          onClick={() => go(1)}
          disabled={history.at >= history.list.length - 1}
          aria-label="Next version"
          className="rounded-full bg-neutral-100 px-3 py-1 disabled:opacity-30"
        >
          Forward ›
        </button>
      </div>
      <p className="mb-3 text-sm text-neutral-400">
        {styleLabel} · {focusLabel}{focus.includes('Cardio') && !focusIgnored && !cardioOnly ? ' + Cardio' : ''} · about {Math.round(total)} min
      </p>
      {items.length === 0 ? (
        <p className="py-6 text-center text-neutral-400">Couldn’t build a workout for that. Try another mix.</p>
      ) : (
        <div className="mb-4">
          <WorkoutList
            items={items}
            onSwap={(i) => commit(swapExercise(items, i))}
            onChoose={setPickIndex}
            onRemove={(i) => commit(items.filter((_, j) => j !== i))}
          />
        </div>
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
            className="rounded-xl bg-accent px-4 text-sm text-on-accent"
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
        onClick={() => { if (onUse) onUse(items); else { addPlanned(date, items); onClose() } }}
        className={primaryBtn}
      >
        {onUse ? 'Use this workout' : `Add to ${dayName}`}
      </button>
      {pickIndex !== null && (
        <ExercisePicker
          taken={new Set(items.map((p) => p.exerciseId))}
          onPick={(e) => { commit(replaceExercise(items, pickIndex, e)); setPickIndex(null) }}
          onClose={() => setPickIndex(null)}
        />
      )}
      <button onClick={() => setHistory({ list: [], at: 0 })} className="mt-3 w-full text-center text-sm text-neutral-400">Change style, focus or time</button>
    </Sheet>
  )
}
