import { useState } from 'react'
import { parseISO, weekdayIndex } from '../lib/dates'
import {
  FOCUS_OPTIONS, generateWorkout, LIFT_GROUPS, minutesFor, replaceExercise, STYLE_GROUPS, styleInfo, swapExercise, type WorkoutStyle,
} from '../lib/randomizer'
import { expandParts, isFullBody, LOWER_PARTS, UPPER_PARTS } from '../lib/bodyParts'
import { useStore } from '../store'
import type { PlannedExercise } from '../types'
import { ExercisePicker } from './ExercisePicker'
import { ModeSwitch, type GeneratorMode } from './ModeSwitch'
import { primaryBtn, Sheet } from './Sheet'
import { WarmupRestControls } from './WarmupRestControls'
import { WorkoutList } from './WorkoutList'
import { GearChoice } from './GearChoice'
import { withGearFor } from '../lib/equipment'
import { withCardioFor } from '../lib/cardioPrefs'
import { CardioChoice, type CardioPick } from './CardioChoice'

const MAX_HISTORY = 50
const DURATIONS = [20, 30, 45, 60, 75, 90]
// Styles that use cardio machines as stations.
const CONDITIONING: WorkoutStyle[] = ['crossfit', 'amrap', 'emom', 'fortime', 'tabata', 'circuit']
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
  const { addPlanned, saveRoutine, genPrefs, setGenPrefs, equipment, trainingPrefs } = useStore()
  const [gear, setGear] = useState<string[] | null>(equipment)
  const [cardioPick, setCardioPick] = useState<CardioPick>({ cardio: trainingPrefs.cardio, split: trainingPrefs.cardioSplit })
  const withChoices = <T,>(fn: () => T) => withGearFor(gear, () => withCardioFor(cardioPick.cardio, cardioPick.split, fn))
  const warm = genPrefs.warmup
  const rest = genPrefs.rest
  const dayName = DAY_NAMES[weekdayIndex(parseISO(date))]
  // Starts from the last choices, so a repeat visit is two taps: check, Generate.
  const [focus, setFocus] = useState<string[]>(() => expandParts(genPrefs.focus ?? []))
  const [minutes, setMinutes] = useState(genPrefs.minutes ?? 45)
  // Per-part minutes when mixing styles and/or cardio; unset parts use an even split.
  const [split, setSplit] = useState<Record<string, number>>({})
  const [styles, setStyles] = useState<WorkoutStyle[]>(genPrefs.styles?.length ? genPrefs.styles : trainingPrefs.styles.length ? [trainingPrefs.styles[0]] : ['standard'])
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
  // The first tap replaces the default style; later taps add or remove styles.
  const [picked, setPicked] = useState(false)
  const toggleStyle = (id: WorkoutStyle) => {
    setPicked(true)
    setStyles((cur) => (!picked ? [id] : cur.includes(id) ? (cur.length > 1 ? cur.filter((x) => x !== id) : cur) : [...cur, id]))
  }

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
  const body = focus.filter((g) => g !== 'Cardio')
  // One tap for the usual splits; each part can still be picked on its own.
  const same = (parts: string[]) => body.length === parts.length && parts.every((g) => body.includes(g))
  const presets: [string, string[]][] = [
    ['Full body', LIFT_GROUPS], ['Upper body', UPPER_PARTS], ['Lower body', LOWER_PARTS],
    ['Push', ['Chest', 'Shoulders', 'Triceps']], ['Pull', ['Back', 'Biceps']],
  ]
  const setBody = (parts: string[]) => setFocus([...(same(parts) ? [] : parts), ...focus.filter((g) => g === 'Cardio')])
  const cardioOnly = !focusIgnored && body.length === 0 && focus.includes('Cardio')
  const presetName = presets.find(([, parts]) => same(parts))?.[0]
  const focusLabel = focusIgnored || body.length === 0 ? 'Full body' : cardioOnly ? 'Cardio' : presetName ?? (isFullBody(body) ? 'Full body' : body.join(' + '))
  // Mixing parts (several styles, or lifting + cardio): let each part have its own time.
  const hasCardio = !focusIgnored && focus.includes('Cardio') && !cardioOnly
  // Warm-up cardio and mobility take their own minutes (5 each by default); warm-up sets live inside the lifting.
  const warmDefault = (warm.includes('cardio') ? 5 : 0) + (warm.includes('mobility') ? 5 : 0)
  const parts: string[] = [...(warmDefault ? ['warmup'] : []), ...styles, ...(hasCardio ? ['cardio'] : [])]
  const showSplit = parts.length > 1
  const workParts = parts.length - (warmDefault ? 1 : 0)
  const evenShare = Math.max(5, Math.round((minutes - warmDefault) / Math.max(1, workParts) / 5) * 5)
  const partMin = (k: string) => split[k] ?? (k === 'warmup' ? warmDefault : evenShare)
  const warmSplit = () => {
    const w = warmDefault ? partMin('warmup') : 0
    if (warm.includes('cardio') && warm.includes('mobility')) { const c = Math.round(w * 0.55); return { cardio: c, mobility: w - c } }
    return warm.includes('cardio') ? { cardio: w } : warm.includes('mobility') ? { mobility: w } : {}
  }
  const lifting = styles.some((st) => ['standard', 'strength', 'bodyweight', 'supersets'].includes(st))
  const total0 = showSplit ? parts.reduce((a, k) => a + partMin(k), 0) : minutes
  const bump = (k: string, d: number) => setSplit((cur) => ({ ...cur, [k]: Math.min(120, Math.max(k === 'warmup' ? 2 : 5, (cur[k] ?? partMin(k)) + d)) }))
  const partLabel = (k: string) => (k === 'cardio' ? 'Cardio' : k === 'warmup' ? 'Warm-up' : styleInfo(k as WorkoutStyle).label)
  const defaultName = `${styleLabel} · ${focusLabel} · ${total0} min`

  const generate = (avoid?: PlannedExercise[]) => {
    if (!avoid) setGenPrefs({ focus, styles, minutes })
    commit(withChoices(() => generateWorkout(focus, total0, {
      style: styles[0], styles, rest,
      warmup: { ...warmSplit(), sets: warm.includes('sets') && lifting },
      dropSets: !!genPrefs.drops && lifting,
      ...(showSplit ? { minutesByStyle: Object.fromEntries(styles.map((st) => [st, partMin(st)])), ...(hasCardio ? { cardioMinutes: partMin('cardio') } : {}) } : {}),
      avoid: new Set(avoid?.map((p) => p.exerciseId)),
    })))
  }

  if (!items) {
    return (
      <Sheet title="Make me a workout" onClose={onClose} closeLabel="Cancel">
        <ModeSwitch mode="one" onChange={onSwitchMode} />

        <h3 className="mb-2 text-sm font-medium">What are you training?{infos.every((i) => i.focus !== 'required') && <span className="font-normal text-neutral-400"> (optional)</span>}</h3>
        {focusIgnored ? (
          <p className="mb-5 text-sm text-neutral-400">{styleLabel} {styles.length > 1 ? 'are full-body formats' : 'is a full-body format'}, so body parts aren’t used.</p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap gap-2">
              {presets.map(([label, parts]) => (
                <button key={label} onClick={() => setBody(parts)} aria-pressed={same(parts)} className={chip(same(parts))}>{label}</button>
              ))}
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Body parts">
              {FOCUS_OPTIONS.map((g) => (
                <button key={g} onClick={() => toggle(g)} aria-pressed={focus.includes(g)} className={`rounded-full px-2.5 py-1 text-sm ${focus.includes(g) ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`}>{g}</button>
              ))}
            </div>
            <p className="mb-5 text-xs text-neutral-400">{same(LIFT_GROUPS) ? 'Full body: one exercise for each part, big lifts first.' : <>Add <b className="font-medium">Cardio</b> to finish with a run, ride or row.</>}</p>
          </>
        )}

        <h3 className="mb-2 text-sm font-medium">Workout style <span className="font-normal text-neutral-400">(pick one or more)</span></h3>
        <div className="mb-1 flex flex-wrap gap-2">
          {STYLE_GROUPS.map((g) => {
            const on = g.styles.some((st) => styles.includes(st))
            return (
              <button key={g.label} onClick={() => (on ? g.styles.filter((st) => styles.includes(st)).forEach(toggleStyle) : toggleStyle(g.styles[0]))} aria-pressed={on} className={chip(on)}>
                {g.label}
              </button>
            )
          })}
        </div>
        {STYLE_GROUPS.filter((g) => g.styles.length > 1 && g.styles.some((st) => styles.includes(st))).map((g) => (
          <div key={g.label} className="mb-1 mt-2 flex flex-wrap items-center gap-1.5 pl-1">
            <span className="text-xs text-neutral-400">{g.label}:</span>
            {g.styles.map((st) => (
              <button
                key={st}
                onClick={() => setStyles((cur) => [...cur.filter((x) => !g.styles.includes(x)), st])}
                aria-pressed={styles.includes(st)}
                className={`rounded-full px-2.5 py-1 text-xs ${styles.includes(st) ? 'bg-neutral-900 text-surface' : 'bg-neutral-100 text-neutral-600'}`}
              >
                {styleInfo(st).label}
              </button>
            ))}
          </div>
        ))}
        <p className="mb-5 text-xs text-neutral-400">
          {styles.length > 1 ? `${styleLabel}: the time is split between them, in that order, with cardio last.` : info.blurb}
        </p>

        <GearChoice value={gear} onChange={setGear} />

        {(focus.includes('Cardio') && !focusIgnored) || styles.some((st) => CONDITIONING.includes(st)) ? (
          <CardioChoice
            value={cardioPick}
            onChange={setCardioPick}
            gear={gear}
            hint={focus.includes('Cardio') && !focusIgnored ? 'What to finish on. Pick several to take turns or split the time.' : 'Machines used as stations in timed pieces, e.g. 12 cal on the rower.'}
          />
        ) : null}

        {!showSplit && <h3 className="mb-2 text-sm font-medium">How long?</h3>}
        {showSplit && (
          <>
            <h3 className="mb-2 text-sm font-medium">Time for each part</h3>
            <ul className="mb-2 divide-y divide-neutral-100 rounded-2xl bg-neutral-50 px-3">
              {parts.map((k) => (
                <li key={k} className="flex items-center justify-between py-2">
                  <span className="text-sm">{partLabel(k)}</span>
                  <span className="flex items-center gap-2">
                    <button onClick={() => bump(k, -5)} aria-label={`Less ${partLabel(k)} time`} className="h-8 w-8 rounded-full bg-neutral-100 text-lg">−</button>
                    <span className="w-16 text-center text-sm tabular-nums">{partMin(k)} min</span>
                    <button onClick={() => bump(k, 5)} aria-label={`More ${partLabel(k)} time`} className="h-8 w-8 rounded-full bg-neutral-100 text-lg">+</button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mb-2 text-xs text-neutral-400">Total {total0} min. Or pick a total to split evenly:</p>
          </>
        )}
        <div className="mb-5 flex flex-wrap gap-2">
          {DURATIONS.map((m) => (
            <button key={m} onClick={() => { setMinutes(m); setSplit({}) }} className={chip(m === minutes && Object.keys(split).length === 0)}>{m} min</button>
          ))}
        </div>

        <WarmupRestControls lifting={lifting} onWarmupChange={() => setSplit(({ warmup: _w, ...r }) => (void _w, r))} />

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
            onSwap={(i) => commit(withChoices(() => swapExercise(items, i)))}
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
