import { useState } from 'react'
import { DAY_LABELS, parseISO, weekdayIndex } from '../lib/dates'
import { dayPlanOf, isRestDay } from '../lib/plan'
import { useStore } from '../store'
import { primaryBtn, rowBtn, Sheet } from './Sheet'

type Mode = 'menu' | 'copy' | 'save' | 'load'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** `weekDates` are the 7 ISO dates (Mon–Sun) of the week being viewed. */
export function DaySheet({ date, weekDates, onClose }: { date: string; weekDates: string[]; onClose: () => void }) {
  const { plan, overrides, routines, copyDay, saveRoutine, deleteRoutine, loadRoutine, resetDay, setRestDay } = useStore()
  const [mode, setMode] = useState<Mode>('menu')
  const [targets, setTargets] = useState<number[]>([])
  const [name, setName] = useState('')
  const day = weekdayIndex(parseISO(date))
  const planned = dayPlanOf(plan, overrides, date)
  const planOf = (i: number) => dayPlanOf(plan, overrides, weekDates[i])
  const empty = planned.length === 0
  const rest = isRestDay(overrides, date)

  const toggle = (i: number) => setTargets((t) => (t.includes(i) ? t.filter((x) => x !== i) : [...t, i]))

  if (mode === 'copy') {
    return (
      <Sheet title={`Copy ${DAY_NAMES[day]} to…`} onClose={onClose} closeLabel="Cancel">
        <div className="grid grid-cols-7 gap-1.5 pb-2">
          {DAY_LABELS.map((l, i) =>
            i === day ? (
              <span key={l} />
            ) : (
              <button
                key={l}
                onClick={() => toggle(i)}
                className={`rounded-xl py-2 text-sm ${targets.includes(i) ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}
              >
                {l}
                {planOf(i).length > 0 && <span className="block text-[10px] opacity-60">{planOf(i).length} ex</span>}
              </button>
            ),
          )}
        </div>
        {targets.some((i) => planOf(i).length > 0) && (
          <p className="pb-3 text-xs text-neutral-400">Days that already have exercises will be replaced.</p>
        )}
        <button
          disabled={targets.length === 0}
          onClick={() => { copyDay(date, targets.map((i) => weekDates[i])); onClose() }}
          className={primaryBtn}
        >
          Copy to {targets.length || ''} day{targets.length === 1 ? '' : 's'}
        </button>
      </Sheet>
    )
  }

  if (mode === 'save') {
    return (
      <Sheet title="Save as routine" onClose={onClose} closeLabel="Cancel">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Push Day"
          className="mb-3 w-full rounded-xl bg-neutral-100 px-4 py-2.5 outline-none"
        />
        <button
          disabled={!name.trim()}
          onClick={() => { saveRoutine(name, planned); onClose() }}
          className={primaryBtn}
        >
          Save {planned.length} exercise{planned.length === 1 ? '' : 's'}
        </button>
      </Sheet>
    )
  }

  if (mode === 'load') {
    return (
      <Sheet title="Load a routine" onClose={onClose}>
        <ul>
          {routines.map((r) => (
            <li key={r.id} className="flex items-center">
              <button onClick={() => { loadRoutine(date, r.id); onClose() }} className={rowBtn}>
                <span>{r.name}</span>
                <span className="text-xs text-neutral-400">{r.items.length} exercises</span>
              </button>
              <button
                onClick={() => confirm(`Delete “${r.name}”?`) && deleteRoutine(r.id)}
                aria-label={`Delete ${r.name}`}
                className="px-3 text-lg text-neutral-300"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <p className="pt-2 text-xs text-neutral-400">Adds the routine’s exercises to {DAY_NAMES[day]}.</p>
      </Sheet>
    )
  }

  return (
    <Sheet title={DAY_NAMES[day]} onClose={onClose}>
      <button disabled={empty} onClick={() => setMode('copy')} className={rowBtn}>
        <span>Copy this day to other days</span><span className="text-neutral-300">›</span>
      </button>
      <button disabled={empty} onClick={() => setMode('save')} className={rowBtn}>
        <span>Save as routine</span><span className="text-neutral-300">›</span>
      </button>
      <button disabled={routines.length === 0} onClick={() => setMode('load')} className={rowBtn}>
        <span>Load a routine</span>
        <span className="text-xs text-neutral-400">{routines.length ? `${routines.length} saved` : 'None saved yet'}</span>
      </button>
      {rest ? (
        <button onClick={() => { resetDay(date); onClose() }} className={rowBtn}>
          <span>Cancel rest day</span>
          <span className="text-xs text-neutral-400">Go back to the weekly plan</span>
        </button>
      ) : (
        <button
          onClick={() => {
            if (planned.length > 0 && !confirm(`Make this a rest day? This clears the ${planned.length} planned exercise${planned.length === 1 ? '' : 's'} for this date.`)) return
            setRestDay(date)
            onClose()
          }}
          className={rowBtn}
        >
          <span>Make this a rest day</span>
          <span className="text-xs text-neutral-400">This date only</span>
        </button>
      )}
      {overrides[date] && !rest && (
        <button onClick={() => { resetDay(date); onClose() }} className={rowBtn}>
          <span>Reset to weekly plan</span>
          <span className="text-xs text-neutral-400">Undo generated plan for this day</span>
        </button>
      )}
    </Sheet>
  )
}
