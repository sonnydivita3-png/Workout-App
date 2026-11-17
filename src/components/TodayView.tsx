import { useState } from 'react'
import { daysBetween, dayNum, longDate } from '../lib/dates'
import { addDaysIso, dayOf, phaseOf, targetOf, weekOf } from '../lib/plan'
import { dayState } from '../lib/progress'
import { STATE_DOT, STATE_LABEL } from '../lib/dayStyle'
import { logKey, usePlan, useStore } from '../lib/store'
import { ActivityCard, StrengthCard } from './ItemCards'
import { CheckButton, Chevron, card, sectionTitle } from './ui'
import { targetLine } from '../lib/labels'

/** One day of the plan: what to do, checked off as it's done. */
export function TodayView({ date, setDate, today }: { date: string; setDate: (d: string) => void; today: string }) {
  const plan = usePlan()
  const logs = useStore((s) => s.logs)
  const updateDay = useStore((s) => s.updateDay)
  const [showRoutine, setShowRoutine] = useState(false)
  const day = dayOf(plan, date)
  const week = weekOf(plan, date)
  const phase = phaseOf(plan, date)
  const target = targetOf(plan, day)
  const log = logs[logKey(plan.id, date)] ?? {}
  const weekStart = week?.start ?? addDaysIso(date, -((new Date(`${date}T12:00:00`).getDay() + 6) % 7))
  const toRace = plan.race ? daysBetween(today, plan.race.date) : null
  const training = !!day?.items.some((i) => i.type !== 'race')

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-2">
        <button onClick={() => setDate(addDaysIso(date, -1))} aria-label="Previous day" className="hit rounded-full p-2 text-neutral-500"><Chevron dir="left" className="h-5 w-5" /></button>
        <div className="min-w-0 text-center">
          <h1 className="text-2xl">{date === today ? 'Today' : longDate(date)}</h1>
          <p className="text-sm text-neutral-500">
            {[date === today ? longDate(date) : null, week ? `Week ${week.number} of ${plan.weeks.length}` : null, week?.down ? 'Down week' : null].filter(Boolean).join(' · ')}
          </p>
          {phase && <p className="text-xs text-neutral-500">{phase.name}</p>}
        </div>
        <button onClick={() => setDate(addDaysIso(date, 1))} aria-label="Next day" className="hit rounded-full p-2 text-neutral-500"><Chevron className="h-5 w-5" /></button>
      </header>

      <nav aria-label="This week" className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDaysIso(weekStart, i)
          const st = dayState(dayOf(plan, d), logs[logKey(plan.id, d)], today)
          const sel = d === date
          return (
            <button key={d} onClick={() => setDate(d)} aria-current={sel ? 'date' : undefined} aria-label={`${longDate(d)}, ${STATE_LABEL[st]}`}
              className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-xs ${sel ? 'bg-neutral-900 text-surface' : d === today ? 'bg-surface ring-1 ring-accent-ink' : 'bg-surface/60'}`}>
              <span className={sel ? 'opacity-80' : 'text-neutral-500'}>{'MTWTFSS'[i]}</span>
              <span className="font-semibold">{dayNum(d)}</span>
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[st]}`} />
            </button>
          )
        })}
      </nav>

      {date !== today && (
        <button onClick={() => setDate(today)} className="mx-auto block rounded-full bg-neutral-100 px-4 py-1.5 text-sm font-medium text-neutral-700">Back to today</button>
      )}

      {!day ? (
        <div className={card}>
          <p className="font-medium">Not part of the plan</p>
          <p className="text-sm text-neutral-500">{plan.name} runs {longDate(plan.start)} to {longDate(plan.end)}.</p>
        </div>
      ) : (
        <>
          {(day.label || day.items.length === 0) && (
            <div className={card}>
              <p className="text-lg font-semibold">{day.items.length === 0 ? 'Rest day' : day.label}</p>
              {day.items.length === 0 && day.label && <p className="text-sm text-neutral-600">{day.label}</p>}
              {day.items.length === 0 && week && i0(date, week.start) && week.miles != null && <p className="text-sm text-neutral-500">Run total this week: {week.miles} mi</p>}
            </div>
          )}
          {plan.race && date === plan.race.date && (
            <div className="rounded-3xl bg-neutral-900 p-4 text-surface">
              <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Race day</p>
              <p className="text-xl font-bold">{plan.race.name}</p>
              {plan.race.detail && <p className="text-sm opacity-80">{plan.race.detail}</p>}
            </div>
          )}
          {target && (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface/70 px-4 py-2.5 text-sm ring-1 ring-neutral-200/60">
              <span className="text-neutral-500">{target.label ?? 'Target'}</span>
              <span className="text-right font-medium">{targetLine(target)}</span>
            </div>
          )}
          {plan.routine && training && (
            <section className={card} aria-label={plan.routine.name}>
              <div className="flex items-center gap-3">
                <CheckButton checked={!!log.spine} onClick={() => updateDay(plan.id, date, (d) => ({ ...d, spine: !d.spine }))} label={`${plan.routine.name} done`} />
                <button onClick={() => setShowRoutine(!showRoutine)} aria-expanded={showRoutine} className="flex min-w-0 flex-1 items-center justify-between text-left">
                  <span>
                    <span className="block font-semibold">{plan.routine.name}{plan.routine.minutes ? ` · ${plan.routine.minutes} min` : ''}</span>
                    {plan.routine.when && <span className="block text-sm text-neutral-500">{plan.routine.when}</span>}
                  </span>
                  <Chevron dir={showRoutine ? 'up' : 'down'} className="h-4 w-4 text-neutral-500" />
                </button>
              </div>
              {showRoutine && <ol className="mt-3 list-decimal space-y-1 pl-16 text-sm text-neutral-700">{plan.routine.steps.map((s) => <li key={s}>{s}</li>)}</ol>}
            </section>
          )}
          {day.items.map((item, i) => {
            const Card = item.type === 'strength' && item.workout ? StrengthCard : ActivityCard
            // Keyed by date so fields start fresh on another day.
            return <Card key={`${date}-${i}`} plan={plan} date={date} index={i} item={item} log={log.items?.[i] ?? {}} />
          })}
          <section>
            <label htmlFor="day-note" className={sectionTitle}>Note</label>
            <textarea id="day-note" key={date} defaultValue={log.note ?? ''} rows={2} placeholder="How it went, back score, anything to remember"
              onChange={(e) => updateDay(plan.id, date, (d) => ({ ...d, note: e.target.value || undefined }))}
              className="w-full rounded-2xl bg-surface px-4 py-3 text-base outline-none ring-1 ring-neutral-200/60 placeholder:text-neutral-400" />
          </section>
        </>
      )}
      {toRace != null && toRace > 0 && plan.race && <p className="pt-2 text-center text-xs text-neutral-500">{toRace} days to {plan.race.name}</p>}
    </div>
  )
}

/** Is this the week's first day (where the printed plan shows the week's run total)? */
const i0 = (date: string, weekStart: string) => date === weekStart
