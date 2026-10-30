import { useRef, useState } from 'react'
import { parseGpx } from '../lib/gpx'
import { bodyweightOn, estimateCalories, hasPersonalDetails, inclinable } from '../lib/calories'
import { cardioLine, distanceUnitFor, distanceUnitsFor, formatCardioTime, formatDistanceFor, formatPaceFor, showDistanceIn, showWeight, storeDistanceIn } from '../lib/units'
import { useToday } from '../lib/useToday'
import { useStore } from '../store'
import type { CardioEntry, Exercise, ExerciseLog } from '../types'
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
  const save = (n: CardioEntry) => onChange(n.incline === undefined && inclinable(exercise.id) && targetIncline ? { ...n, incline: targetIncline } : n)
  const prev = last?.cardio
  // Rowers and swims default to meters, everything else to the miles/km setting; the chips above switch this card's own.
  const unit = distanceUnitFor(exercise.id, units)
  // Time as minutes and seconds (a 2,000 m row in 7:32), stored as minutes.
  const wholeMin = c.minutes == null ? null : Math.floor(c.minutes + 1e-9)
  const secs = c.minutes == null ? null : Math.round((c.minutes - (wholeMin ?? 0)) * 60)
  const setTime = (m: number | null, s: number | null) => {
    const sec = Math.min(59, Math.max(0, s ?? 0))
    save({ ...c, minutes: m == null && !sec ? null : (m ?? 0) + sec / 60 })
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
    save({ ...c, distance: g.miles, minutes: g.minutes || c.minutes })
    setGpxMsg(`Imported ${g.name ? `“${g.name}”: ` : ''}${formatDistanceFor(g.miles, exercise.id, units)} in ${g.minutes} min${g.date ? ` (${g.date})` : ''}`)
  }
  const target = [targetDistance ? formatDistanceFor(targetDistance, exercise.id, units) : '', targetMinutes ? formatCardioTime(targetMinutes) : '', targetIncline ? `${targetIncline}% incline` : ''].filter(Boolean).join(' · ')
  // A treadmill's incline: what they set, else the plan's, for the estimate.
  const treadmill = inclinable(exercise.id)
  const incline = c.incline === undefined && treadmill ? targetIncline : c.incline
  // Calories: theirs (e.g. from a watch) if typed in, else an estimate from bodyweight, activity, time and pace.
  const day = date ?? current?.date ?? today
  const lb = bodyweightOn(bodyweight, day)
  const est = estimateCalories(exercise.id, { ...c, incline }, lb, aboutMe, day)
  const own = c.calories != null && c.calories > 0
  // Done: the card folds to one line, like a lifting card once every set is ticked, so the next exercise is in view.
  // Tap it to open it again; a choice to open or fold lasts until it's marked done or not done.
  const card = useRef<HTMLDivElement>(null)
  const [fold, setFold] = useState<{ collapsed: boolean; whenDone: boolean } | null>(null)
  const done = !readOnly && !!c.done
  const collapsed = fold && fold.whenDone === done ? fold.collapsed : done
  const toggleFold = () => setFold({ collapsed: !collapsed, whenDone: done })
  const logged = c.distance != null || c.minutes != null
  const markDone = () => {
    save({ ...c, done: !done })
    if (!done) setTimeout(() => card.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60)
  }
  const kcal = own ? c.calories : est
  const summary = [cardioLine({ ...c, incline }, exercise.id, units), kcal ? `${own ? '' : '≈'}${kcal} cal` : ''].filter((x) => x && x !== '–').join(' · ')
  if (collapsed) {
    return (
      <div ref={card} className="scroll-mt-4 flex items-start justify-between gap-2 rounded-2xl bg-surface px-4 py-3 shadow-sm ring-1 ring-neutral-200/70">
        <button onClick={toggleFold} className="min-w-0 text-left">
          <span className="block font-semibold">{done ? '✓ ' : ''}{exercise.name}</span>
          <span className="block text-xs text-neutral-400">{summary || 'Cardio'}</span>
        </button>
        <button onClick={toggleFold} aria-label={`Open ${exercise.name}`} aria-expanded={false} className="-mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm leading-none text-neutral-400 hover:bg-neutral-100">⌄</button>
      </div>
    )
  }
  return (
    <div ref={card} className="scroll-mt-4 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{exercise.name}</h3>
          <p className="text-xs text-neutral-400">Cardio{target ? ` · target ${target}` : ''}</p>
        </div>
        {!readOnly && logged && <button onClick={toggleFold} aria-label={`Fold ${exercise.name}`} aria-expanded className="-mt-1 ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm leading-none text-neutral-400 hover:bg-neutral-100">⌃</button>}
        <button onClick={() => setMenu(true)} aria-label={`${exercise.name} options`} className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg leading-none text-neutral-400 hover:bg-neutral-100">⋯</button>
      </div>
      {note && <p className="mb-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-600">{note}</p>}
      {readOnly ? <p className="text-sm text-neutral-500">Log it on the day.</p> : (<>
      <div role="group" aria-label={`${exercise.name} units`} className="mb-2 flex gap-1">
        {distanceUnitsFor(exercise.id).map((u) => (
          <button
            key={u}
            onClick={() => setDistanceUnit(exercise.id, u)}
            aria-pressed={unit === u}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${unit === u ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-500'}`}
          >
            {u}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_1.5fr_1fr] items-end gap-2">
        <label className="text-xs font-medium text-neutral-500">
          {{ m: 'Meters', yd: 'Yards', km: 'Km', mi: 'Miles' }[unit]}
          <NumberInput
            label={`${exercise.name} distance`}
            value={showDistanceIn(c.distance, unit)}
            step={unit === 'm' || unit === 'yd' ? (exercise.id === 'swimming' ? 25 : 100) : 0.1}
            // Empty boxes show a dash: the target is in the line above and last time below, never in the box.
            placeholder="–"
            onChange={(v) => save({ ...c, distance: storeDistanceIn(v, unit) })}
          />
        </label>
        <div className="text-xs font-medium text-neutral-500">
          Time <span className="font-normal text-neutral-400">min : sec</span>
          <div className="flex items-center gap-1">
            <NumberInput label={`${exercise.name} minutes`} value={wholeMin} placeholder="–" onChange={(v) => (v != null && !Number.isInteger(v) ? save({ ...c, minutes: v }) : setTime(v, secs))} />
            <span className="text-neutral-400">:</span>
            <NumberInput label={`${exercise.name} seconds`} value={secs || (wholeMin != null ? 0 : null)} placeholder="00" onChange={(v) => setTime(wholeMin, v)} />
          </div>
        </div>
        <div className="text-xs font-medium text-neutral-500">
          Pace
          <div className="py-2 text-center text-sm normal-case tabular-nums text-neutral-900">{formatPaceFor(c.distance, c.minutes, exercise.id, units) ?? '–'}</div>
        </div>
      </div>
      {treadmill && (
        <div className="mt-2 flex items-center gap-2 text-xs font-medium text-neutral-500">
          <span>Incline</span>
          <div className="w-20"><NumberInput label={`${exercise.name} incline`} value={c.incline ?? null} step={0.5} placeholder={targetIncline ? String(targetIncline) : '0'} onChange={(v) => save({ ...c, incline: v == null ? null : Math.min(40, Math.max(0, v)) })} /></div>
          <span className="font-normal text-neutral-400">%{c.incline === undefined && targetIncline ? ' (the plan’s, unless you change it)' : ''}</span>
        </div>
      )}
      </>)}
      {!readOnly && (() => {
        const personal = hasPersonalDetails(aboutMe)
        return (
          <div className="mt-3 flex items-start gap-3">
            <label className="w-24 shrink-0 text-xs font-medium text-neutral-500">
              Calories
              <NumberInput label={`${exercise.name} calories`} value={c.calories ?? null} step={10} placeholder={est != null ? `≈${est}` : '–'} onChange={(v) => save({ ...c, calories: v })} />
            </label>
            <p className="pt-5 text-xs text-neutral-400">
              {own ? 'Your number (e.g. from your watch).'
                : est != null ? <><b className="font-medium text-neutral-600">≈{est} cal, estimated</b> from your bodyweight ({showWeight(lb, units)} {units.weight}){personal ? ', sex, age, height' : ''}, the activity and its time{c.distance ? ' and pace' : ''}{incline ? ' and incline' : ''}. {personal ? '' : 'Add sex, age and height in Settings → Profile for a closer estimate. '}Type your watch’s number to use that instead.</>
                : !lb ? <>Estimated calories need your <b className="font-medium text-neutral-600">bodyweight</b> (add it in Progress → Body), plus this workout’s minutes. Or type your watch’s number.</>
                : 'Log the minutes to see estimated calories, or type your watch’s number.'}
            </p>
          </div>
        )
      })()}
      {!readOnly && (
        <button onClick={markDone} disabled={!logged && !done} aria-pressed={done} className={`mt-3 w-full rounded-2xl py-2.5 text-sm font-medium disabled:opacity-40 ${done ? 'bg-neutral-100 text-neutral-600' : 'bg-accent text-on-accent'}`}>
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
        <p className="mt-2 text-xs text-neutral-400">
          Last time: {cardioLine(prev, exercise.id, units)}
        </p>
      )}
    </div>
  )
}
