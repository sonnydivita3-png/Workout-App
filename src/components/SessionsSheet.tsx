import { useState } from 'react'
import { groupByBlock } from '../lib/describe'
import { dayPlanOf } from '../lib/plan'
import { minutesFor } from '../lib/randomizer'
import { isSplit, joinSessions, sessionLabel, SESSIONS, suggestSessions, withSessions } from '../lib/sessions'
import { findExercise, useStore } from '../store'
import type { DaySession } from '../types'
import { primaryBtn, Sheet } from './Sheet'

const chip = (on: boolean) => `min-h-9 rounded-full px-3 text-sm ${on ? 'bg-accent font-medium text-on-accent' : 'bg-neutral-100 text-neutral-600'}`

/**
 * Two sessions on a day: which part of it goes in the morning and which in the evening (a run before work, weights
 * after). Each session then has its own time, calories, reminder and Finish. On a split day, it can go back to one.
 */
export function SessionsSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const s = useStore()
  const items = dayPlanOf(s.plan, s.overrides, date)
  const split = isSplit(items)
  const [draft, setDraft] = useState<DaySession[]>(() => suggestSessions(items))
  const units = groupByBlock(items)
  const nameOf = (u: (typeof units)[number]) => {
    if (u.items[0].item.warmup) return 'Warm-up'
    if (u.block && u.label) return u.label.split(' · ')[0]
    return findExercise(s.custom, u.items[0].item.exerciseId)?.name ?? 'Exercise'
  }
  const whenOf = (u: (typeof units)[number]) => draft[u.items[0].index]
  const put = (u: (typeof units)[number], to: DaySession) => setDraft((d) => d.map((x, i) => (u.items.some((y) => y.index === i) ? to : x)))
  // Each session needs something besides a warm-up.
  const has = (ses: DaySession) => units.some((u) => !u.items[0].item.warmup && whenOf(u) === ses)
  const ready = has('am') && has('pm')

  return (
    <Sheet title="Morning & evening" onClose={onClose} closeLabel="Cancel">
      <p className="mb-3 text-sm text-neutral-500">
        Pick when each part happens. Each session gets its own time, calories, reminder and Finish. Lifting and cardio
        several hours apart is better for strength than back to back.
      </p>
      <ul className="mb-4 space-y-2">
        {units.map((u) => {
          const name = nameOf(u)
          const minutes = Math.round(minutesFor(u.items.map((x) => x.item)))
          const detail = [u.items.length > 1 ? `${u.items.length} exercises` : '', minutes > 0 ? `~${minutes} min` : ''].filter(Boolean).join(' · ')
          return (
            <li key={u.items[0].index} className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-50 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{name}</span>
                {detail && <span className="block text-xs text-neutral-500">{detail}</span>}
              </span>
              <span role="radiogroup" aria-label={`When to do ${name}`} className="flex shrink-0 gap-1">
                {SESSIONS.map((ses) => (
                  <button key={ses} role="radio" aria-checked={whenOf(u) === ses} onClick={() => put(u, ses)} className={chip(whenOf(u) === ses)}>
                    {sessionLabel(ses)}
                  </button>
                ))}
              </span>
            </li>
          )
        })}
      </ul>
      {!ready && <p role="status" className="mb-3 text-xs text-neutral-500">Put at least one exercise in each session.</p>}
      <button disabled={!ready} onClick={() => { s.setDayItems(date, withSessions(items, draft)); onClose() }} className={primaryBtn}>
        {split ? 'Save' : 'Split into two sessions'}
      </button>
      {split && (
        <button onClick={() => { s.setDayItems(date, joinSessions(items)); onClose() }} className="mt-2 w-full rounded-2xl bg-neutral-100 py-3 text-sm font-medium text-neutral-700">
          Back to one session
        </button>
      )}
    </Sheet>
  )
}
