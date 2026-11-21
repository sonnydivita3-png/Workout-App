import { itemLabel, typeColor } from '../lib/labels'
import { workoutOn, dayOf, type Plan } from '../lib/plan'
import { formatDuration, pace } from '../lib/progress'
import { logKey, useStore } from '../lib/store'
import { CheckIcon, card } from './ui'

/** A finished day, folded: what was done, with the numbers logged, and a way back in. */
export function DaySummary({ plan, date }: { plan: Plan; date: string }) {
  const log = useStore((s) => s.logs[logKey(plan.id, date)]) ?? {}
  const updateDay = useStore((s) => s.updateDay)
  const day = dayOf(plan, date)!
  // Missed workout (or every part skipped): it says so instead of done.
  const missed = day.items.every((_, i) => log.items?.[i]?.status === 'skipped')
  return (
    <section className={card} aria-label="Workout summary">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-lg font-semibold">
          {missed
            ? <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-base font-bold text-neutral-600">–</span>
            : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-on-accent"><CheckIcon className="h-4 w-4" /></span>}
          {missed ? 'Workout missed' : 'Workout done'}
        </p>
        <button onClick={() => updateDay(plan.id, date, (d) => ({ ...d, finished: undefined }))} className="hit rounded-full bg-neutral-100 px-4 py-1.5 text-sm font-medium text-neutral-700">Edit</button>
      </div>
      <ul className="space-y-1.5 text-sm">
        {plan.routine && log.spine && <li className="text-neutral-600">✓ {plan.routine.name}</li>}
        {day.items.map((it, i) => {
          const l = log.items?.[i] ?? {}
          const skipped = l.status === 'skipped'
          const ex = it.workout ? workoutOn(plan, it.workout, date)?.version.exercises : undefined
          const ticked = ex ? ex.filter((_, j) => l.ex?.[j]?.done).length : 0
          const details = [
            l.miles != null ? `${l.miles} mi` : '',
            l.minutes != null ? formatDuration(l.minutes) : '',
            pace(l.miles, l.minutes) ?? '',
            ex && ticked > 0 && ticked < ex.length ? `${ticked} of ${ex.length} exercises` : '',
          ].filter(Boolean).join(' · ')
          return (
            <li key={i} className={skipped ? 'text-neutral-500' : ''}>
              <span className={skipped && !missed ? 'line-through' : skipped ? '' : typeColor(it.type)}>{skipped ? '–' : '✓'} {itemLabel(it)}</span>
              {skipped && !missed && <span className="ml-1">(skipped)</span>}
              {details && !skipped && <span className="block pl-4 text-neutral-500">{details}</span>}
            </li>
          )
        })}
      </ul>
      {log.note && <p className="mt-2 whitespace-pre-line border-t border-neutral-200/70 pt-2 text-sm text-neutral-600">{log.note}</p>}
    </section>
  )
}
