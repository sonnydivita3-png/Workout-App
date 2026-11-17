import { useState } from 'react'
import { workoutOn, type Plan, type PlanItem } from '../lib/plan'
import { formatDuration, pace, parseDuration } from '../lib/progress'
import { updateItem, type ItemLog, type SetLog } from '../lib/store'
import { CheckButton, Chevron, card, input } from './ui'
import { itemLabel, typeColor, typeDot } from '../lib/labels'

interface Props {
  plan: Plan
  date: string
  index: number
  item: PlanItem
  log: ItemLog
}

const numOrUndef = (t: string) => {
  const n = Number(t.trim())
  return t.trim() && Number.isFinite(n) && n >= 0 ? n : undefined
}

/** Done / Skip for an item, shared by every card. */
function StatusRow({ plan, date, index, item, log, extra }: Props & { extra?: React.ReactNode }) {
  const done = log.status === 'done'
  const skipped = log.status === 'skipped'
  const set = (status?: ItemLog['status']) => updateItem(plan.id, date, index, (l) => ({ ...l, status }))
  return (
    <div className="flex items-start gap-3">
      <CheckButton checked={done} onClick={() => set(done ? undefined : 'done')} label={`${item.title} done`} />
      <div className={`min-w-0 flex-1 ${skipped ? 'opacity-50' : ''}`}>
        <p className={`flex items-center gap-2 font-semibold ${typeColor(item.type)} ${skipped ? 'line-through' : ''}`}>
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${typeDot(item.type)}`} />
          {itemLabel(item)}
        </p>
        {item.fuel && <p className="text-sm text-neutral-500">Fuel {item.fuel}</p>}
        {extra}
      </div>
      <button onClick={() => set(skipped ? undefined : 'skipped')} aria-pressed={skipped}
        className={`hit shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${skipped ? 'bg-neutral-200 text-neutral-800' : 'text-neutral-500'}`}>
        {skipped ? 'Skipped' : 'Skip'}
      </button>
    </div>
  )
}

/** A run, hike, ride or race: done or skipped, and what it actually came to. */
export function ActivityCard(props: Props) {
  const { plan, date, index, item, log } = props
  const hasMiles = item.type === 'run' || item.type === 'race' || item.miles != null
  const [miles, setMiles] = useState(log.miles != null ? String(log.miles) : '')
  const [time, setTime] = useState(log.minutes != null ? formatDuration(log.minutes).replace(' min', '') : '')
  const save = (patch: Partial<ItemLog>) => updateItem(plan.id, date, index, (l) => ({ ...l, ...patch }))
  const p = pace(log.miles ?? (log.status === 'done' ? item.miles : undefined), log.minutes)
  return (
    <section className={card} aria-label={item.title}>
      <StatusRow {...props} />
      {log.status === 'done' && (
        <div className="mt-3 flex items-end gap-2 pl-12">
          {hasMiles && (
            <label className="w-24 text-xs text-neutral-500">Miles
              <input inputMode="decimal" value={miles} placeholder={item.miles != null ? String(item.miles) : ''} aria-label={`${item.title} miles`}
                onChange={(e) => { setMiles(e.target.value); save({ miles: numOrUndef(e.target.value) }) }} className={`${input} mt-1`} />
            </label>
          )}
          <label className="w-28 text-xs text-neutral-500">Time (h:mm)
            <input inputMode="numeric" value={time} placeholder={item.minutes != null ? formatDuration(item.minutes).replace(' min', '') : ''} aria-label={`${item.title} time`}
              onChange={(e) => { setTime(e.target.value); const m = parseDuration(e.target.value); save({ minutes: m ?? undefined }) }} className={`${input} mt-1`} />
          </label>
          {p && <p className="pb-2 text-sm text-neutral-500">{p}</p>}
        </div>
      )}
    </section>
  )
}

/** A strength workout: its exercises for that date's phase, each checked off, with optional weight × reps per set. */
export function StrengthCard(props: Props) {
  const { plan, date, index, item, log } = props
  const found = item.workout ? workoutOn(plan, item.workout, date) : undefined
  const [open, setOpen] = useState<number | null>(null)
  const [showNotes, setShowNotes] = useState(false)
  if (!found) return <ActivityCard {...props} />
  const { workout, version } = found
  const exs = version.exercises
  const exLog = log.ex ?? {}
  const doneCount = exs.filter((_, i) => exLog[i]?.done).length
  const toggleEx = (i: number) => updateItem(plan.id, date, index, (l) => {
    const ex = { ...l.ex, [i]: { ...l.ex?.[i], done: !l.ex?.[i]?.done } }
    const all = exs.every((_, j) => ex[j]?.done)
    const wasAll = exs.every((_, j) => l.ex?.[j]?.done)
    // Every exercise ticked: the workout is done. Unticking one of them takes that back (a workout marked done
    // without ticking exercises stays done).
    return { ...l, ex, status: all ? 'done' : wasAll && l.status === 'done' ? undefined : l.status }
  })
  const setSet = (i: number, s: number, patch: SetLog) => updateItem(plan.id, date, index, (l) => {
    const sets = [...(l.ex?.[i]?.sets ?? [])]
    sets[s] = { ...sets[s], ...patch }
    return { ...l, ex: { ...l.ex, [i]: { ...l.ex?.[i], sets } } }
  })
  const notes = [...(version.note ? [version.note] : []), ...(workout.notes ?? [])]
  return (
    <section className={card} aria-label={item.title}>
      <StatusRow {...props} extra={
        <p className="text-sm text-neutral-500">{[workout.focus, version.label, `${doneCount} of ${exs.length} exercises`].filter(Boolean).join(' · ')}</p>
      } />
      <ul className="mt-3 divide-y divide-neutral-200/70">
        {exs.map((e, i) => {
          const l = exLog[i]
          const expanded = open === i
          return (
            <li key={i} className="py-2">
              <div className="flex items-center gap-3">
                <CheckButton checked={!!l?.done} onClick={() => toggleEx(i)} label={`${e.name} done`} size="h-7 w-7" />
                <button onClick={() => setOpen(expanded ? null : i)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
                  <span className={`min-w-0 text-sm ${l?.done ? 'text-neutral-500' : ''}`}>{e.name}</span>
                  <span className="flex shrink-0 items-center gap-1 text-sm text-neutral-500">
                    {e.prescription}
                    {l?.sets?.some((s) => s?.lb || s?.reps) && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-label="weights logged" />}
                    <Chevron dir={expanded ? 'up' : 'down'} className="h-3.5 w-3.5" />
                  </span>
                </button>
              </div>
              {expanded && (
                <div className="mt-2 space-y-1.5 pl-10">
                  {Array.from({ length: e.sets }, (_, s) => {
                    const v = l?.sets?.[s]
                    return (
                      <div key={s} className="flex items-center gap-2 text-sm">
                        <span className="w-12 shrink-0 whitespace-nowrap text-neutral-500">Set {s + 1}</span>
                        <input inputMode="decimal" aria-label={`${e.name} set ${s + 1} weight`} placeholder="lb" defaultValue={v?.lb ?? ''}
                          onChange={(ev) => setSet(i, s, { lb: numOrUndef(ev.target.value) })} className={`${input} w-20 py-1.5`} />
                        <span className="text-neutral-400">×</span>
                        <input inputMode="numeric" aria-label={`${e.name} set ${s + 1} reps`} placeholder="reps" defaultValue={v?.reps ?? ''}
                          onChange={(ev) => setSet(i, s, { reps: numOrUndef(ev.target.value) })} className={`${input} w-20 py-1.5`} />
                      </div>
                    )
                  })}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {notes.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setShowNotes(!showNotes)} aria-expanded={showNotes} className="flex items-center gap-1 text-xs font-medium text-neutral-500">
            How to lift <Chevron dir={showNotes ? 'up' : 'down'} className="h-3 w-3" />
          </button>
          {showNotes && <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-600">{notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        </div>
      )}
    </section>
  )
}
