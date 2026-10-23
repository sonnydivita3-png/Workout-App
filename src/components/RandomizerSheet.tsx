import { useState } from 'react'
import { parseISO, weekdayIndex } from '../lib/dates'
import {
  bringsOwnWarmup, extraTimeOptions, generateWorkout, LIFT_GROUPS, minutesFor, replaceExercise, STYLE_GROUPS, styleInfo, swapExercise,
  type ExtraTime, type ExtraTimeOption, type GenerateOptions, type WorkoutStyle,
} from '../lib/randomizer'
import { overloaded, type Overload } from '../lib/muscles'
import { extraTimeOf, perMuscleOf } from '../lib/volumePrefs'
import { VolumeCheck } from './VolumeCheck'
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
import { cardioIds, exerciseFor, inclineOf, INCLINES, setupFromIds, type CardioSetup } from '../lib/cardioSetup'
import { CARDIO_SESSIONS, type CardioSessionKind } from '../lib/cardioSession'
import { BUILTIN_BY_ID } from '../data/exercises'
import { BY_ID } from '../lib/randomUtil'
import { cardioMet, EFFORTS, effortLabel, fitCardio, setCardioPace, type Effort, metForRate, perMinute, planForCalories, planWithin, recentSpeed, SESSION_FACTOR, setCardioEffort, setIncline, STYLE_MET, styleFor, WARMUP_MET, workoutCalories } from '../lib/calorieTarget'
import { bodyweightOn, inclinable, metFor, restingPerHour, speedForMet, topSpeed } from '../lib/calories'
import { distanceFactor, formatMinutes, formatPace, showSpeed, showWeight, speedUnit, storeWeight } from '../lib/units'
import { useToday } from '../lib/useToday'
import { NumberInput } from './NumberInput'

const MAX_HISTORY = 50
const DURATIONS = [20, 30, 45, 60, 75, 90]
const CALORIES = [300, 500, 750, 1000]
const LIMITS = [45, 60, 75, 90, 120]
/** Speeds most people can't hold for long, when there are no logs of theirs to go by (mph). */
const FAST: Record<string, number> = { running: 9, Running_Treadmill: 9, cycling: 18, Bicycling: 18, walking: 4.5, Walking_Treadmill: 4.5 }
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

/** A workout that gave one muscle too much: what was made, the other ways to use the time, and what they picked. */
interface Volume { over: Overload[]; options: ExtraTimeOption[]; base: PlannedExercise[]; opts: GenerateOptions; chosen: ExtraTime | 'more' | null; auto: boolean }

