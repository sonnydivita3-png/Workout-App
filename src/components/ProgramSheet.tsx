import { useState } from 'react'
import type { PlannedExercise } from '../types'
import { addDays, fmtShort, mondayOf, parseISO, toISO, weekdayIndex } from '../lib/dates'
import { dayPlanOf } from '../lib/plan'
import {
  bestSplit, defaultWeekdays, familiarLifts, generateProgram, goalInfo, goalsLabel, liftsToRotate, majorGroupsLogged, PROGRAM_GOALS, REP_SCHEMES,
  rerollSlot, savedGoals, SET_SCHEMES, splitInfo, SPLITS, splitWeek, type DayOptions, type ProgramDay, type ProgramGoal, type RepScheme, type SetScheme, type SplitId,
} from '../lib/program'
import { defaultWarmup, minutesFor, styleInfo } from '../lib/randomizer'
import { MUSCLE_GROUPS, plannedSets, weeklyTarget } from '../lib/muscles'
import { useToday } from '../lib/useToday'
import { findExercise, useStore } from '../store'
import { activePrograms } from '../lib/programs'
import { withGearFor } from '../lib/equipment'
import { ModeSwitch, type GeneratorMode } from './ModeSwitch'
import { WarmupRestControls } from './WarmupRestControls'
import { primaryBtn, Sheet } from './Sheet'
import { WorkoutList } from './WorkoutList'
import { GearChoice } from './GearChoice'
import { FavoritesPicker } from './FavoritesPicker'
import { MoveChoice } from './TrainingPrefsPicker'
import { PerMuscleStepper } from './VolumeCheck'
import { extraTimeOf, perMuscleOf } from '../lib/volumePrefs'

const DURATIONS = [30, 45, 60, 75, 90]
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** The walkthrough, one decision per step; the plan is built (and can be reviewed) after the last. */
const STEPS = ['goal', 'schedule', 'split', 'exercises', 'progression', 'warmup'] as const
type Step = (typeof STEPS)[number]
const STEP_TITLE: Record<Step, string> = {
  goal: 'What’s the goal?',
  schedule: 'When, and how often?',
  split: 'How should the week be split?',
  exercises: 'Exercises',
  progression: 'How it progresses',
  warmup: 'Warm-up and rest',
}

const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`
const h3 = 'mb-2 text-sm font-semibold text-neutral-700'
const note = 'text-xs text-neutral-400'

/** A choice with a line of explanation under it. */
function Option({ on, onClick, title, blurb, badge }: { on: boolean; onClick: () => void; title: string; blurb: string; badge?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={title}
      className={`flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left ring-1 ${on ? 'bg-accent/15 ring-2 ring-accent' : 'bg-surface ring-neutral-200/70'}`}
    >
      <span aria-hidden className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${on ? 'bg-accent text-on-accent' : 'ring-1 ring-neutral-300'}`}>{on ? '✓' : ''}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">
          {title}
          {badge && <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-normal text-neutral-600">{badge}</span>}
        </span>
        <span className="block text-xs text-neutral-500">{blurb}</span>
      </span>
    </button>
  )
}

interface Props {
  onClose: () => void
  onSwitchMode: (m: GeneratorMode) => void
  /** Called with the first planned date after the plan is applied, so the Workouts tab can jump to it. */
  onApplied: (firstDate: string) => void
  /** Use the plan for something else (e.g. sending to a friend) instead of adding it to the calendar. */
  onUse?: (days: { offset: number; items: PlannedExercise[] }[], weeks: 1 | 4) => void
}

/**
 * Plan a week or a month, step by step: the goal, the schedule, the split, the exercises (equipment, favorites, the
 * lifts to keep), how it progresses (rep range, sets over the month, a deload week), warm-up and rest. Then a review,
 * with each muscle's weekly sets against the goal's target, before it's added to the calendar.
 */
