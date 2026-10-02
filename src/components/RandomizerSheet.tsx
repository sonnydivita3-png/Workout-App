import { useState } from 'react'
import { parseISO, weekdayIndex } from '../lib/dates'
import {
  generateWorkout, LIFT_GROUPS, minutesFor, replaceExercise, STYLE_GROUPS, styleInfo, swapExercise, type WorkoutStyle,
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
import { MoveChoice } from './TrainingPrefsPicker'
import { withGearFor } from '../lib/equipment'
import { withCardioFor } from '../lib/cardioPrefs'
import { CardioChoice, type CardioPick } from './CardioChoice'
import { CardioActivityPicker } from './CardioActivityPicker'
import { cardioIds, exerciseFor, setupFromIds, type CardioSetup } from '../lib/cardioSetup'
import { CARDIO_SESSIONS, type CardioSessionKind } from '../lib/cardioSession'
import { BUILTIN_BY_ID } from '../data/exercises'

const MAX_HISTORY = 50
const DURATIONS = [20, 30, 45, 60, 75, 90]
// Styles that use cardio machines as stations.
// Styles that choose their own lifts, so exercise-type preferences apply (timed formats use a set list of movements).
const PICKS_LIFTS: WorkoutStyle[] = ['standard', 'strength', 'supersets', 'bodyweight', 'circuit', 'pha']
const CONDITIONING: WorkoutStyle[] = ['crossfit', 'amrap', 'emom', 'fortime', 'tabata', 'circuit']
type Kind = 'lift' | 'cond' | 'cardio'
const KINDS: { id: Kind; label: string }[] = [{ id: 'lift', label: 'Lifting' }, { id: 'cond', label: 'Conditioning' }, { id: 'cardio', label: 'Cardio' }]
const LIFT_STYLES: WorkoutStyle[] = ['standard', 'strength', 'supersets', 'bodyweight']
/** HIIT, Timed, Hyrox / CrossFit, each with its variations. */
const COND_GROUPS = STYLE_GROUPS.filter((g) => g.styles.every((st) => !LIFT_STYLES.includes(st)))
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
  const warm = genPrefs.warmup
  const rest = genPrefs.rest
  const dayName = DAY_NAMES[weekdayIndex(parseISO(date))]
  // Starts from the last choices, so a repeat visit is two taps: check, Generate.
  const saved0 = genPrefs.styles?.length ? genPrefs.styles : trainingPrefs.styles.length ? [trainingPrefs.styles[0]] : ['standard' as WorkoutStyle]
  const [focus, setFocus] = useState<string[]>(() => expandParts(genPrefs.focus ?? []).filter((g) => g !== 'Cardio'))
  // What kind of workout: lifting, conditioning and/or cardio. The first tap picks one; later taps add or remove.
  const [kinds, setKinds] = useState<Kind[]>(() => {
    const k: Kind[] = genPrefs.kinds?.length ? genPrefs.kinds : [
      ...(saved0.some((st) => LIFT_STYLES.includes(st)) ? ['lift' as const] : []),
      ...(saved0.some((st) => !LIFT_STYLES.includes(st)) ? ['cond' as const] : []),
      ...((genPrefs.focus ?? []).includes('Cardio') ? ['cardio' as const] : []),
    ]
    return k.length ? k : ['lift']
  })
  const [pickedKind, setPickedKind] = useState(false)
  const [liftStyle, setLiftStyle] = useState<WorkoutStyle>(saved0.find((st) => LIFT_STYLES.includes(st)) ?? 'standard')
  const [condStyle, setCondStyle] = useState<WorkoutStyle>(saved0.find((st) => !LIFT_STYLES.includes(st)) ?? 'circuit')
  const [cardio, setCardio] = useState<CardioSetup>(() => genPrefs.cardioSetup ?? setupFromIds(trainingPrefs.cardio, 'steady', trainingPrefs.cardioSplit))
  // Machines used as stations in conditioning pieces (when there's no cardio part to take them from).
  const [cardioPick, setCardioPick] = useState<CardioPick>({ cardio: trainingPrefs.cardio, split: trainingPrefs.cardioSplit })
  const [minutes, setMinutes] = useState(genPrefs.minutes ?? 45)
  // Per-part minutes when mixing styles and/or cardio; unset parts use an even split.
  const [split, setSplit] = useState<Record<string, number>>({})
  // Every version of the workout, so an accidental reroll or swap can be walked back.
  const [history, setHistory] = useState<{ list: PlannedExercise[][]; at: number }>({ list: [], at: 0 })
  const [pickIndex, setPickIndex] = useState<number | null>(null)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)
  const items = history.list[history.at] ?? null

  const hasKind = (k: Kind) => kinds.includes(k)
  const toggleKind = (k: Kind) => {
    setPickedKind(true)
    setKinds((cur) => (!pickedKind ? [k] : cur.includes(k) ? (cur.length > 1 ? cur.filter((x) => x !== k) : cur) : [...cur, k]))
  }
  const styles: WorkoutStyle[] = [...(hasKind('lift') ? [liftStyle] : []), ...(hasKind('cond') ? [condStyle] : [])]
  const cardioIdsPicked = cardioIds(cardio)
  // Stations in timed pieces use the cardio picked for this workout, else the conditioning choice, else the profile.
  const stationIds = hasKind('cardio') ? cardioIdsPicked : cardioPick.cardio
  const withChoices = <T,>(fn: () => T) => withGearFor(gear, () => withCardioFor(stationIds, hasKind('cardio') ? cardio.split : cardioPick.split, fn))

  const infos = styles.map(styleInfo)
  const focusIgnored = infos.length > 0 && infos.every((i) => i.focus === 'ignored')
  const needsParts = infos.some((i) => i.focus === 'required')
  const canGenerate = kinds.length > 0 && (!needsParts || focus.length > 0)
  const cardioOnly = styles.length === 0
  const one = cardioIdsPicked.length === 1 ? exerciseFor(cardioIdsPicked[0]) : undefined
  const sessionKind: CardioSessionKind = cardioIdsPicked.length > 1 ? 'steady' : cardio.session
  const sessionLabel = CARDIO_SESSIONS.find((x) => x.id === sessionKind)!.label
  const cardioName = one ? (BUILTIN_BY_ID.get(one)?.name ?? 'Cardio') : 'Cardio'
  const styleLabel = cardioOnly ? `${cardioName} · ${sessionLabel}` : infos.map((i) => i.label).join(' + ')

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
  const body = cardioOnly || focusIgnored ? [] : focus
  // One tap for the usual splits; each part can still be picked on its own.
  const same = (parts: string[]) => focus.length === parts.length && parts.every((g) => focus.includes(g))
  const presets: [string, string[]][] = [
    ['Full body', LIFT_GROUPS], ['Upper body', UPPER_PARTS], ['Lower body', LOWER_PARTS],
    ['Push', ['Chest', 'Shoulders', 'Triceps']], ['Pull', ['Back', 'Biceps']],
  ]
  const setBody = (parts: string[]) => setFocus(same(parts) ? [] : parts)
  const presetName = presets.find(([, parts]) => same(parts))?.[0]
  const focusLabel = cardioOnly ? (one && cardio.where === 'in' ? 'Indoors' : one ? 'Outside' : 'Cardio') : focusIgnored || body.length === 0 ? 'Full body' : presetName ?? (isFullBody(body) ? 'Full body' : body.join(' + '))
  // What the generator gets: body parts, plus Cardio when there's a cardio part.
  const genFocus = [...body, ...(hasKind('cardio') ? ['Cardio'] : [])]
  // Mixing parts (several styles, or lifting + cardio): let each part have its own time.
  const hasCardio = hasKind('cardio') && !cardioOnly
  // Warm-up cardio and mobility take their own minutes (5 each by default); warm-up sets live inside the lifting.
  const warmDefault = (warm.includes('cardio') ? 5 : 0) + (warm.includes('mobility') ? 5 : 0)
  const parts: string[] = [...(warmDefault ? ['warmup'] : []), ...styles, ...(hasCardio ? ['cardio'] : [])]
  const showSplit = parts.length > 1 && !cardioOnly
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
  const bump = (k: string, d: number) => {
    // Taking the warm-up below 2 min drops the easy cardio and mobility (warm-up sets stay with the lifting).
    if (k === 'warmup' && partMin(k) + d < 2) {
      setGenPrefs({ warmup: warm.filter((w) => w === 'sets') })
      setSplit(({ warmup: _w, ...r }) => (void _w, r))
      return
    }
    setSplit((cur) => ({ ...cur, [k]: Math.min(120, Math.max(k === 'warmup' ? 2 : 5, (cur[k] ?? partMin(k)) + d)) }))
  }
  const partLabel = (k: string) => (k === 'cardio' ? 'Cardio' : k === 'warmup' ? 'Warm-up' : styleInfo(k as WorkoutStyle).label)
  const warmWhat = [warm.includes('cardio') && 'easy cardio', warm.includes('mobility') && 'mobility'].filter(Boolean).join(' + ')
  const defaultName = `${styleLabel} · ${focusLabel} · ${total0} min`

  const generate = (avoid?: PlannedExercise[]) => {
    if (!avoid) setGenPrefs({ focus: genFocus, styles: [liftStyle, condStyle], kinds, minutes, cardioSetup: cardio })
    const cardioSpec = hasKind('cardio') ? { exerciseId: one, kind: sessionKind } : undefined
    // Cardio on its own: its session has its own warm-up and cool-down, so no warm-up cardio or mobility before it.
    const warmup = cardioOnly ? {} : { ...warmSplit(), sets: warm.includes('sets') && lifting }
    commit(withChoices(() => generateWorkout(genFocus, total0, {
      style: styles[0], styles, rest, warmup, cardio: cardioSpec,
      dropSets: !!genPrefs.drops && lifting,
      ...(showSplit ? { minutesByStyle: Object.fromEntries(styles.map((st) => [st, partMin(st)])), ...(hasCardio ? { cardioMinutes: partMin('cardio') } : {}) } : {}),
      avoid: new Set(avoid?.map((p) => p.exerciseId)),
    })))
  }

  if (!items) {
    const condGroup = COND_GROUPS.find((g) => g.styles.includes(condStyle))
    return (
      <Sheet title="Make me a workout" onClose={onClose} closeLabel="Cancel">
        <ModeSwitch mode="one" onChange={onSwitchMode} />

        <h3 className="mb-2 text-sm font-medium">What kind of workout? <span className="font-normal text-neutral-400">(one or more)</span></h3>
        <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Kind of workout">
          {KINDS.map((k) => <button key={k.id} onClick={() => toggleKind(k.id)} aria-pressed={hasKind(k.id)} className={chip(hasKind(k.id))}>{k.label}</button>)}
        </div>

        {hasKind('lift') && (
          <>
            <h3 className="mb-2 text-sm font-medium">Lifting style</h3>
            <div className="mb-1 flex flex-wrap gap-2" role="group" aria-label="Lifting style">
              {LIFT_STYLES.map((st) => <button key={st} onClick={() => setLiftStyle(st)} aria-pressed={liftStyle === st} className={chip(liftStyle === st)}>{styleInfo(st).label}</button>)}
            </div>
            <p className="mb-5 text-xs text-neutral-400">{styleInfo(liftStyle).blurb}</p>
          </>
        )}

        {hasKind('cond') && (
          <>
            <h3 className="mb-2 text-sm font-medium">Conditioning style</h3>
            <div className="mb-1 flex flex-wrap gap-2" role="group" aria-label="Conditioning style">
              {COND_GROUPS.map((g) => <button key={g.label} onClick={() => setCondStyle(g.styles[0])} aria-pressed={g === condGroup} className={chip(g === condGroup)}>{g.label}</button>)}
            </div>
            {condGroup && condGroup.styles.length > 1 && (
              <div className="mb-1 mt-2 flex flex-wrap items-center gap-1.5 pl-1">
                <span className="text-xs text-neutral-400">{condGroup.label}:</span>
                {condGroup.styles.map((st) => (
                  <button key={st} onClick={() => setCondStyle(st)} aria-pressed={condStyle === st} className={`rounded-full px-2.5 py-1 text-xs ${condStyle === st ? 'bg-neutral-900 text-surface' : 'bg-neutral-100 text-neutral-600'}`}>{styleInfo(st).label}</button>
                ))}
              </div>
            )}
            <p className="mb-5 text-xs text-neutral-400">{styleInfo(condStyle).blurb}</p>
          </>
        )}

        {!cardioOnly && (focusIgnored ? (
          <p className="mb-5 text-sm text-neutral-400">{styleInfo(condStyle).label} is a full-body format, so body parts aren’t used.</p>
        ) : (
          <>
            <h3 className="mb-2 text-sm font-medium">What are you training?{!needsParts && <span className="font-normal text-neutral-400"> (optional, empty = full body)</span>}</h3>
            <div className="mb-2 flex flex-wrap gap-2">
              {presets.map(([label, ps]) => (
                <button key={label} onClick={() => setBody(ps)} aria-pressed={same(ps)} className={chip(same(ps))}>{label}</button>
              ))}
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Body parts">
              {LIFT_GROUPS.map((g) => (
                <button key={g} onClick={() => toggle(g)} aria-pressed={focus.includes(g)} className={`rounded-full px-2.5 py-1 text-sm ${focus.includes(g) ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`}>{g}</button>
              ))}
            </div>
            <p className="mb-5 text-xs text-neutral-400">{same(LIFT_GROUPS) ? 'Full body: one exercise for each part, big lifts first.' : <>Add <b className="font-medium">Cardio</b> above to finish with a run, ride or row.</>}</p>
          </>
        ))}

        {hasKind('cardio') && <CardioActivityPicker value={cardio} onChange={setCardio} finisher={!cardioOnly} />}

        {!cardioOnly && <GearChoice value={gear} onChange={setGear} />}
        {styles.some((st) => PICKS_LIFTS.includes(st)) && <MoveChoice />}

        {!hasKind('cardio') && styles.some((st) => CONDITIONING.includes(st)) && (
          <CardioChoice value={cardioPick} onChange={setCardioPick} gear={gear} hint="Machines used as stations in timed pieces, e.g. 12 cal on the rower." />
        )}

        {!cardioOnly && <WarmupRestControls lifting={lifting} onWarmupChange={() => setSplit(({ warmup: _w, ...r }) => (void _w, r))} />}

        {!showSplit && <h3 className="mb-2 text-sm font-medium">How long?</h3>}
        {showSplit && (
          <>
            <h3 className="mb-2 text-sm font-medium">Time for each part</h3>
            <ul className="mb-2 divide-y divide-neutral-100 rounded-2xl bg-neutral-50 px-3">
              {parts.map((k) => (
                <li key={k} className="flex items-center justify-between py-2">
                  <span className="text-sm">
                    <span>{partLabel(k)}</span>
                    {k === 'warmup' && <span className="block text-xs text-neutral-400">{warmWhat} · − to remove</span>}
                  </span>
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
        {styleLabel} · {focusLabel}{hasCardio ? ' + Cardio' : ''} · about {Math.round(total)} min
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
