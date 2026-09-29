import { useMemo, useState } from 'react'
import { toISO, weekDates, weekdayIndex } from '../lib/dates'
import { findExercise, selectLastLog, useStore } from '../store'
import { CardioCard } from './CardioCard'
import { ExercisePicker } from './ExercisePicker'
import { StrengthCard } from './StrengthCard'
import { WeekStrip } from './WeekStrip'

export function PlanView() {
  const [anchor, setAnchor] = useState(() => new Date())
  const [day, setDay] = useState(() => weekdayIndex(new Date()))
  const [today] = useState(() => toISO(new Date()))
  const [picking, setPicking] = useState(false)
  const s = useStore()

  const dates = useMemo(() => weekDates(anchor), [anchor])
  const date = toISO(dates[day])
  const planned = s.plan[day]
  const shiftWeek = (n: number) => setAnchor((a) => new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7 * n))

  return (
    <>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {dates[0].toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} –{' '}
          {dates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </h1>
        <div className="flex gap-1 text-neutral-500">
          <button onClick={() => shiftWeek(-1)} aria-label="Previous week" className="h-8 w-8 rounded-full hover:bg-neutral-200/60">‹</button>
          <button onClick={() => shiftWeek(1)} aria-label="Next week" className="h-8 w-8 rounded-full hover:bg-neutral-200/60">›</button>
        </div>
      </header>

      <WeekStrip dates={dates} selected={day} counts={s.plan.map((d) => d.length)} today={today} onSelect={setDay} />

      <section className="mt-6 space-y-3">
        {planned.length === 0 && (
          <p className="py-12 text-center text-neutral-400">Rest day. Add exercises to plan a workout.</p>
        )}
        {planned.map((p) => {
          const ex = findExercise(s.custom, p.exerciseId)
          if (!ex) return null
          const current = s.logs.find((l) => l.date === date && l.exerciseId === ex.id)
          const last = selectLastLog(s.logs, ex.id, date)
          return ex.kind === 'strength' ? (
            <StrengthCard
              key={ex.id}
              exercise={ex}
              setCount={p.sets}
              current={current}
              last={last}
              onSetCount={(n) => s.setSetCount(day, ex.id, n)}
              onChange={(sets) => s.saveStrength(date, ex.id, sets)}
              onRemove={() => s.removeExercise(day, ex.id)}
            />
          ) : (
            <CardioCard
              key={ex.id}
              exercise={ex}
              current={current}
              last={last}
              onChange={(c) => s.saveCardio(date, ex.id, c)}
              onRemove={() => s.removeExercise(day, ex.id)}
            />
          )
        })}
      </section>

      <button
        onClick={() => setPicking(true)}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-10 -translate-x-1/2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white shadow-lg"
      >
        + Add exercise
      </button>

      {picking && (
        <ExercisePicker
          taken={new Set(planned.map((p) => p.exerciseId))}
          onPick={(e) => s.addExercise(day, e.id, e.kind)}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}
