import { useRef, useState } from 'react'
import { parseGpx } from '../lib/gpx'
import { formatPace, showDistance, storeDistance } from '../lib/units'
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
}

export function CardioCard({ exercise, current, last, targetMinutes, targetDistance, note, onChange, onRemove }: Props) {
  const units = useStore((s) => s.units)
  const c = current?.cardio ?? { distance: null, minutes: null }
  const prev = last?.cardio
  const file = useRef<HTMLInputElement>(null)
  const [gpxMsg, setGpxMsg] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  // GPS files only make sense for runs, rides, walks and hikes outside, not machines.
  const outdoor = exercise.equipment === 'Outdoor'
  const importGpx = async (f: File | undefined) => {
    if (!f) return
    const g = parseGpx(await f.text())
    if (!g || !g.miles) { setGpxMsg('Couldn’t find a GPS track in that file.'); return }
    onChange({ distance: g.miles, minutes: g.minutes || c.minutes })
    setGpxMsg(`Imported ${g.name ? `“${g.name}”: ` : ''}${showDistance(g.miles, units)} ${units.distance} in ${g.minutes} min${g.date ? ` (${g.date})` : ''}`)
  }
  const target = [targetDistance ? `${showDistance(targetDistance, units)} ${units.distance}` : '', targetMinutes ? `${targetMinutes} min` : ''].filter(Boolean).join(' · ')
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
      <div className="grid grid-cols-3 items-end gap-3">
        <label className="text-xs font-medium text-neutral-500">
          {units.distance === 'km' ? 'Km' : 'Miles'}
          <NumberInput
            value={showDistance(c.distance, units)}
            step={0.1}
            placeholder={showDistance(prev?.distance ?? targetDistance ?? null, units)?.toString() ?? '–'}
            onChange={(v) => onChange({ ...c, distance: storeDistance(v, units) })}
          />
        </label>
        <label className="text-xs font-medium text-neutral-500">
          Minutes
          <NumberInput value={c.minutes} step={0.5} placeholder={(prev?.minutes ?? targetMinutes)?.toString() ?? '–'} onChange={(v) => onChange({ ...c, minutes: v })} />
        </label>
        <div className="text-xs font-medium text-neutral-500">
          Pace
          <div className="py-2 text-center text-base normal-case tabular-nums text-neutral-900">{formatPace(c.distance, c.minutes, units) ?? '–'}</div>
        </div>
      </div>
      {outdoor && <input ref={file} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" aria-label="Import a GPX file" className="hidden" onChange={(e) => { void importGpx(e.target.files?.[0]); e.target.value = '' }} />}
      {gpxMsg && <p role="status" className="mt-2 text-xs text-neutral-500">{gpxMsg}</p>}
      {menu && (
        <Sheet title={exercise.name} onClose={() => setMenu(false)}>
          {outdoor && <button onClick={() => { setMenu(false); file.current?.click() }} className={rowBtn}><span>Import a GPX file</span><span className="text-xs text-neutral-400">From a watch or Strava</span></button>}
          <button onClick={() => { setMenu(false); onRemove() }} className={`${rowBtn} text-red-600`}><span>Remove exercise</span></button>
        </Sheet>
      )}
      {prev && (
        <p className="mt-2 text-xs text-neutral-400">
          Last time: {showDistance(prev.distance, units) ?? '–'} {units.distance} · {prev.minutes ?? '–'} min · {formatPace(prev.distance, prev.minutes, units) ?? '–'}
        </p>
      )}
      {prev && (() => {
        // Beat last time: go further, or cover the same distance faster.
        const faster = !!(c.distance && c.minutes && prev.distance && prev.minutes && c.distance >= prev.distance - 0.01 && c.minutes / c.distance < prev.minutes / prev.distance - 0.001)
        const further = !!(c.distance && prev.distance && c.distance > prev.distance + 0.01)
        if (faster || further) return <p className="mt-1 text-xs font-medium text-green-600">▲ {further && faster ? 'Further and faster' : further ? 'Further' : 'Faster'} than last time</p>
        if (!c.distance && !c.minutes && prev.distance && prev.minutes) return <p className="mt-1 text-xs text-neutral-500">🎯 Beat it: go past {showDistance(prev.distance, units)} {units.distance}, or hold under {formatPace(prev.distance, prev.minutes, units)}</p>
        return null
      })()}
    </div>
  )
}
