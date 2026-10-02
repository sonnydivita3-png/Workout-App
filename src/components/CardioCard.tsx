import { useRef, useState } from 'react'
import { parseGpx } from '../lib/gpx'
import { bodyweightOn, estimateCalories, hasPersonalDetails } from '../lib/calories'
import { cardioLine, distanceUnitFor, formatCardioTime, formatDistanceFor, formatPaceFor, showDistanceIn, showWeight, storeDistanceIn } from '../lib/units'
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

export function CardioCard({ exercise, current, last, targetMinutes, targetDistance, note, onChange, onRemove, onSwap, readOnly, date }: Props) {
  const units = useStore((s) => s.units)
  const bodyweight = useStore((s) => s.bodyweight)
  const aboutMe = useStore((s) => s.aboutMe)
  const today = useToday()
  const c = current?.cardio ?? { distance: null, minutes: null }
  const prev = last?.cardio
  // Rowers and other ergs count meters (pace per 500 m); everything else follows the miles/km setting.
  const unit = distanceUnitFor(exercise.id, units)
  // Time as minutes and seconds (a 2,000 m row in 7:32), stored as minutes.
  const wholeMin = c.minutes == null ? null : Math.floor(c.minutes + 1e-9)
  const secs = c.minutes == null ? null : Math.round((c.minutes - (wholeMin ?? 0)) * 60)
  const setTime = (m: number | null, s: number | null) => {
    const sec = Math.min(59, Math.max(0, s ?? 0))
    onChange({ ...c, minutes: m == null && !sec ? null : (m ?? 0) + sec / 60 })
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
    onChange({ ...c, distance: g.miles, minutes: g.minutes || c.minutes })
    setGpxMsg(`Imported ${g.name ? `“${g.name}”: ` : ''}${formatDistanceFor(g.miles, exercise.id, units)} in ${g.minutes} min${g.date ? ` (${g.date})` : ''}`)
  }
  const target = [targetDistance ? formatDistanceFor(targetDistance, exercise.id, units) : '', targetMinutes ? formatCardioTime(targetMinutes) : ''].filter(Boolean).join(' · ')
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{exercise.name}</h3>
          <p className="text-xs text-neutral-400">Cardio{target ? ` · target ${target}` : ''}</p>
        </div>
        <button onClick={() => setMenu(true)} aria-label={`${exercise.name} options`} className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg leading-none text-neutral-400 hover:bg-neutral-100">⋯</button>
      </div>
      {note && <p className="mb-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-600">{note}</p>}
      {readOnly ? <p className="text-sm text-neutral-500">Log it on the day.</p> : (
      <div className="grid grid-cols-[1fr_1.5fr_1fr] items-end gap-2">
        <label className="text-xs font-medium text-neutral-500">
          {unit === 'm' ? 'Meters' : unit === 'km' ? 'Km' : 'Miles'}
          <NumberInput
            label={`${exercise.name} distance`}
            value={showDistanceIn(c.distance, unit)}
            step={unit === 'm' ? 100 : 0.1}
            placeholder={showDistanceIn(prev?.distance ?? targetDistance ?? null, unit)?.toString() ?? '–'}
            onChange={(v) => onChange({ ...c, distance: storeDistanceIn(v, unit) })}
          />
        </label>
        <div className="text-xs font-medium text-neutral-500">
          Time <span className="font-normal text-neutral-400">min : sec</span>
          <div className="flex items-center gap-1">
            <NumberInput label={`${exercise.name} minutes`} value={wholeMin} placeholder={prev?.minutes != null ? String(Math.floor(prev.minutes)) : targetMinutes?.toString() ?? '–'} onChange={(v) => (v != null && !Number.isInteger(v) ? onChange({ ...c, minutes: v }) : setTime(v, secs))} />
            <span className="text-neutral-400">:</span>
            <NumberInput label={`${exercise.name} seconds`} value={secs || (wholeMin != null ? 0 : null)} placeholder="00" onChange={(v) => setTime(wholeMin, v)} />
          </div>
        </div>
        <div className="text-xs font-medium text-neutral-500">
          Pace
          <div className="py-2 text-center text-sm normal-case tabular-nums text-neutral-900">{formatPaceFor(c.distance, c.minutes, exercise.id, units) ?? '–'}</div>
        </div>
      </div>
      )}
      {!readOnly && (() => {
        // Calories: theirs (e.g. from a watch) if typed in, else an estimate from bodyweight, activity, time and pace.
        const day = date ?? current?.date ?? today
        const lb = bodyweightOn(bodyweight, day)
        const est = estimateCalories(exercise.id, c, lb, aboutMe, day)
        const personal = hasPersonalDetails(aboutMe)
        const own = c.calories != null && c.calories > 0
        return (
          <div className="mt-3 flex items-start gap-3">
            <label className="w-24 shrink-0 text-xs font-medium text-neutral-500">
              Calories
              <NumberInput label={`${exercise.name} calories`} value={c.calories ?? null} step={10} placeholder={est != null ? `≈${est}` : '–'} onChange={(v) => onChange({ ...c, calories: v })} />
            </label>
            <p className="pt-5 text-xs text-neutral-400">
              {own ? 'Your number (e.g. from your watch).'
                : est != null ? <><b className="font-medium text-neutral-600">≈{est} cal, estimated</b> from your bodyweight ({showWeight(lb, units)} {units.weight}){personal ? ', sex, age, height' : ''}, the activity and its time{c.distance ? ' and pace' : ''}. {personal ? '' : 'Add sex, age and height in Settings → Profile for a closer estimate. '}Type your watch’s number to use that instead.</>
                : !lb ? <>Estimated calories need your <b className="font-medium text-neutral-600">bodyweight</b> (add it in Progress → Body), plus this workout’s minutes. Or type your watch’s number.</>
                : 'Log the minutes to see estimated calories, or type your watch’s number.'}
            </p>
          </div>
        )
      })()}
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
      {prev && (() => {
        // Beat last time: go further, or cover the same distance faster.
        const faster = !!(c.distance && c.minutes && prev.distance && prev.minutes && c.distance >= prev.distance - 0.01 && c.minutes / c.distance < prev.minutes / prev.distance - 0.001)
        const further = !!(c.distance && prev.distance && c.distance > prev.distance + 0.01)
        if (faster || further) return <p className="mt-1 text-xs font-medium text-green-600">▲ {further && faster ? 'Further and faster' : further ? 'Further' : 'Faster'} than last time</p>
        if (!c.distance && !c.minutes && prev.distance && prev.minutes) return <p className="mt-1 text-xs text-neutral-500">🎯 Beat it: go past {formatDistanceFor(prev.distance, exercise.id, units)}, or hold under {formatPaceFor(prev.distance, prev.minutes, exercise.id, units)}</p>
        return null
      })()}
    </div>
  )
}
