import { useMemo, useState } from 'react'
import { SettingsGear } from './SettingsGear'
import { parseISO, toISO, weekDates, weekdayIndex } from '../lib/dates'
import { dayLabel, dayPlanOf, isRestDay, workItems } from '../lib/plan'
import { hasData } from '../lib/stats'
import { useWakeLock } from '../lib/useWakeLock'
import { findExercise, useStore } from '../store'
import { WodBuilderSheet } from './WodBuilderSheet'
import { BenchmarkSheet } from './BenchmarkSheet'
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
import { FinishWorkout } from './FinishWorkout'
import { RestTimer } from './RestTimer'
import { Tip } from './Tip'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/**
 * The Workouts tab: this week, and the selected day's workout ready to log. There is one way to do a workout: tick
 * each set here (✓), then Finish. Timed formats (AMRAP, EMOM, circuits…) bring their own clock; the rest timer
 * between sets is optional (Settings → Workouts).
 */
export function PlanView({ initialAction, onSettings }: { initialAction?: string; onSettings?: () => void }) {
  const [anchor, setAnchor] = useState(() => new Date())
  const [day, setDay] = useState(() => weekdayIndex(new Date()))
  const [today] = useState(() => toISO(new Date()))
  const [picking, setPicking] = useState(initialAction === 'add')
  const [addMenu, setAddMenu] = useState(false)
  const [wodBuilder, setWodBuilder] = useState(false)
  const [benchSheet, setBenchSheet] = useState(false)
  const [dayMenu, setDayMenu] = useState<false | 'menu' | 'load'>(false)
  const [arranging, setArranging] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [generator, setGenerator] = useState<GeneratorMode | null>(null)
  // The optional rest countdown belongs to the day it started on.
  const [restTimer, setRestTimer] = useState<{ date: string; until: number } | null>(null)
  const s = useStore()

  const dates = useMemo(() => weekDates(anchor), [anchor])
  const date = toISO(dates[day])
  const planned = dayPlanOf(s.plan, s.overrides, date)
  const work = workItems(planned)
  const rest = isRestDay(s.overrides, date)
  const finished = s.finishedDays.includes(date)
  const shiftWeek = (n: number) => setAnchor((a) => new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7 * n))
  // Mid-workout the phone shouldn't lock between sets.
  useWakeLock(date === today && work.length > 0 && !finished)

  // Optional rest timer: "As planned" (-1) uses each exercise's own rest; 0 means off.
  const startRest = (plannedSecs: number) => {
    if (plannedSecs <= 0 || s.restSeconds === 0) return
    const secs = s.restSeconds === -1 ? plannedSecs : s.restSeconds
    setRestTimer({ date, until: Date.now() + secs * 1000 })
  }

  const dayTitle = `${DAY_NAMES[day]}${date === today ? ' · Today' : `, ${dates[day].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}`

  return (
    <>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {dates[0].toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} –{' '}
          {dates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </h1>
        <div className="flex items-center gap-1 text-neutral-500">
          <button onClick={() => shiftWeek(-1)} aria-label="Previous week" className="h-8 w-8 rounded-full hover:bg-neutral-200/60">‹</button>
          <button onClick={() => shiftWeek(1)} aria-label="Next week" className="h-8 w-8 rounded-full hover:bg-neutral-200/60">›</button>
          {onSettings && <SettingsGear onClick={onSettings} />}
        </div>
      </header>

      <Tip id="plan">Pick a day to see its workout. Tap <b className="font-medium">✓</b> as you finish each set, then <b className="font-medium">Finish workout</b>.</Tip>
      <WeekStrip dates={dates} selected={day} counts={dates.map((d) => workItems(dayPlanOf(s.plan, s.overrides, toISO(d))).length)}
        labels={dates.map((d) => dayLabel(dayPlanOf(s.plan, s.overrides, toISO(d)), (id) => findExercise(s.custom, id)))}
        done={dates.map((d) => s.logs.some((l) => l.date === toISO(d) && hasData(l)))}
        rest={dates.map((d) => isRestDay(s.overrides, toISO(d)))} today={today} onSelect={setDay} />

      <div className="mb-3 mt-5 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{dayTitle}</h2>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => setAddMenu(true)} className="rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-on-accent">+ Add</button>
          <button onClick={() => setDayMenu('menu')} aria-label="Day options" className="flex h-8 w-10 items-center justify-center rounded-full bg-neutral-100 text-lg leading-none text-neutral-600">⋯</button>
        </div>
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
            <p className="mb-3 font-semibold">Nothing planned</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['Add exercises', () => setPicking(true)],
                ['Make me a workout', () => setGenerator('one')],
                ['Plan my week', () => setGenerator('program')],
                ...(s.routines.length ? [['Load a routine', () => setDayMenu('load')] as const] : []),
                ['Rest day', () => s.setRestDay(date)],
              ] as const).map(([label, go]) => (
                <button key={label} onClick={go} className="rounded-xl bg-neutral-100 px-3 py-3 text-sm font-medium text-neutral-700">{label}</button>
              ))}
            </div>
          </div>
        )}
        <DayWorkout date={date} items={planned} onSetDone={startRest} />
        {planned.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => setPicking(true)} className="flex-1 rounded-2xl border border-dashed border-neutral-300 py-3 text-sm text-neutral-600">+ Add exercise</button>
            {planned.length > 1 && <button onClick={() => setArranging(true)} className="flex-1 rounded-2xl border border-dashed border-neutral-300 py-3 text-sm text-neutral-600">⇅ Reorder / superset</button>}
          </div>
        )}
        {work.length > 0 && date <= today && (
          finished ? (
            <div className="flex gap-2">
              <button onClick={() => setFinishing(true)} className="flex-1 rounded-2xl bg-neutral-100 py-3 text-sm font-medium text-neutral-600">✓ Workout complete · see summary</button>
              <button onClick={() => s.unfinishDay(date)} className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-600">Undo</button>
            </div>
          ) : (
            <button onClick={() => setFinishing(true)} className="w-full rounded-2xl bg-accent py-3.5 text-base font-semibold text-on-accent">✓ Finish workout</button>
          )
        )}
      </section>
      {finishing && <FinishWorkout date={date} onBack={() => setFinishing(false)} onDone={() => { setFinishing(false); setRestTimer(null) }} />}
      {restTimer?.date === date && <RestTimer until={restTimer.until} onChange={(until) => setRestTimer({ date, until })} onClose={() => setRestTimer(null)} />}

      {addMenu && (
        <Sheet title={`Add to ${DAY_NAMES[day]}`} onClose={() => setAddMenu(false)}>
          {([
            ['Add an exercise', 'Search or browse 750+ exercises', () => setPicking(true)],
            ['Make me a workout', 'Pick body parts and time, get a full workout', () => setGenerator('one')],
            ['Plan a week or month', 'Training and rest days built around a goal', () => setGenerator('program')],
            ['Timed workout', 'AMRAP, EMOM, for time or Tabata, with a clock', () => setWodBuilder(true)],
            ...(s.benchmarks.length ? [['Benchmark workout', `Repeat one of your ${s.benchmarks.length} saved benchmarks`, () => setBenchSheet(true)] as const] : []),
            ['Run or ride plan', 'Build up to a distance or a race', () => setGenerator('cardio')],
          ] as const).map(([title, hint, go]) => (
            <button key={title} onClick={() => { setAddMenu(false); go() }} className={rowBtn}>
              <span><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-neutral-400">{hint}</span></span>
              <span className="text-neutral-300">›</span>
            </button>
          ))}
        </Sheet>
      )}
      {arranging && <ArrangeSheet date={date} onClose={() => setArranging(false)} />}
      {benchSheet && <BenchmarkSheet date={date} dayName={DAY_NAMES[day]} onClose={() => setBenchSheet(false)} />}
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
