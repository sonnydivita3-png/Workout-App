import { useMemo, useState } from 'react'
import { parseISO, toISO, weekDates, weekdayIndex } from '../lib/dates'
import { dayLabel, dayPlanOf, isRestDay, workItems } from '../lib/plan'
import { hasData } from '../lib/stats'
import { findExercise, useStore } from '../store'
import { WodBuilderSheet } from './WodBuilderSheet'
import { ProgramsCard } from './ProgramsCard'
import { CardioPlanSheet } from './CardioPlanSheet'
import { ProgramSheet } from './ProgramSheet'
import { RandomizerSheet } from './RandomizerSheet'
import type { GeneratorMode } from './ModeSwitch'
import { DaySheet } from './DaySheet'
import { rowBtn, Sheet } from './Sheet'
import { ExercisePicker } from './ExercisePicker'
import { DayWorkout } from './DayWorkout'
import { WeekStrip } from './WeekStrip'
import { ArrangeSheet } from './ArrangeSheet'
import { Tip } from './Tip'

export function PlanView() {
  const [anchor, setAnchor] = useState(() => new Date())
  const [day, setDay] = useState(() => weekdayIndex(new Date()))
  const [today] = useState(() => toISO(new Date()))
  const [picking, setPicking] = useState(false)
  const [addMenu, setAddMenu] = useState(false)
  const [wodBuilder, setWodBuilder] = useState(false)
  const [dayMenu, setDayMenu] = useState<false | 'menu' | 'load'>(false)
  const [arranging, setArranging] = useState(false)
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

      <Tip id="plan">Tap a day to see or change it. <b className="font-medium">+ Add</b> puts an exercise, a generated workout or a whole plan on that day.</Tip>
      <WeekStrip dates={dates} selected={day} counts={dates.map((d) => workItems(dayPlanOf(s.plan, s.overrides, toISO(d))).length)}
        labels={dates.map((d) => dayLabel(dayPlanOf(s.plan, s.overrides, toISO(d)), (id) => findExercise(s.custom, id)))}
        done={dates.map((d) => s.logs.some((l) => l.date === toISO(d) && hasData(l)))}
        rest={dates.map((d) => isRestDay(s.overrides, toISO(d)))} today={today} onSelect={setDay} />

      <div className="mt-4 flex justify-end gap-2">
        {planned.length > 0 && (
          <button onClick={() => s.startSession(date)} className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-on-accent">
            {s.session?.date === date ? 'Resume workout' : '▶ Start workout'}
          </button>
        )}
        {planned.length > 1 && (
          <button onClick={() => setArranging(true)} className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-600">⇅ Reorder</button>
        )}
        <button onClick={() => setDayMenu('menu')} aria-label="Day options" className="flex h-8 w-10 items-center justify-center rounded-full bg-neutral-100 text-lg leading-none text-neutral-600">
          ⋯
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
          <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70">
            <p className="mb-3 font-semibold">Nothing planned for this day</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['Add exercises', () => setPicking(true)],
                ['Make a workout', () => setGenerator('one')],
                ...(s.routines.length ? [['Load a routine', () => setDayMenu('load')] as const] : []),
                ['Rest day', () => s.setRestDay(date)],
              ] as const).map(([label, go]) => (
                <button key={label} onClick={go} className="rounded-xl bg-neutral-100 px-3 py-3 text-sm font-medium text-neutral-700">{label}</button>
              ))}
            </div>
            <button onClick={() => setAddMenu(true)} className="mt-3 text-sm text-neutral-500">More: plan a week, timed workouts, run or ride plans ›</button>
          </div>
        )}
        <DayWorkout date={date} items={planned} />
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
            ['Randomize a workout', 'Pick muscles, style and time for this day', () => setGenerator('one')],
            ['Randomize a week or month', 'Training days, rest days and a goal, built for you', () => setGenerator('program')],
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
      {arranging && <ArrangeSheet date={date} onClose={() => setArranging(false)} />}
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
      {dayMenu && <DaySheet date={date} weekDates={dates.map(toISO)} initialMode={dayMenu} onClose={() => setDayMenu(false)} />}

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