export function RandomizerSheet({ date, onClose, onSwitchMode, onUse }: Props) {
  const { addPlanned, saveRoutine, genPrefs, setGenPrefs, equipment, trainingPrefs, setTrainingPrefs, bodyweight, aboutMe, units, logBodyweight, logs } = useStore()
  const today = useToday()
  // Time, or a calorie target the time is worked out for.
  const [goal, setGoal] = useState<'time' | 'calories'>('time')
  const [kcal, setKcal] = useState<number | null>(500)
  const [weightIn, setWeightIn] = useState<number | null>(null)
  // With a calorie target: a time limit (then the app works out how hard), or null to work out the time.
  const [timeLimit, setTimeLimit] = useState<number | null>(null)
  // Or their pace, and the app works out the time: a speed for runs, walks and rides (their recent one until they set
  // one), an effort for other cardio.
  const [paceIn, setPaceIn] = useState<number | null>(null)
  const [effortPick, setEffortPick] = useState<Effort>('moderate')
  const perMuscle = perMuscleOf(trainingPrefs.perMuscle)
  const extraTime = extraTimeOf(trainingPrefs.extraTime)
  const [volume, setVolume] = useState<Volume | null>(null)
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
  // A calorie target: lifting and conditioning keep the minutes they set, the cardio makes up the rest (without cardio,
  // the parts grow together). Needs their weight; the estimate is the same net one as for logged cardio.
  const knownLb = bodyweightOn(bodyweight, today)
  const lb = knownLb ?? storeWeight(weightIn, units)
  // "Any" cardio: what they usually do (their profile), the activities the workout will likely use. Cardio type ids
  // ('treadmill') become exercise ids ('Running_Treadmill') for the calorie numbers.
  const exerciseIds = (types: string[]) => types.map(exerciseFor).filter((id): id is string => !!id)
  // On a treadmill, its incline: the climb burns more at the same speed.
  const incline = inclineOf(cardio)
  const cardioMetHere = cardioMet(exerciseIds(cardioIdsPicked.length ? cardioIdsPicked : trainingPrefs.cardio), sessionKind, incline)
  const withSpeed = !!one && topSpeed(one) != null
  const recentHere = one ? recentSpeed(logs, [one]) : null
  const paceMph = withSpeed ? (paceIn != null ? paceIn / distanceFactor(units) : recentHere) : null
  const paceMet = withSpeed && paceMph ? metFor(one!, { distance: paceMph, minutes: 60, incline }) * SESSION_FACTOR[sessionKind] : cardioMetHere * EFFORTS[effortPick]
  const calParts = cardioOnly
    ? [{ key: 'cardio', met: paceMet, minutes }]
    : parts.map((k) => ({ key: k, met: k === 'warmup' ? WARMUP_MET : k === 'cardio' ? paceMet : STYLE_MET[k as WorkoutStyle], minutes: partMin(k) }))
  // Active calories (on top of resting, like a watch's active number) or total (resting included, like a gym machine).
  const countTotal = trainingPrefs.calorieCount === 'total'
  const restPerMin = lb ? restingPerHour(lb, today, aboutMe) / 60 : 0
  const rate = (met: number) => perMinute(met, lb ?? 0, today, aboutMe) + (countTotal ? restPerMin : 0)
  const metOf = (r: number) => metForRate(r - (countTotal ? restPerMin : 0), lb ?? 0, today, aboutMe)
  const countWord = countTotal ? 'total' : 'active'
  const flexible = hasKind('cardio') ? 'cardio' : undefined
  const untimed = goal === 'calories' && lb && kcal ? planForCalories(kcal, calParts, rate, flexible) : null
  const timed = goal === 'calories' && lb && kcal && timeLimit ? planWithin(kcal, timeLimit, calParts, rate, metOf, flexible) : null
  const cal = timed ?? untimed
  // Within a time limit: how hard it has to be. Runs, walks and rides get a speed (compared with their recent ones);
  // other cardio an effort; lifting on its own, the style that burns enough.
  const needMet = timed?.needMet ?? null
  const speed = needMet && one && hasKind('cardio') ? speedForMet(one, needMet / SESSION_FACTOR[sessionKind], incline) : null
  const recent = recentHere
  const effort = needMet && hasKind('cardio') ? effortLabel(needMet / cardioMetHere) : null
  const liftNeed = needMet && !hasKind('cardio') ? styleFor(needMet) : null
  const ownStyle = styles[0]
  const tooHard = !!timed && (needMet == null || (hasKind('cardio')
    ? speed ? speed >= (topSpeed(one!) ?? Infinity) - 0.01 || speed > (recent ? recent * 1.15 : FAST[one!] ?? Infinity) : effort === 'too hard' || effort === 'very hard'
    : !liftNeed))
  // On a treadmill, the incline that brings the speed it takes back within reach.
  const steeper = tooHard && speed && needMet && inclinable(one)
    ? INCLINES.find((g) => g > incline && speedForMet(one!, needMet / SESSION_FACTOR[sessionKind], g)! <= (recent ? recent * 1.15 : FAST[one!] ?? Infinity) && speedForMet(one!, needMet / SESSION_FACTOR[sessionKind], g)! < (topSpeed(one!) ?? Infinity) - 0.01)
    : undefined
  // A harder style: lifting styles stay lifting; HIIT ones (PHA, circuits) make it a conditioning workout instead.
  const switchStyle = (st: WorkoutStyle) => {
    setPickedKind(true)
    // The minutes they gave the lifting go with it.
    setSplit(({ [liftStyle]: m, ...rest }) => (m == null ? rest : { ...rest, [st]: m }))
    if (LIFT_STYLES.includes(st)) { setLiftStyle(st); return }
    setCondStyle(st)
    setKinds((k) => [...k.filter((x) => x !== 'lift' && x !== 'cond'), 'cond'])
  }
  // What it takes at a usual effort, to offer as the time instead.
  const usualMinutes = untimed ? Math.ceil(untimed.totalMinutes / 15) * 15 : null
  // The workout as made: its own cardio activities, and its cardio fitted to the target.
  const mets = { lift: STYLE_MET[liftStyle], cond: STYLE_MET[condStyle], cardioFactor: SESSION_FACTOR[sessionKind] }
  const minFor = (k: string) => cal?.minutes[k] ?? partMin(k)
  const totalMin = cal ? cal.totalMinutes : total0
  const computed = (k: string) => !!cal && k !== 'warmup' && (k === 'cardio' || !hasKind('cardio'))
  const partLabel = (k: string) => (k === 'cardio' ? 'Cardio' : k === 'warmup' ? 'Warm-up' : styleInfo(k as WorkoutStyle).label)
  const warmWhat = [warm.includes('cardio') && 'easy cardio', warm.includes('mobility') && 'mobility'].filter(Boolean).join(' + ')
  const defaultName = `${styleLabel} · ${focusLabel} · ${totalMin} min`

  const generate = (avoid?: PlannedExercise[]) => {
    if (!avoid) setGenPrefs({ focus: genFocus, styles: [liftStyle, condStyle], kinds, minutes, cardioSetup: cardio })
    if (cal && !knownLb && lb) logBodyweight(today, lb)
    const cardioSpec = hasKind('cardio') ? { exerciseId: one, kind: sessionKind } : undefined
    // Cardio on its own: its session has its own warm-up and cool-down, so no warm-up cardio or mobility before it.
    const warmup = cardioOnly ? {} : { ...warmSplit(), sets: warm.includes('sets') && lifting }
    const opts: GenerateOptions = {
      style: styles[0], styles, rest, warmup, cardio: cardioSpec,
      dropSets: !!genPrefs.drops && lifting,
      ...(showSplit ? { minutesByStyle: Object.fromEntries(styles.map((st) => [st, minFor(st)])), ...(hasCardio ? { cardioMinutes: minFor('cardio') } : {}) } : {}),
      avoid: new Set(avoid?.map((p) => p.exerciseId)),
    }
    const made = setIncline(withChoices(() => generateWorkout(genFocus, totalMin, opts)), hasKind('cardio') ? incline : 0)
    // A time limit: the cardio goes as hard as it has to; otherwise its time stretches to land on the target.
    // Otherwise it goes at their pace, and its time stretches to land on the target.
    check(
      timed && needMet && hasKind('cardio') ? setCardioEffort(made, needMet, SESSION_FACTOR[sessionKind])
        : cal && kcal ? fitCardio(hasKind('cardio') ? setCardioPace(made, { exerciseId: one, mph: paceMph, effort: effortPick }) : made, kcal, rate, mets)
          : made,
      opts, perMuscle,
    )
  }
  // Filling the time gave one muscle more than their limit (or past about 15 hard sets): offer other ways to use it,
  // or do what they chose before.
  const check = (base: PlannedExercise[], opts: GenerateOptions, limit: number) => {
    const over = extraTime === 'more' ? [] : overloaded(base, (id) => BY_ID.get(id), limit)
    if (over.length === 0) { setVolume(null); commit(base); return }
    const options = withChoices(() => extraTimeOptions(genFocus, totalMin, opts, limit, over.map((o) => o.part)))
    const auto = extraTime !== 'ask' ? options.find((o) => o.id === extraTime) : undefined
    setVolume({ over, options, base, opts, chosen: auto?.id ?? null, auto: !!auto })
    commit(auto?.items ?? base)
  }
  const chooseVolume = (id: ExtraTime | 'more', remember: boolean) => {
    if (!volume) return
    if (remember) setTrainingPrefs({ extraTime: id })
    commit(id === 'more' ? volume.base : volume.options.find((o) => o.id === id)!.items)
    setVolume({ ...volume, chosen: id, auto: false })
  }
  const setLimit = (n: number) => {
    setTrainingPrefs({ perMuscle: n })
    if (volume) check(volume.base, volume.opts, n)
  }

  if (!items) {
    const condGroup = COND_GROUPS.find((g) => g.styles.includes(condStyle))
    return (
      // Keys: the result opens at its top (with any note about the workout), not where Generate was.
      <Sheet key="setup" title="Make me a workout" onClose={onClose} closeLabel="Cancel">
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

        {!cardioOnly && <WarmupRestControls lifting={lifting} ownWarmupNote={styles.some(bringsOwnWarmup)} onWarmupChange={() => setSplit(({ warmup: _w, ...r }) => (void _w, r))} />}

        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{showSplit ? 'Time for each part' : goal === 'calories' ? 'How many calories?' : 'How long?'}</h3>
          <div role="group" aria-label="Plan by" className="flex shrink-0 rounded-full bg-neutral-100 p-0.5 text-xs">
            {(['time', 'calories'] as const).map((g) => (
              <button key={g} onClick={() => setGoal(g)} aria-pressed={goal === g} className={`rounded-full px-3 py-1 ${goal === g ? 'bg-surface font-medium shadow-sm' : 'text-neutral-500'}`}>{g === 'time' ? 'Time' : 'Calories'}</button>
            ))}
          </div>
        </div>
        {goal === 'calories' && (
          <div className="mb-3">
            <div className="mb-2 flex flex-wrap gap-2">
              {CALORIES.map((c) => <button key={c} onClick={() => setKcal(c)} className={chip(kcal === c)}>{c.toLocaleString()} cal</button>)}
            </div>
            <NumberInput label="Calories to burn" value={kcal} placeholder="Calories" onChange={(v) => setKcal(v == null ? null : Math.round(v))} />
            {!knownLb && (
              <div className="mt-2">
                <p className="mb-1 text-xs text-neutral-500">Your weight, to estimate the burn ({units.weight}):</p>
                <NumberInput label="Your weight" value={weightIn} placeholder={units.weight} onChange={setWeightIn} />
              </div>
            )}
            <p className="mb-1 mt-3 text-xs font-medium text-neutral-600">Count</p>
            <div role="group" aria-label="Count calories as" className="flex flex-wrap gap-2">
              {(['active', 'total'] as const).map((c) => (
                <button key={c} onClick={() => setTrainingPrefs({ calorieCount: c })} aria-pressed={(trainingPrefs.calorieCount ?? 'active') === c} className={chip((trainingPrefs.calorieCount ?? 'active') === c)}>{c === 'active' ? 'Active' : 'Total'}</button>
              ))}
            </div>
            <p className="mt-1 text-xs text-neutral-400">{countTotal ? 'Including what you’d burn anyway, like most gym machines and some watches.' : 'On top of what you’d burn anyway, like a watch’s active calories.'}</p>
            <p className="mb-1 mt-3 text-xs font-medium text-neutral-600">In how long?</p>
            <div role="group" aria-label="Time limit" className="flex flex-wrap gap-2">
              <button onClick={() => setTimeLimit(null)} aria-pressed={timeLimit == null} className={chip(timeLimit == null)}>Work it out</button>
              {LIMITS.map((m) => <button key={m} onClick={() => setTimeLimit(m)} aria-pressed={timeLimit === m} className={chip(timeLimit === m)}>{formatMinutes(m)}</button>)}
            </div>
            <p className="mt-1 text-xs text-neutral-400">{timeLimit ? 'The app works out how hard each part has to be.' : 'At your pace below; the app works out the time.'}</p>
            {!timeLimit && hasKind('cardio') && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-neutral-600">Your {cardioName.toLowerCase()} pace</p>
                {withSpeed ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-28"><NumberInput label={`Your speed (${speedUnit(units)})`} value={paceIn ?? (recentHere ? showSpeed(recentHere, units) : null)} placeholder={speedUnit(units)} step={0.1} onChange={setPaceIn} /></div>
                      <span className="text-xs text-neutral-500">{speedUnit(units)}{paceMph && FAST[one!] && FAST[one!] < 10 ? ` · ${formatPace(paceMph, 60, units)}` : ''}</span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">{paceIn == null ? (recentHere ? 'Your recent average.' : 'A usual easy pace until you set yours.') : 'Your pace for this workout.'}</p>
                  </>
                ) : (
                  <div role="group" aria-label="Effort" className="flex flex-wrap gap-2">
                    {(Object.keys(EFFORTS) as Effort[]).map((e) => <button key={e} onClick={() => setEffortPick(e)} aria-pressed={effortPick === e} className={chip(effortPick === e)}>{e[0].toUpperCase() + e.slice(1)}</button>)}
                  </div>
                )}
              </div>
            )}
            {(hasKind('lift') || hasKind('cond')) && (
              <p className="mt-2 text-xs text-neutral-400">
                Lifting intensity is the style and the exercises: {styles.map((st) => `${styleInfo(st).label} ≈ ${Math.round(lb ? rate(STYLE_MET[st]) : perMinute(STYLE_MET[st], 180, today, aboutMe))} ${countWord} cal/min`).join(', ')}{lb ? '' : ' (at 180 lb)'} on average. Heavy squats and deadlifts burn more, machines and isolation less; supersets and HIIT more a minute.
              </p>
            )}
          </div>
        )}
        {showSplit && (
          <>
            <ul className="mb-2 divide-y divide-neutral-100 rounded-2xl bg-neutral-50 px-3">
              {parts.map((k) => (
                <li key={k} className="flex items-center justify-between py-2">
                  <span className="text-sm">
                    <span>{partLabel(k)}</span>
                    {k === 'warmup' && <span className="block text-xs text-neutral-400">{warmWhat} · − to remove</span>}
                    {cal && <span className="block text-xs text-neutral-400">≈ {cal.kcal[k]} cal{computed(k) ? ' · worked out for your target' : ''}</span>}
                  </span>
                  {computed(k) ? (
                    <span className="w-16 text-center text-sm font-medium tabular-nums">{minFor(k)} min</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <button onClick={() => bump(k, -5)} aria-label={`Less ${partLabel(k)} time`} className="h-8 w-8 rounded-full bg-neutral-100 text-lg">−</button>
                      <span className="w-16 text-center text-sm tabular-nums">{minFor(k)} min</span>
                      <button onClick={() => bump(k, 5)} aria-label={`More ${partLabel(k)} time`} className="h-8 w-8 rounded-full bg-neutral-100 text-lg">+</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {goal === 'time' && <p className="mb-2 text-xs text-neutral-400">Total {total0} min. Or pick a total to split evenly:</p>}
          </>
        )}
        {goal === 'time' && (
          <div className="mb-5 flex flex-wrap gap-2">
            {DURATIONS.map((m) => (
              <button key={m} onClick={() => { setMinutes(m); setSplit({}) }} className={chip(m === minutes && Object.keys(split).length === 0)}>{m} min</button>
            ))}
          </div>
        )}
        {goal === 'calories' && (
          <div role="status" className="mb-5 rounded-2xl bg-neutral-50 px-3 py-2 text-sm">
            {!lb ? (
              <p className="text-neutral-500">Add your weight to work out the time.</p>
            ) : !cal ? (
              <p className="text-neutral-500">Pick how many calories.</p>
            ) : (
              <>
                <p className="font-medium">About {cal.totalKcal.toLocaleString()} {countWord} cal in {formatMinutes(cal.totalMinutes)}</p>
                <p className="text-xs text-neutral-500">That’s about {Math.round(cal.totalKcal + (countTotal ? -1 : 1) * restPerMin * cal.totalMinutes).toLocaleString()} {countTotal ? 'active' : 'total, counting what you’d burn anyway'}.</p>
                {!showSplit && <p className="text-xs text-neutral-500">{cardioOnly ? cardioName : styleLabel}: {formatMinutes(cal.totalMinutes)}</p>}
                {!timed && hasKind('cardio') && cal.minutes.cardio != null && (
                  <p className="mt-1 text-xs text-neutral-600">
                    {cardioName}: {formatMinutes(cal.minutes.cardio)} at {withSpeed && paceMph
                      ? <><b>{showSpeed(paceMph, units)} {speedUnit(units)}{FAST[one!] && FAST[one!] < 10 ? ` (${formatPace(paceMph, 60, units)})` : ''}</b>{incline ? ` at ${incline}% incline` : ''}</>
                      : <>a <b>{withSpeed ? 'usual easy' : effortPick}</b> {withSpeed ? 'pace' : 'effort'}{incline ? ` at ${incline}% incline` : ''}</>}.
                  </p>
                )}
                {timed && needMet == null && <p className="mt-1 text-xs text-amber-700">No time left for the {hasKind('cardio') ? 'cardio' : 'workout'}: less lifting or more time.</p>}
                {timed && needMet != null && hasKind('cardio') && (
                  <p className="mt-1 text-xs text-neutral-600">
                    {speed
                      ? <>{cardioName}: {formatMinutes(timed.minutes.cardio)} at about <b>{showSpeed(speed, units)} {speedUnit(units)}</b>{one && FAST[one] && FAST[one] < 10 ? ` (${formatPace(speed, 60, units)})` : ''}{incline ? ` at ${incline}% incline` : ''}{recent ? `; your recent average is ${showSpeed(recent, units)} ${speedUnit(units)}` : ''}.</>
                      : <>{cardioName}: {formatMinutes(timed.minutes.cardio)} at a <b>{effort}</b> effort{needMet / cardioMetHere > 1.1 ? ` (about ${Math.round((needMet / cardioMetHere - 1) * 100)}% harder than a usual pace)` : ''}.</>}
                  </p>
                )}
                {timed && needMet != null && !hasKind('cardio') && (
                  <p className="mt-1 text-xs text-neutral-600">
                    {liftNeed
                      ? STYLE_MET[liftNeed] > STYLE_MET[ownStyle] + 0.1
                        ? <>That takes <b>{styleInfo(liftNeed).label}</b>-style work (less rest, more work a minute) instead of {styleInfo(ownStyle).label}.</>
                        : <>{styleInfo(ownStyle).label} gets there.</>
                      : <>No lifting style burns that much in that time: even nonstop circuits come to about {Math.round(perMinute(STYLE_MET.circuit, lb, today, aboutMe) * (timed.totalMinutes - (timed.minutes.warmup ?? 0)) + (timed.kcal.warmup ?? 0))} cal.</>}
                  </p>
                )}
                {timed && (tooHard || (liftNeed && STYLE_MET[liftNeed] > STYLE_MET[ownStyle] + 0.1)) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {liftNeed && STYLE_MET[liftNeed] > STYLE_MET[ownStyle] + 0.1 && <button onClick={() => switchStyle(liftNeed)} className={chip(false)}>Use {styleInfo(liftNeed).label}</button>}
                    {tooHard && hasKind('cardio') && hasKind('lift') && STYLE_MET[liftStyle] < STYLE_MET.supersets && <button onClick={() => switchStyle('supersets')} className={chip(false)}>Harder lifting: Supersets</button>}
                    {steeper != null && <button onClick={() => setCardio({ ...cardio, incline: steeper })} className={chip(false)}>Use a {steeper}% incline</button>}
                    {tooHard && !hasKind('cardio') && <button onClick={() => { setPickedKind(true); setKinds((k) => [...k, 'cardio']) }} className={chip(false)}>Add cardio</button>}
                    {tooHard && usualMinutes && usualMinutes > (timeLimit ?? 0) && <button onClick={() => setTimeLimit(LIMITS.includes(usualMinutes) ? usualMinutes : null)} className={chip(false)}>Allow {formatMinutes(usualMinutes)}</button>}
                  </div>
                )}
                {tooHard && hasKind('cardio') && <p className="mt-1 text-xs text-amber-700">That’s {speed ? 'faster' : 'harder'} than most people can hold for that long{recent ? ', and well above your recent average' : ''}.</p>}
                {!timed && cal.totalMinutes > 120 && (
                  <p className="mt-1 text-xs text-amber-700">That’s a long session. {hasKind('cardio') ? 'Harder cardio (intervals, tempo, hills) or a lower target gets there sooner.' : 'Adding cardio gets there in much less time.'}</p>
                )}
                <p className="mt-1 text-xs text-neutral-400">
                  Estimated from your weight{knownLb ? ` (${showWeight(knownLb, units)} ${units.weight})` : ''} and how hard each part is, like a fitness watch: it can be off by 20% or more. Lifting counts each exercise: heavy squats, deadlifts and lunges burn the most, machines and isolation the least.
                </p>
              </>
            )}
          </div>
        )}

        <button disabled={!canGenerate || (goal === 'calories' && !cal)} onClick={() => generate()} className={primaryBtn}>Generate workout</button>
      </Sheet>
    )
  }

  const total = minutesFor(items)

  return (
    <Sheet key="result" title="Your workout" onClose={onClose} closeLabel="Close">
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
        {styleLabel} · {focusLabel}{hasCardio ? ' + Cardio' : ''} · about {Math.round(total)} min{cal ? ` · ≈ ${workoutCalories(items, rate, mets).toLocaleString()} ${countWord} cal` : ''}
      </p>
      {volume && (
        <VolumeCheck
          over={volume.over} options={volume.options} chosen={volume.chosen} auto={volume.auto} limit={perMuscle}
          onLimit={setLimit} onChoose={chooseVolume} onReopen={() => setVolume({ ...volume, chosen: null, auto: false })}
        />
      )}
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
      <button onClick={() => { setHistory({ list: [], at: 0 }); setVolume(null) }} className="mt-3 w-full text-center text-sm text-neutral-400">Change style, focus or time</button>
    </Sheet>
  )
}