export function ProgramSheet({ onClose, onSwitchMode, onApplied, onUse }: Props) {
  const { logs, custom, plan, overrides, programs, startProgram, genPrefs, setGenPrefs, equipment, trainingPrefs, setTrainingPrefs } = useStore()
  const today = useToday()
  const [step, setStep] = useState<Step>('goal')
  const [gear, setGear] = useState<string[] | null>(equipment)
  const [when, setWhen] = useState<'this' | 'next'>(onUse ? 'next' : 'this')
  const [weeks, setWeeks] = useState<1 | 4>(1)
  const [goal, setGoal] = useState<ProgramGoal[]>(() => { const g = savedGoals(trainingPrefs); return g.length ? g : ['muscle'] })
  // More than one goal mixes them; at least one always stays picked.
  const toggleGoal = (id: ProgramGoal) => setGoal((g) => (g.includes(id) ? (g.length > 1 ? g.filter((x) => x !== id) : g) : [...g, id]))
  const [days, setDays] = useState<number[]>(defaultWeekdays(3))
  const [minutes, setMinutes] = useState(45)
  const [split, setSplit] = useState<SplitId>('auto')
  const saved = genPrefs.plan ?? {}
  const [reps, setReps] = useState<RepScheme>(saved.reps ?? 'auto')
  const [setScheme, setSetScheme] = useState<SetScheme>(saved.sets ?? 'week3')
  const [deload, setDeload] = useState(saved.deload ?? true)
  const [keepLifts, setKeepLifts] = useState(saved.keepLifts ?? true)
  const [result, setResult] = useState<ProgramDay[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const monday = mondayOf(parseISO(today))
  const anchorMonday = toISO(when === 'this' ? monday : addDays(monday, 7))
  const fromDate = when === 'this' ? today : anchorMonday
  const lookup = (id: string) => findExercise(custom, id)
  const hasHistory = familiarLifts(logs, fromDate).size > 0
  const toggleDay = (i: number) => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort()))
  const perMuscle = perMuscleOf(trainingPrefs.perMuscle)
  // "Keep adding exercises" (Settings → Workouts) means no limit per muscle here too.
  const noLimit = extraTimeOf(trainingPrefs.extraTime) === 'more'
  const dayOptions: DayOptions = { warmup: defaultWarmup(genPrefs.warmup, true, genPrefs.warmMinutes), rest: genPrefs.rest, dropSets: !!genPrefs.drops, reps, sets: setScheme, deload, perMuscle, capVolume: !noLimit }

  const build = () => {
    setGenPrefs({ plan: { reps, sets: setScheme, deload, keepLifts } })
    const prev = toISO(addDays(parseISO(fromDate), -1))
    const familiar = familiarLifts(logs, fromDate)
    const rotate = liftsToRotate(logs, fromDate, lookup)
    setResult(withGearFor(gear, () =>
      generateProgram({
        anchorMonday, weeks, fromDate, trainWeekdays: days, goal, minutes, split, likedStyles: trainingPrefs.styles, setTarget: trainingPrefs.setTarget,
        prevDayGroups: majorGroupsLogged(logs, prev, lookup),
        // Keep: the lifts they've been doing stay (numbers carry on). Fresh: new exercises wherever there's a choice.
        ...(keepLifts ? { familiar, rotate } : { rotate: new Set([...rotate, ...familiar]) }),
        ...dayOptions,
      }),
    ))
    setOpen(null)
  }

  if (!result) {
    const i = STEPS.indexOf(step)
    const last = i === STEPS.length - 1
    const fits = splitInfo(split).fits.includes(days.length)
    return (
      // Each step (and the review) opens at its top.
      <Sheet key={step} title="Plan a week or month" onClose={onClose} closeLabel="Cancel">
        {step === 'goal' && <ModeSwitch mode="program" onChange={onSwitchMode} />}
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs text-neutral-400">Step {i + 1} of {STEPS.length}</p>
          <div className="flex gap-1" aria-hidden>
            {STEPS.map((s, n) => <span key={s} className={`h-1.5 rounded-full ${n === i ? 'w-4 bg-accent' : n < i ? 'w-1.5 bg-accent/60' : 'w-1.5 bg-neutral-300'}`} />)}
          </div>
        </div>
        <h3 className="mb-3 text-lg font-semibold tracking-tight">{STEP_TITLE[step]}</h3>

        {step === 'goal' && (
          <>
            <div className="space-y-2" role="group" aria-label="Plan goals">
              {PROGRAM_GOALS.map((g) => <Option key={g.id} on={goal.includes(g.id)} onClick={() => toggleGoal(g.id)} title={g.label} blurb={g.blurb} />)}
            </div>
            <p className={`mt-2 ${note}`}>{goal.length > 1 ? `A mix of sessions for each: ${goal.map((g) => goalInfo(g).label.toLowerCase()).join(', ')}.` : 'Pick one or more. It also sets your weekly targets on Progress.'}</p>
          </>
        )}

        {step === 'schedule' && (
          <>
            <h4 className={h3}>Start</h4>
            <div className="mb-2 flex flex-wrap gap-2">
              <button onClick={() => setWhen('this')} className={chip(when === 'this')}>This week</button>
              <button onClick={() => setWhen('next')} className={chip(when === 'next')}>Next week</button>
            </div>
            <p className={`mb-5 ${note}`}>{when === 'this' ? 'Days that have already passed this week are left alone.' : `Starts Monday ${fmtShort(anchorMonday)}.`}</p>

            <h4 className={h3}>How long</h4>
            <div className="mb-5 flex flex-wrap gap-2">
              <button onClick={() => setWeeks(1)} className={chip(weeks === 1)}>1 week</button>
              <button onClick={() => setWeeks(4)} className={chip(weeks === 4)}>Month (4 weeks)</button>
            </div>

            <h4 className={h3}>Training days</h4>
            <div className="mb-2 flex flex-wrap gap-2">
              {[2, 3, 4, 5, 6].map((n) => (
                <button key={n} onClick={() => setDays(defaultWeekdays(n))} className={chip(days.length === n && days.join() === defaultWeekdays(n).join())}>{n} days</button>
              ))}
            </div>
            <div className="mb-1 grid grid-cols-7 gap-1.5">
              {DAY_NAMES.map((l, d) => (
                <button key={l} onClick={() => toggleDay(d)} aria-pressed={days.includes(d)} className={`rounded-xl py-2 text-sm ${days.includes(d) ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-500'}`}>{l}</button>
              ))}
            </div>
            <p className={`mb-5 ${note}`}>{days.length} training day{days.length === 1 ? '' : 's'}, {7 - days.length} rest day{7 - days.length === 1 ? '' : 's'} a week. Tap days to change them.</p>

            <h4 className={h3}>Session length</h4>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((m) => <button key={m} onClick={() => setMinutes(m)} className={chip(m === minutes)}>{m} min</button>)}
            </div>
          </>
        )}

        {step === 'split' && (
          <>
            <div className="space-y-2">
              {SPLITS.map((sp) => (
                <Option
                  key={sp.id}
                  on={sp.id === split}
                  onClick={() => setSplit(sp.id)}
                  title={sp.label}
                  blurb={sp.blurb}
                  badge={sp.id !== 'auto' && sp.id === bestSplit(days.length) ? `Best for ${days.length} days` : undefined}
                />
              ))}
            </div>
            {split !== 'auto' && days.length > 0 && <p className={`mt-3 ${note}`}>Your week: {splitWeek(split, days.length).join(' · ')}. Runs in order, week after week.</p>}
            {days.length > 0 && !fits && (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {splitInfo(split).label} works best with {splitInfo(split).fits.join(', ').replace(/, (\d)$/, ' or $1')} days a week. {split === 'full' ? 'More than that means full-body days back to back, with no rest for sore muscles.' : `With ${days.length}, the days shift from week to week.`}{' '}
                {bestSplit(days.length) !== split && (
                  <button onClick={() => setSplit(bestSplit(days.length))} className="font-medium underline">Use {splitInfo(bestSplit(days.length)).label} instead</button>
                )}
              </p>
            )}
            {split === 'auto' && <p className={`mt-3 ${note}`}>No major muscle (chest, back, shoulders, legs, glutes) is trained two days in a row. Arms, core and cardio can overlap.</p>}
          </>
        )}

        {step === 'exercises' && (
          <>
            <GearChoice value={gear} onChange={setGear} />
            {hasHistory && (
              <>
                <h4 className={h3}>Your current lifts</h4>
                <div className="mb-5 space-y-2">
                  <Option on={keepLifts} onClick={() => setKeepLifts(true)} title="Keep the lifts I’ve been doing" blurb="Your numbers carry on. Accessories you’ve done for a month, or stalled on, still get swapped for something new." />
                  <Option on={!keepLifts} onClick={() => setKeepLifts(false)} title="Fresh exercises" blurb="New exercises wherever there’s a choice. New lifts get a starting weight from a similar one you’ve done." />
                </div>
              </>
            )}
            <h4 className={h3}>Favorites</h4>
            <FavoritesPicker />
            <div className="mt-5" />
            <MoveChoice />
          </>
        )}

        {step === 'progression' && (
          <>
            <div className="mb-5 rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              <b className="font-medium text-neutral-900">Weights</b> go up the slow way that lasts. Every lift shows a target from last time: a rep more on a set or two, then about 5 lb (2.5 kg) once every set hits it. A new rep target starts from the weight your last session points to.
            </div>
            <h4 className={h3}>Rep range</h4>
            <div className="mb-1 flex flex-wrap gap-2" role="group" aria-label="Rep range">
              {REP_SCHEMES.map((r) => <button key={r.id} onClick={() => setReps(r.id)} aria-pressed={reps === r.id} className={chip(reps === r.id)}>{r.label}</button>)}
            </div>
            <p className={`mb-5 ${note}`}>{REP_SCHEMES.find((r) => r.id === reps)!.blurb}</p>
            {weeks === 4 ? (
              <>
                <h4 className={h3}>Sets over the month</h4>
                <div className="mb-5 space-y-2">
                  {SET_SCHEMES.map((sc) => <Option key={sc.id} on={setScheme === sc.id} onClick={() => setSetScheme(sc.id)} title={sc.label} blurb={sc.blurb} />)}
                </div>
                <h4 className={h3}>Week 4</h4>
                <div className="mb-5 space-y-2">
                  <Option on={deload} onClick={() => setDeload(true)} title="A lighter week (deload)" blurb="A set fewer and about 90% of the weight, so you recover and start the next month stronger. Recommended." />
                  <Option on={!deload} onClick={() => setDeload(false)} title="Keep pushing" blurb="Week 4 carries on from week 3. Plan a lighter week yourself every month or two." />
                </div>
              </>
            ) : (
              <p className={`mb-5 ${note}`}>A month-long plan also adds sets as it goes and can end with a lighter week.</p>
            )}
            <h4 className={h3}>Exercises per muscle</h4>
            <div className="mb-2 space-y-2">
              <Option on={!noLimit} onClick={() => setTrainingPrefs({ extraTime: extraTimeOf(trainingPrefs.extraTime) === 'more' ? 'ask' : trainingPrefs.extraTime })} title="Keep it to what works" blurb={`Up to ${perMuscle} exercises (and about 15 hard sets; 10 for arms, calves and core) per muscle in a session. Spare time goes to the muscles still short of their weekly target, then an easy cardio finisher.`} />
              <Option on={noLimit} onClick={() => setTrainingPrefs({ extraTime: 'more' })} title="No limit" blurb="Fill each session with more exercises for its muscles." />
            </div>
            {!noLimit && (
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-neutral-600">Most exercises for one muscle</span>
                <PerMuscleStepper value={perMuscle} onChange={(n) => setTrainingPrefs({ perMuscle: n })} />
              </div>
            )}
            <p className={note}>Most people grow best on about 10–15 hard sets for one muscle in a session, usually 4–5 exercises; past that, more sets add fatigue rather than muscle. You’ll see each muscle’s weekly sets before you add the plan.</p>
          </>
        )}

        {step === 'warmup' && <WarmupRestControls lifting lengthControl ownWarmupNote />}

        <div className="mt-5 flex gap-2">
          {i > 0 && <button onClick={() => setStep(STEPS[i - 1])} className="rounded-2xl bg-neutral-100 px-5 py-3 text-sm font-medium">Back</button>}
          <button
            disabled={(step === 'schedule' || last) && days.length === 0}
            onClick={() => (last ? build() : setStep(STEPS[i + 1]))}
            className={`${primaryBtn} flex-1`}
          >
            {last ? 'Build my plan' : 'Next'}
          </button>
        </div>
      </Sheet>
    )
  }

  const runningProgram = activePrograms(programs, today).find((p) => p.kind === 'program')
  const workouts = result.filter((d) => !d.rest)
  const existing = result.filter((d) => dayPlanOf(plan, overrides, d.date).length > 0).length
  const byWeek = [...new Set(result.map((d) => d.weekIndex))].map((w) => result.filter((d) => d.weekIndex === w))
  // Lifts in the plan they've never logged: the month's new moves (shown once they have some history to compare with).
  const logged = new Set(logs.map((l) => l.exerciseId))
  const newLifts = [...new Set(result.filter((d) => d.slot).flatMap((d) => d.items.map((p) => p.exerciseId)))]
    .filter((id) => !logged.has(id)).map((id) => lookup(id)?.name).filter(Boolean)
  const recentIds = (n: number) => new Set(result.slice(Math.max(0, n - 3), n + 4).flatMap((d) => d.items.map((p) => p.exerciseId)))
  // Weekly sets per muscle for a full week (the first may start part way through).
  const fullWeek = byWeek.reduce((a, w) => (w.filter((d) => !d.rest).length > a.filter((d) => !d.rest).length ? w : a), byWeek[0])
  const sets = plannedSets(fullWeek.flatMap((d) => d.items), lookup)
  const choices = [
    goalsLabel(goal), split !== 'auto' ? splitInfo(split).label : null, `${days.length} days`, `${minutes} min`,
    reps !== 'auto' ? REP_SCHEMES.find((r) => r.id === reps)!.label : null,
    weeks === 4 ? SET_SCHEMES.find((sc) => sc.id === setScheme)!.label.toLowerCase() : null,
    weeks === 4 && deload ? 'deload week 4' : null,
  ].filter(Boolean)

  const reroll = (date: string) =>
    setResult((r) => r && withGearFor(gear, () => rerollSlot(r, date, minutes, weeks, recentIds(r.findIndex((d) => d.date === date)), Math.random, dayOptions)))

  const apply = () => {
    if (onUse) {
      const t0 = parseISO(anchorMonday).getTime()
      onUse(result.map((d) => ({ offset: Math.round((parseISO(d.date).getTime() - t0) / 86400000), items: d.items })), weeks)
      return
    }
    // The plan's goal becomes their goal (it sets the weekly targets on Progress).
    setTrainingPrefs({ goals: goal, goal: null })
    startProgram(Object.fromEntries(result.map((d) => [d.date, d.items])), `${split === 'auto' ? 'Random' : splitInfo(split).label} ${weeks === 4 ? 'month' : 'week'} plan`, today)
    onApplied(result[0].date)
    onClose()
  }

  return (
    <Sheet key="review" title="Your plan" onClose={onClose} closeLabel="Close">
      <p className="mb-1 text-sm text-neutral-500">
        {goalsLabel(goal)}{split !== 'auto' && ` · ${splitInfo(split).label}`} · {workouts.length} workout{workouts.length === 1 ? '' : 's'} · {result.length - workouts.length} rest day{result.length - workouts.length === 1 ? '' : 's'}
      </p>
      <p className={`mb-3 ${note}`}>{choices.join(' · ')}</p>
      {hasHistory && keepLifts && newLifts.length > 0 && (
        <p className="mb-3 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          <b className="font-medium text-neutral-700">New this time:</b> {newLifts.slice(0, 4).join(', ')}{newLifts.length > 4 ? ` and ${newLifts.length - 4} more` : ''}.
          {' '}Accessories you’ve done for a month (or stalled on) get swapped; your main lifts stay so you keep progressing. New lifts get a starting weight from a similar one you’ve done.
        </p>
      )}

      <section className="mb-4 rounded-2xl bg-neutral-50 px-3 py-3" aria-label="Weekly sets per muscle">
        <h3 className="mb-2 text-sm font-semibold text-neutral-700">Weekly sets per muscle</h3>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {MUSCLE_GROUPS.map((g) => {
            const target = weeklyTarget(g, goal, trainingPrefs.setTarget)
            const ok = sets[g] >= target
            return (
              <li key={g} className="flex items-center justify-between gap-2">
                <span className="text-neutral-600">{g}</span>
                <span className={`tabular-nums ${ok ? 'font-medium text-green-600' : 'text-neutral-400'}`}>{sets[g]} / {target}{ok ? ' ✓' : ''}</span>
              </li>
            )
          })}
        </ul>
        <p className={`mt-2 ${note}`}>Hard sets in a full week of this plan, against the target for your goal{trainingPrefs.setTarget ? ' (your own number)' : ''}. Smaller muscles also work in the big lifts, so their targets are lower.{weeks === 4 ? ` ${setScheme === 'week3' ? 'Week 3 adds a set to the main lifts. ' : setScheme === 'weekly' ? 'Weeks 2 and 3 each add a set to the main lifts. ' : ''}${deload ? 'Week 4 is lighter.' : ''}` : ''}</p>
      </section>

      <p className={`mb-4 ${note}`}>Tap a day to see the exercises or reroll it{weeks === 4 ? ' (lifting days repeat every week, so the numbers can climb)' : ''}.</p>

      <div className="space-y-4">
        {byWeek.map((week, wi) => (
          <div key={wi}>
            <h3 className="mb-1 text-sm font-semibold text-neutral-700">
              Week {week[0].weekIndex + 1} · {fmtShort(week[0].date)} – {fmtShort(week.at(-1)!.date)}
              {weeks === 4 && week[0].weekIndex === 3 && deload && <span className="ml-2 text-xs font-normal text-neutral-400">lighter week</span>}
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
        <button onClick={() => { setResult(null); setStep('goal') }} className="flex-1 rounded-2xl bg-neutral-100 py-3 text-sm font-medium">Change settings</button>
      </div>
      <button onClick={apply} className={`${primaryBtn} mt-2`}>{onUse ? 'Use this plan' : 'Apply to my plan'}</button>
    </Sheet>
  )
}
