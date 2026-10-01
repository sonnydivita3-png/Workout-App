import { useState } from 'react'
import type { PlannedExercise } from '../types'
import { addDays, fmtShort, mondayOf, parseISO, toISO, weekdayIndex } from '../lib/dates'
import { dayPlanOf } from '../lib/plan'
import {
  bestSplit, defaultWeekdays, generateProgram, goalInfo, majorGroupsLogged, PROGRAM_GOALS, rerollDay, SPLITS, splitInfo, type ProgramDay, type ProgramGoal, type SplitId,
} from '../lib/program'
import { minutesFor, styleInfo } from '../lib/randomizer'
import { useToday } from '../lib/useToday'
import { findExercise, useStore } from '../store'
import { activePrograms } from '../lib/programs'
import { ModeSwitch, type GeneratorMode } from './ModeSwitch'
import { WarmupRestControls } from './WarmupRestControls'
import { defaultWarmup } from '../lib/randomizer'
import { primaryBtn, Sheet } from './Sheet'
import { WorkoutList } from './WorkoutList'
import { GearChoice } from './GearChoice'
import { withGearFor } from '../lib/equipment'

const DURATIONS = [30, 45, 60, 75, 90]
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`

interface Props {
  onClose: () => void
  onSwitchMode: (m: GeneratorMode) => void
  /** Called with the first planned date after the plan is applied, so the Workouts tab can jump to it. */
  onApplied: (firstDate: string) => void
  /** Use the plan for something else (e.g. sending to a friend) instead of adding it to the calendar. */
  onUse?: (days: { offset: number; items: PlannedExercise[] }[], weeks: 1 | 4) => void
}

export function ProgramSheet({ onClose, onSwitchMode, onApplied, onUse }: Props) {
  const { logs, custom, plan, overrides, programs, startProgram, genPrefs, equipment, trainingPrefs } = useStore()
  const [gear, setGear] = useState<string[] | null>(equipment)
  const today = useToday()
  const [when, setWhen] = useState<'this' | 'next'>(onUse ? 'next' : 'this')
  const [weeks, setWeeks] = useState<1 | 4>(1)
  const [goal, setGoal] = useState<ProgramGoal>('muscle')
  const [days, setDays] = useState<number[]>(defaultWeekdays(3))
  const [minutes, setMinutes] = useState(45)
  const [split, setSplit] = useState<SplitId>('auto')
  const [result, setResult] = useState<ProgramDay[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const monday = mondayOf(parseISO(today))
  const anchorMonday = toISO(when === 'this' ? monday : addDays(monday, 7))
  const fromDate = when === 'this' ? today : anchorMonday

  const build = () => {
    const first = fromDate
    const prev = toISO(addDays(parseISO(first), -1))
    setResult(withGearFor(gear, () =>
      generateProgram({
        anchorMonday, weeks, fromDate, trainWeekdays: days, goal, minutes,
        prevDayGroups: majorGroupsLogged(logs, prev, (id) => findExercise(custom, id)),
        warmup: defaultWarmup(genPrefs.warmup, true), rest: genPrefs.rest, likedStyles: trainingPrefs.styles, dropSets: !!genPrefs.drops, split,
      })),
    )
    setOpen(null)
  }

  const toggleDay = (i: number) => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort()))

  if (!result) {
    return (
      <Sheet title="Plan a week or month" onClose={onClose} closeLabel="Cancel">
        <ModeSwitch mode="program" onChange={onSwitchMode} />

        <h3 className="mb-2 text-sm font-semibold text-neutral-700">Plan for</h3>
        <div className="mb-2 flex flex-wrap gap-2">
          <button onClick={() => setWhen('this')} className={chip(when === 'this')}>This week</button>
          <button onClick={() => setWhen('next')} className={chip(when === 'next')}>Next week</button>
          <span className="mx-1 w-px bg-neutral-200" />
          <button onClick={() => setWeeks(1)} className={chip(weeks === 1)}>1 week</button>
          <button onClick={() => setWeeks(4)} className={chip(weeks === 4)}>Month (4 weeks)</button>
        </div>
        {when === 'this' && <p className="mb-5 text-xs text-neutral-400">Days that have already passed this week are left alone.</p>}
        {when === 'next' && <div className="mb-5" />}

        <h3 className="mb-2 text-sm font-semibold text-neutral-700">Goal</h3>
        <div className="mb-1 flex flex-wrap gap-2">
          {PROGRAM_GOALS.map((g) => (
            <button key={g.id} onClick={() => setGoal(g.id)} className={chip(g.id === goal)}>{g.label}</button>
          ))}
        </div>
        <p className="mb-5 text-xs text-neutral-400">{goalInfo(goal).blurb}</p>

        <h3 className="mb-2 text-sm font-semibold text-neutral-700">Training days</h3>
        <div className="mb-2 flex flex-wrap gap-2">
          {[2, 3, 4, 5, 6].map((n) => (
            <button key={n} onClick={() => setDays(defaultWeekdays(n))} className={chip(days.length === n && days.join() === defaultWeekdays(n).join())}>
              {n} days
            </button>
          ))}
        </div>
        <div className="mb-1 grid grid-cols-7 gap-1.5">
          {DAY_NAMES.map((l, i) => (
            <button
              key={l}
              onClick={() => toggleDay(i)}
              aria-pressed={days.includes(i)}
              className={`rounded-xl py-2 text-sm ${days.includes(i) ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-500'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <p className="mb-5 text-xs text-neutral-400">
          {days.length} training day{days.length === 1 ? '' : 's'}, {7 - days.length} rest day{7 - days.length === 1 ? '' : 's'} a week. Tap days to customize.
        </p>

        <h3 className="mb-2 text-sm font-semibold text-neutral-700">Split</h3>
        <div className="mb-1 flex flex-wrap gap-2">
          {SPLITS.map((sp) => (
            <button key={sp.id} onClick={() => setSplit(sp.id)} aria-pressed={sp.id === split} className={chip(sp.id === split)}>{sp.label}</button>
          ))}
        </div>
        <p className="text-xs text-neutral-400">{splitInfo(split).blurb}{split !== 'auto' && ' Runs in order, week after week.'}</p>
        {days.length > 0 && !splitInfo(split).fits.includes(days.length) && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {splitInfo(split).label} works best with {splitInfo(split).fits.join(', ').replace(/, (\d)$/, ' or $1')} days a week. {split === 'full' ? 'More than that means full-body days back to back, with no rest for sore muscles.' : `With ${days.length}, the days shift from week to week.`}{' '}
            {bestSplit(days.length) !== split && (
              <button onClick={() => setSplit(bestSplit(days.length))} className="font-medium underline">Use {splitInfo(bestSplit(days.length)).label} instead</button>
            )}
          </p>
        )}
        <div className="mb-5" />

        <WarmupRestControls lifting />

        <GearChoice value={gear} onChange={setGear} />
        <h3 className="mb-2 text-sm font-semibold text-neutral-700">Session length</h3>
        <div className="mb-5 flex flex-wrap gap-2">
          {DURATIONS.map((m) => (
            <button key={m} onClick={() => setMinutes(m)} className={chip(m === minutes)}>{m} min</button>
          ))}
        </div>

        <p className="mb-4 text-xs text-neutral-400">
          {split === 'auto'
            ? 'No major muscle group (chest, back, shoulders, legs, glutes) is trained two days in a row. Arms, core and cardio can overlap.'
            : 'Exercises change each day; the split decides which muscles.'}
          {weeks === 4 && ' Week 3 adds a set to lifts and week 4 is a lighter deload.'}
        </p>
        <button disabled={days.length === 0} onClick={build} className={primaryBtn}>Build my plan</button>
      </Sheet>
    )
  }

  const runningProgram = activePrograms(programs, today).find((p) => p.kind === 'program')
  const workouts = result.filter((d) => !d.rest)
  const existing = result.filter((d) => dayPlanOf(plan, overrides, d.date).length > 0).length
  const byWeek = [...new Set(result.map((d) => d.weekIndex))].map((w) => result.filter((d) => d.weekIndex === w))
  const recentIds = (i: number) => new Set(result.slice(Math.max(0, i - 3), i + 4).flatMap((d) => d.items.map((p) => p.exerciseId)))

  const reroll = (date: string) =>
    setResult((r) => r && r.map((d, i) => (d.date === date ? withGearFor(gear, () => rerollDay(d, minutes, weeks, recentIds(i), Math.random, { warmup: defaultWarmup(genPrefs.warmup, true), rest: genPrefs.rest, dropSets: !!genPrefs.drops })) : d)))

  const apply = () => {
    if (onUse) {
      const t0 = parseISO(anchorMonday).getTime()
      onUse(result.map((d) => ({ offset: Math.round((parseISO(d.date).getTime() - t0) / 86400000), items: d.items })), weeks)
      return
    }
    startProgram(Object.fromEntries(result.map((d) => [d.date, d.items])), `${split === 'auto' ? 'Random' : splitInfo(split).label} ${weeks === 4 ? 'month' : 'week'} plan`, today)
    onApplied(result[0].date)
    onClose()
  }

  return (
    <Sheet title="Your plan" onClose={onClose} closeLabel="Close">
      <p className="mb-1 text-sm text-neutral-500">
        {goalInfo(goal).label}{split !== 'auto' && ` · ${splitInfo(split).label}`} · {workouts.length} workout{workouts.length === 1 ? '' : 's'} · {result.length - workouts.length} rest day{result.length - workouts.length === 1 ? '' : 's'}
      </p>
      <p className="mb-4 text-xs text-neutral-400">Tap a day to see the exercises or reroll just that day.</p>

      <div className="space-y-4">
        {byWeek.map((week, wi) => (
          <div key={wi}>
            <h3 className="mb-1 text-sm font-semibold text-neutral-700">
              Week {week[0].weekIndex + 1} · {fmtShort(week[0].date)} – {fmtShort(week.at(-1)!.date)}
            </h3>
            <ul className="divide-y divide-neutral-100 rounded-2xl bg-neutral-50 px-3">
              {week.map((d) => {
                const label = `${DAY_NAMES[weekdayIndex(parseISO(d.date))]} ${parseISO(d.date).getDate()}`
                if (d.rest) {
                  return (
                    <li key={d.date} className="flex items-center justify-between py-2.5 text-sm text-neutral-400">
                      <span>{label}</span><span>Rest</span>
                    </li>
                  )
                }
                const isOpen = open === d.date
                return (
                  <li key={d.date} className="py-2.5">
                    <button onClick={() => setOpen(isOpen ? null : d.date)} className="flex w-full items-center justify-between gap-2 text-left" aria-expanded={isOpen}>
                      <span className="min-w-0">
                        <span className="text-sm text-neutral-500">{label}</span>
                        <span className="ml-3 font-medium">{d.name}</span>
                        {d.style && d.style !== 'standard' && d.style !== 'strength' && (
                          <span className="ml-2 text-xs text-neutral-400">{styleInfo(d.style).label}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-neutral-400">~{Math.round(minutesFor(d.items))} min {isOpen ? '⌃' : '⌄'}</span>
                    </button>
                    {isOpen && (
                      <div className="mt-2">
                        <WorkoutList items={d.items} />
                        <button onClick={() => reroll(d.date)} className="mt-2 rounded-full bg-surface px-3 py-1 text-sm shadow-sm ring-1 ring-neutral-200">Reroll this day</button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      {!onUse && existing > 0 && (
        <p className="mt-4 text-xs text-neutral-500">
          This replaces the plan on {existing} day{existing === 1 ? '' : 's'} that already have exercises. Your logged workouts are not affected.
        </p>
      )}
      {!onUse && runningProgram && <p className="mt-2 text-xs text-neutral-500">Your current program “{runningProgram.title}” will be stopped and replaced.</p>}
      <div className="mt-4 flex gap-2">
        <button onClick={build} className="flex-1 rounded-2xl bg-neutral-100 py-3 text-sm font-medium">Regenerate</button>
        <button onClick={() => setResult(null)} className="flex-1 rounded-2xl bg-neutral-100 py-3 text-sm font-medium">Change settings</button>
      </div>
      <button onClick={apply} className={`${primaryBtn} mt-2`}>{onUse ? 'Use this plan' : 'Apply to my plan'}</button>
    </Sheet>
  )
}
