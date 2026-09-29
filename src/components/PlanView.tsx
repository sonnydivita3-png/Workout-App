import { useMemo, useState } from 'react'
import { parseISO, toISO, weekDates, weekdayIndex } from '../lib/dates'
import { groupByBlock } from '../lib/describe'
import { dayPlanOf, isRestDay } from '../lib/plan'
import { findExercise, selectLastLog, useStore } from '../store'
import { IntervalTimerSheet } from './IntervalTimerSheet'
import { circuitSegments, parseCircuit } from '../lib/wod'
import { TimedBlockCard } from './TimedBlockCard'
import { WodBuilderSheet } from './WodBuilderSheet'
import { ProgramsCard } from './ProgramsCard'
import { CardioPlanSheet } from './CardioPlanSheet'
import { ProgramSheet } from './ProgramSheet'
import { RandomizerSheet } from './RandomizerSheet'
import type { GeneratorMode } from './ModeSwitch'
import { DaySheet } from './DaySheet'
import { rowBtn, Sheet } from './Sheet'
import { CardioCard } from './CardioCard'
import { ExercisePicker } from './ExercisePicker'
import { StrengthCard } from './StrengthCard'
import { WeekStrip } from './WeekStrip'

export function PlanView() {
  const [anchor, setAnchor] = useState(() => new Date())
  const [day, setDay] = useState(() => weekdayIndex(new Date()))
  const [today] = useState(() => toISO(new Date()))
  const [picking, setPicking] = useState(false)
  const [addMenu, setAddMenu] = useState(false)
  const [wodBuilder, setWodBuilder] = useState(false)
  const [circuitTimer, setCircuitTimer] = useState<{ title: string; segments: ReturnType<typeof circuitSegments> } | null>(null)
  const [dayMenu, setDayMenu] = useState(false)
  const [generator, setGenerator] = useState<GeneratorMode | null>(null)
  const s = useStore()

  const dates = useMemo(() => weekDates(anchor), [anchor])
  const date = toISO(dates[day])
  const planned = dayPlanOf(s.plan, s.overrides, date)
  const rest = isRestDay(s.overrides, date)
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

      <WeekStrip dates={dates} selected={day} counts={dates.map((d) => dayPlanOf(s.plan, s.overrides, toISO(d)).length)} rest={dates.map((d) => isRestDay(s.overrides, toISO(d)))} today={today} onSelect={setDay} />

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={() => setDayMenu(true)} className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-600">
          Day options
        </button>
      </div>

      <ProgramsCard onReplace={(kind) => setGenerator(kind === 'cardio' ? 'cardio' : 'program')} />

      <section className="mt-3 space-y-3">
        {planned.length === 0 && rest && (
          <div className="rounded-2xl bg-surface px-4 py-10 text-center shadow-sm ring-1 ring-neutral-200/70">
            <p className="text-lg font-semibold">Rest day</p>
            <p className="mt-1 text-sm text-neutral-400">Recovery is part of the plan 😴</p>
            <button onClick={() => s.resetDay(date)} className="mt-4 rounded-full bg-neutral-100 px-4 py-1.5 text-sm text-neutral-600">
              Cancel rest day
            </button>
          </div>
        )}
        {planned.length === 0 && !rest && (
          <p className="py-12 text-center text-neutral-400">Nothing planned yet. Add a move, hit Randomize, or call it a rest day 😴</p>
        )}
        {groupByBlock(planned).map((g, gi) => g.items[0].item.wod ? (
          <TimedBlockCard key={g.block ?? gi} items={g.items.map((x) => x.item)} date={date} onRemove={() => g.items.forEach((x) => s.removeExercise(date, x.item.exerciseId))} />
        ) : (
          <div key={gi} className={g.block ? 'space-y-2 rounded-3xl bg-neutral-200/50 p-2' : 'contents'}>
            {g.block && g.label && <p className="px-2 pt-1 text-[11px] uppercase tracking-wide text-neutral-500">{g.label}</p>}
            {(() => {
              const c = parseCircuit(g.label, g.items.map((x) => x.item))
              if (!c) return null
              const names = g.items.map((x) => findExercise(s.custom, x.item.exerciseId)?.name ?? 'Exercise')
              return <button onClick={() => setCircuitTimer({ title: 'HIIT circuit', segments: circuitSegments(names, c) })} className="mx-2 rounded-full bg-surface px-3 py-1 text-xs text-neutral-600 ring-1 ring-neutral-200/70">⏱ Start circuit timer</button>
            })()}
            {g.items.map(({ item: p }) => {
              const ex = findExercise(s.custom, p.exerciseId)
              if (!ex) return null
              const current = s.logs.find((l) => l.date === date && l.exerciseId === ex.id)
              const last = selectLastLog(s.logs, ex.id, date)
              return ex.kind === 'strength' ? (
                <StrengthCard
                  key={ex.id}
                  exercise={ex}
                  setCount={p.sets}
                  targetReps={p.reps}
                  targetSeconds={p.seconds}
                  note={p.note}
                  current={current}
                  last={last}
                  onSetCount={(n) => s.setSetCount(date, ex.id, n)}
                  onChange={(sets) => s.saveStrength(date, ex.id, sets)}
                  onRemove={() => s.removeExercise(date, ex.id)}
                />
              ) : (
                <CardioCard
                  key={ex.id}
                  exercise={ex}
                  current={current}
                  last={last}
                  targetMinutes={p.minutes}
                  targetDistance={p.distance}
                  note={p.note}
                  onChange={(c) => s.saveCardio(date, ex.id, c)}
                  onRemove={() => s.removeExercise(date, ex.id)}
                />
              )
            })}
          </div>
        ))}
      </section>

      <button
        onClick={() => setAddMenu(true)}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-10 -translate-x-1/2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-on-accent shadow-lg"
      >
        + Add
      </button>

      {addMenu && (
        <Sheet title="Add to this day" onClose={() => setAddMenu(false)}>
          {([
            ['Add an exercise', 'Pick from 750+ exercises', () => setPicking(true)],
            ['Randomize a workout', 'Muscles, style and time, or a random week/month', () => setGenerator('one')],
            ['Build a timed workout', 'AMRAP, EMOM or for time, with a built-in clock', () => setWodBuilder(true)],
            ['Start a training plan', 'Run or bike plan for a goal or race', () => setGenerator('cardio')],
          ] as const).map(([title, hint, go]) => (
            <button key={title} onClick={() => { setAddMenu(false); go() }} className={rowBtn}>
              <span><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-neutral-400">{hint}</span></span>
              <span className="text-neutral-300">›</span>
            </button>
          ))}
        </Sheet>
      )}
      {circuitTimer && <IntervalTimerSheet title={circuitTimer.title} segments={circuitTimer.segments} onClose={() => setCircuitTimer(null)} />}
      {wodBuilder && <WodBuilderSheet date={date} onClose={() => setWodBuilder(false)} />}
      {generator === 'one' && <RandomizerSheet date={date} onClose={() => setGenerator(null)} onSwitchMode={setGenerator} />}
      {generator === 'program' && (
        <ProgramSheet
          onClose={() => setGenerator(null)}
          onSwitchMode={setGenerator}
          onApplied={(first) => { setAnchor(parseISO(first)); setDay(weekdayIndex(parseISO(first))) }}
        />
      )}
      {generator === 'cardio' && (
        <CardioPlanSheet
          onClose={() => setGenerator(null)}
          onApplied={(first) => { setAnchor(parseISO(first)); setDay(weekdayIndex(parseISO(first))) }}
        />
      )}
      {dayMenu && <DaySheet date={date} weekDates={dates.map(toISO)} onClose={() => setDayMenu(false)} />}

      {picking && (
        <ExercisePicker
          taken={new Set(planned.map((p) => p.exerciseId))}
          onPick={(e) => s.addExercise(date, e.id, e.kind)}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}
