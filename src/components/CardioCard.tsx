import { useRef, useState } from 'react'
import { parseGpx } from '../lib/gpx'
import { bodyweightOn, estimateCalories, hasPersonalDetails, inclinable, runCalories } from '../lib/calories'
import { sessionNoun } from '../lib/cardioBests'
import { runsOf, withRuns } from '../lib/cardioRuns'
import { cardioLine, distanceUnitFor, distanceUnitsFor, formatCardioTime, formatDistanceFor, formatPaceFor, showDistanceIn, showWeight, storeDistanceIn } from '../lib/units'
import { useToday } from '../lib/useToday'
import { useStore } from '../store'
import type { CardioEntry, CardioRun, Exercise, ExerciseLog } from '../types'
import { NumberInput } from './NumberInput'
import { rowBtn, Sheet } from './Sheet'

interface Props {
  exercise: Exercise
  current?: ExerciseLog
  last?: ExerciseLog
  targetMinutes?: number
  /** Target distance in miles. */
  targetDistance?: number
  /** Planned treadmill incline, percent grade. */
  targetIncline?: number
  note?: string
  onChange: (c: CardioEntry) => void
  onRemove: () => void
  /** Swap for another cardio exercise. */
  onSwap?: () => void
  /** A day that hasn't happened yet: show the target only. */
  readOnly?: boolean
  /** The day it's logged on (for the bodyweight behind the calorie estimate). */
  date?: string
}

