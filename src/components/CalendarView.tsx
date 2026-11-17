import { useEffect, useRef } from 'react'
import { dayNum, monthName, shortDate } from '../lib/dates'
import { STATE_LABEL, shortLabel } from '../lib/dayStyle'
import { addDaysIso, dayOf } from '../lib/plan'
import { dayState, weekAverage, weekMiles, type DayState } from '../lib/progress'
import { logKey, usePlan, useStore } from '../lib/store'
import { CheckIcon } from './ui'
import { typeColor } from '../lib/labels'

const CELL: Record<DayState, string> = {
  done: 'bg-accent/15 ring-accent/50', partial: 'bg-amber-50 ring-amber-700/40', skipped: 'bg-neutral-100 ring-neutral-200 opacity-60',
  missed: 'bg-red-50 ring-red-600/30', open: 'bg-surface ring-neutral-200/70', rest: 'bg-neutral-100/60 ring-transparent',
}

/** The whole plan, week by week like the printed calendar, with what's done. Tap a day to open it. */
export function CalendarView({ today, onOpen }: { today: string; onOpen: (date: string) => void }) {
  const plan = usePlan()
  const logs = useStore((s) => s.logs)
  const weights = useStore((s) => s.weights)
  const current = useRef<HTMLElement>(null)
  useEffect(() => { current.current?.scrollIntoView({ block: 'start' }) }, [])

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl">{plan.name}</h1>
        {plan.description && <p className="text-sm text-neutral-500">{plan.description}</p>}
      </header>
      {plan.weeks.map((w) => {
        const miles = weekMiles(plan, w, logs)
        const avg = weekAverage(weights, w.start)
        const end = addDaysIso(w.start, 6)
        const isNow = w.start <= today && today <= end
        const firstOfMonth = Array.from({ length: 7 }, (_, i) => addDaysIso(w.start, i)).find((d) => d.endsWith('-01'))
        return (
          <section key={w.number} ref={isNow ? current : undefined} aria-label={`Week ${w.number}`} className="scroll-mt-4">
            {(firstOfMonth || w.number === 1) && <h2 className="mb-2 mt-4 text-lg font-bold">{monthName(firstOfMonth ?? w.start)}</h2>}
            <div className={`rounded-3xl bg-surface p-3 shadow-sm ring-1 ${isNow ? 'ring-2 ring-accent-ink' : 'ring-neutral-200/60'}`}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 px-1 text-sm">
                <p className="font-semibold">
                  Week {w.number}{w.down && <span className="ml-1.5 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">Down</span>}
                  <span className="ml-2 font-normal text-neutral-500">{shortDate(w.start)}–{shortDate(end)}</span>
                </p>
                <p className="text-neutral-600">
                  {miles.done}/{miles.planned} mi
                  {w.goalLb != null && <span className="text-neutral-500"> · {avg != null ? `${avg} / ` : ''}{w.goalLb} lb</span>}
                </p>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 7 }, (_, i) => {
                  const date = addDaysIso(w.start, i)
                  const day = dayOf(plan, date)
                  const st = dayState(day, logs[logKey(plan.id, date)], today)
                  const race = plan.race?.date === date
                  return (
                    <button key={date} onClick={() => onOpen(date)} aria-label={`${shortDate(date)}: ${day?.items.map((it) => it.title).join(', ') || 'rest'}, ${STATE_LABEL[st]}`}
                      className={`relative flex min-h-16 flex-col items-start rounded-xl p-1 text-left ring-1 ${race ? 'bg-neutral-900 text-surface ring-neutral-900' : CELL[st]} ${date === today ? 'outline-2 outline-accent-ink' : ''}`}>
                      <span className="text-[11px] font-semibold">{dayNum(date)}</span>
                      {st === 'done' && <CheckIcon className="absolute right-1 top-1 h-3 w-3 text-accent-ink" />}
                      {day?.items.map((it, j) => (
                        <span key={j} className={`text-[10px] leading-tight ${race ? '' : typeColor(it.type)} ${it.title === 'Long run' ? 'font-bold' : ''}`}>{race && j === 0 ? 'Race' : shortLabel(it)}</span>
                      ))}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