export function CardioCard({ exercise, current, last, targetMinutes, targetDistance, targetIncline, note, onChange, onRemove, onSwap, readOnly, date }: Props) {
  const units = useStore((s) => s.units)
  const setDistanceUnit = useStore((s) => s.setDistanceUnit)
  const bodyweight = useStore((s) => s.bodyweight)
  const aboutMe = useStore((s) => s.aboutMe)
  const today = useToday()
  const c = current?.cardio ?? { distance: null, minutes: null }
  // Logging a treadmill workout keeps the plan's incline unless they change it.
  const save = (n: CardioEntry) => onChange(!n.parts && n.incline === undefined && inclinable(exercise.id) && targetIncline ? { ...n, incline: targetIncline } : n)
  // Two runs (or rides…) on one day: the earlier ones are listed above the boxes, which are for the one being logged.
  const runs = runsOf(c)
  const at = runs.length - 1
  const cur = runs[at]
  const noun = sessionNoun(exercise.id, exercise)
  const saveRun = (patch: Partial<CardioRun>) => {
    const next = { ...cur, ...patch }
    if (next.incline === undefined && inclinable(exercise.id) && targetIncline) next.incline = targetIncline
    onChange(withRuns(c, runs.map((r, i) => (i === at ? next : r))))
  }
  const addRun = () => onChange(withRuns(c, [...runs, { distance: null, minutes: null }]))
  // A logged run's numbers go with it, so ask first (like removing an exercise with sets logged).
  const removeRun = (i: number) => { if (confirm(`Remove ${noun} ${i + 1}? Its time and distance are deleted.`)) onChange(withRuns(c, runs.filter((_, j) => j !== i))) }
  const prev = last?.cardio
  // Rowers and swims default to meters, everything else to the miles/km setting; the chips above switch this card's own.
  const unit = distanceUnitFor(exercise.id, units)
  // Time as minutes and seconds (a 2,000 m row in 7:32), stored as minutes.
  const wholeMin = cur.minutes == null ? null : Math.floor(cur.minutes + 1e-9)
  const secs = cur.minutes == null ? null : Math.round((cur.minutes - (wholeMin ?? 0)) * 60)
  const setTime = (m: number | null, s: number | null) => {
    const sec = Math.min(59, Math.max(0, s ?? 0))
    saveRun({ minutes: m == null && !sec ? null : (m ?? 0) + sec / 60 })
  }
  const file = useRef<HTMLInputElement>(null)
  const [gpxMsg, setGpxMsg] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  // GPS files only make sense for runs, rides, walks and hikes outside, not machines.
  const outdoor = exercise.equipment === 'Outdoor'
  const importGpx = async (f: File | undefined) => {
    if (!f) return
    const g = parseGpx(await f.text())
    if (!g || !g.miles) { setGpxMsg('Couldn’t find a GPS track in that file.'); return }
    saveRun({ distance: g.miles, minutes: g.minutes || cur.minutes })
    setGpxMsg(`Imported ${g.name ? `“${g.name}”: ` : ''}${formatDistanceFor(g.miles, exercise.id, units)} in ${g.minutes} min${g.date ? ` (${g.date})` : ''}`)
  }
  const target = [targetDistance ? formatDistanceFor(targetDistance, exercise.id, units) : '', targetMinutes ? formatCardioTime(targetMinutes) : '', targetIncline ? `${targetIncline}% incline` : ''].filter(Boolean).join(' · ')
  // A treadmill's incline: what they set, else the plan's, for the estimate.
  const treadmill = inclinable(exercise.id)
  const incline = cur.incline === undefined && treadmill ? targetIncline : cur.incline
  // Calories: theirs (e.g. from a watch) if typed in, else an estimate from bodyweight, activity, time and pace.
  const day = date ?? current?.date ?? today
  const lb = bodyweightOn(bodyweight, day)
  const est = estimateCalories(exercise.id, { ...cur, incline }, lb, aboutMe, day)
  const own = cur.calories != null && cur.calories > 0
  // Done: the card folds to one line, like a lifting card once every set is ticked, so the next exercise is in view.
  // Tap it to open it again; a choice to open or fold lasts until it's marked done or not done.
  const card = useRef<HTMLDivElement>(null)
  const [fold, setFold] = useState<{ collapsed: boolean; whenDone: boolean } | null>(null)
  const done = !readOnly && !!c.done
  const collapsed = fold && fold.whenDone === done ? fold.collapsed : done
  const toggleFold = () => setFold({ collapsed: !collapsed, whenDone: done })
  const logged = runs.some((r) => r.distance != null || r.minutes != null)
  const curLogged = cur.distance != null || cur.minutes != null
  const markDone = () => {
    save({ ...c, done: !done })
    if (!done) setTimeout(() => card.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60)
  }
  // The whole day's: every run's distance and time, and each run's calories (typed in, else estimated).
  const all = runs.length > 1 ? runCalories(exercise.id, c, lb, aboutMe, day) : own ? { kcal: cur.calories!, estimated: false } : est != null ? { kcal: est, estimated: true } : null
  const summary = [cardioLine(runs.length > 1 ? c : { ...c, incline }, exercise.id, units), runs.length > 1 ? `${runs.length} ${noun}s` : '', all ? `${all.estimated ? '≈' : ''}${all.kcal} cal` : ''].filter((x) => x && x !== '–').join(' · ')
  if (collapsed) {
    return (
      <div ref={card} className={`scroll-mt-4 flex items-start justify-between gap-2 rounded-2xl bg-surface py-2 pl-4 pr-2 shadow-sm ring-1 ${done ? 'ring-accent/40' : 'ring-neutral-200/70'}`}>
        <button onClick={toggleFold} className="min-w-0 py-1 text-left">
          <span className="flex items-center gap-2 text-[17px] font-semibold leading-snug">
            {done && <><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-accent">✓</span>{' '}</>}
            <span>{exercise.name}</span>
          </span>
          <span className="block text-xs text-neutral-500">{summary || 'Cardio'}</span>
        </button>
        <button onClick={toggleFold} aria-label={`Open ${exercise.name}`} aria-expanded={false} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full leading-none text-neutral-500 hover:bg-neutral-100 -mt-0.5 text-sm">⌄</button>
      </div>
    )
  }
  return (
    <div ref={card} className="scroll-mt-4 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70">
      <div className="-mr-2 mb-3 flex items-start justify-between gap-1">
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold leading-snug">{exercise.name}</h3>
          <p className="text-xs text-neutral-500">Cardio{target ? ` · target ${target}` : ''}</p>
        </div>
        {!readOnly && logged && <button onClick={toggleFold} aria-label={`Fold ${exercise.name}`} aria-expanded className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full leading-none text-neutral-500 hover:bg-neutral-100 -mt-1.5 ml-auto text-sm">⌃</button>}
        <button onClick={() => setMenu(true)} aria-label={`${exercise.name} options`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full leading-none text-neutral-500 hover:bg-neutral-100 -mt-1.5 text-lg">⋯</button>
      </div>
      {note && <p className="mb-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-600">{note}</p>}
      {readOnly ? <p className="text-sm text-neutral-500">Log it on the day.</p> : (<>
      {runs.length > 1 && (
        <ul aria-label={`Earlier ${noun}s`} className="mb-3 divide-y divide-neutral-100 rounded-xl bg-neutral-50 px-3 text-sm">
          {runs.slice(0, at).map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2 py-1.5">
              <span><span className="font-medium">{noun[0].toUpperCase() + noun.slice(1)} {i + 1}</span> <span className="text-neutral-500">· {cardioLine(r, exercise.id, units)}</span></span>
              <button onClick={() => removeRun(i)} aria-label={`Remove ${noun} ${i + 1}`} className="hit h-8 w-8 shrink-0 rounded-full text-neutral-500 hover:bg-neutral-100">×</button>
            </li>
          ))}
        </ul>
      )}
      {runs.length > 1 && (
        <div className="mb-1 flex items-center justify-between text-xs font-medium text-neutral-500">
          <span>{noun[0].toUpperCase() + noun.slice(1)} {at + 1}</span>
          <button onClick={() => removeRun(at)} aria-label={`Remove ${noun} ${at + 1}`} className="hit font-medium text-neutral-500 underline-offset-2 hover:underline">Remove</button>
        </div>
      )}
      <div role="group" aria-label={`${exercise.name} units`} className="mb-3 inline-flex rounded-full bg-neutral-100 p-0.5">
        {distanceUnitsFor(exercise.id).map((u) => (
          <button
            key={u}
            onClick={() => setDistanceUnit(exercise.id, u)}
            aria-pressed={unit === u}
            className={`hit rounded-full px-3 py-1 text-xs font-medium ${unit === u ? 'bg-surface text-neutral-900 shadow-sm' : 'text-neutral-500'}`}
          >
            {u}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_1.5fr_1fr] items-end gap-2">
        <label className="text-xs font-medium text-neutral-500">
          <span className="mb-1 block">{{ m: 'Meters', yd: 'Yards', km: 'Km', mi: 'Miles' }[unit]}</span>
          <NumberInput
            label={`${exercise.name} distance`}
            value={showDistanceIn(cur.distance, unit)}
            step={unit === 'm' || unit === 'yd' ? (exercise.id === 'swimming' ? 25 : 100) : 0.1}
            // Empty boxes show a dash: the target is in the line above and last time below, never in the box.
            placeholder="–"
            onChange={(v) => saveRun({ distance: storeDistanceIn(v, unit) })}
          />
        </label>
        <div className="text-xs font-medium text-neutral-500">
          <span className="mb-1 block">Time <span className="font-normal">min : sec</span></span>
          <div className="flex items-center gap-1">
            <NumberInput label={`${exercise.name} minutes`} value={wholeMin} placeholder="–" onChange={(v) => (v != null && !Number.isInteger(v) ? saveRun({ minutes: v }) : setTime(v, secs))} />
            <span className="text-neutral-400">:</span>
            <NumberInput label={`${exercise.name} seconds`} value={secs || (wholeMin != null ? 0 : null)} placeholder="00" onChange={(v) => setTime(wholeMin, v)} />
          </div>
        </div>
        <div className="text-xs font-medium text-neutral-500">
          <span className="mb-1 block">Pace</span>
          <div className="flex h-11 items-center justify-center rounded-xl text-sm font-semibold tabular-nums text-neutral-900 ring-1 ring-inset ring-neutral-200">{formatPaceFor(cur.distance, cur.minutes, exercise.id, units) ?? '–'}</div>
        </div>
      </div>
      {treadmill && (
        <div className="mt-2 flex items-center gap-2 text-xs font-medium text-neutral-500">
          <span>Incline</span>
          <div className="w-20"><NumberInput label={`${exercise.name} incline`} value={cur.incline ?? null} step={0.5} placeholder={targetIncline ? String(targetIncline) : '0'} onChange={(v) => saveRun({ incline: v == null ? null : Math.min(40, Math.max(0, v)) })} /></div>
          <span className="font-normal text-neutral-400">%{cur.incline === undefined && targetIncline ? ' (the plan’s, unless you change it)' : ''}</span>
        </div>
      )}
      </>)}
      {!readOnly && (() => {
        const personal = hasPersonalDetails(aboutMe)
        return (
          <div className="mt-3 flex items-start gap-3">
            <label className="w-24 shrink-0 text-xs font-medium text-neutral-500">
              <span className="mb-1 block">Calories</span>
              <NumberInput label={`${exercise.name} calories`} value={cur.calories ?? null} step={10} placeholder={est != null ? `≈${est}` : '–'} onChange={(v) => saveRun({ calories: v })} />
            </label>
            <p className="pt-5 text-xs text-neutral-500">
              {own ? 'Your number (e.g. from your watch).'
                : est != null ? <><b className="font-medium text-neutral-600">≈{est} cal, estimated</b> from your bodyweight ({showWeight(lb, units)} {units.weight}){personal ? ', sex, age, height' : ''}, the activity and its time{cur.distance ? ' and pace' : ''}{incline ? ' and incline' : ''}. {personal ? '' : 'Add sex, age and height in Settings → Profile for a closer estimate. '}Type your watch’s number to use that instead.</>
                : !lb ? <>Estimated calories need your <b className="font-medium text-neutral-600">bodyweight</b> (add it in Progress → Body), plus this workout’s minutes. Or type your watch’s number.</>
                : 'Log the minutes to see estimated calories, or type your watch’s number.'}
            </p>
          </div>
        )
      })()}
      {!readOnly && curLogged && !done && (
        <button onClick={addRun} className="mt-3 min-h-11 w-full rounded-2xl bg-neutral-100 py-2 text-sm font-medium text-neutral-700">＋ Add another {noun}</button>
      )}
      {!readOnly && runs.length > 1 && (
        <p className="mt-2 text-xs text-neutral-500">{runs.length} {noun}s today: {cardioLine(c, exercise.id, units)}{all ? ` · ${all.estimated ? '≈' : ''}${all.kcal} cal` : ''}</p>
      )}
      {!readOnly && (
        <button onClick={markDone} disabled={!logged && !done} aria-pressed={done} className={`mt-3 min-h-12 w-full rounded-2xl py-3 text-base font-semibold ${done ? 'bg-neutral-100 text-neutral-600' : 'bg-accent text-on-accent'}`}>
          {done ? 'Done ✓ · tap to undo' : logged ? '✓ Done' : '✓ Done (log the time or distance first)'}
        </button>
      )}
      {outdoor && <input ref={file} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" aria-label="Import a GPX file" className="hidden" onChange={(e) => { void importGpx(e.target.files?.[0]); e.target.value = '' }} />}
      {gpxMsg && <p role="status" className="mt-2 text-xs text-neutral-500">{gpxMsg}</p>}
      {menu && (
        <Sheet title={exercise.name} onClose={() => setMenu(false)}>
          {onSwap && <button onClick={() => { setMenu(false); onSwap() }} className={rowBtn}><span>Swap exercise</span></button>}
          {outdoor && <button onClick={() => { setMenu(false); file.current?.click() }} className={rowBtn}><span>Import a GPX file</span><span className="text-xs text-neutral-400">From a watch or Strava</span></button>}
          <button onClick={() => { setMenu(false); onRemove() }} className={`${rowBtn} text-red-600`}><span>Remove exercise</span></button>
        </Sheet>
      )}
      {prev && (
        <p className="mt-2 text-xs text-neutral-500">
          Last time: {cardioLine(prev, exercise.id, units)}
        </p>
      )}
    </div>
  )
}
