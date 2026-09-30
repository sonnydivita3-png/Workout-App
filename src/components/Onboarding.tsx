import { useState } from 'react'
import { mondayOf, parseISO, toISO } from '../lib/dates'
import { defaultWeekdays, generateProgram, PROGRAM_GOALS, type ProgramDay, type ProgramGoal } from '../lib/program'
import { defaultWarmup } from '../lib/randomizer'
import { useToday } from '../lib/useToday'
import { useStore } from '../store'

type Step = 'welcome' | 'goal' | 'schedule' | 'plan'
const STEPS: Step[] = ['welcome', 'goal', 'schedule', 'plan']
const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const primary = 'w-full rounded-2xl bg-accent py-3.5 text-base font-semibold text-on-accent disabled:opacity-30'
const choice = (on: boolean) => `w-full rounded-2xl px-4 py-3.5 text-left ring-1 ${on ? 'bg-accent/15 ring-accent' : 'bg-surface ring-neutral-200'}`
const chip = (on: boolean) => `h-12 flex-1 rounded-2xl text-base font-medium ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`

/**
 * First run: three quick questions (goal, days a week, session length) and a first month planned from the answers,
 * so the app is useful straight away. Everything can be skipped, and social features are offered later.
 */
export function Onboarding() {
  const s = useStore()
  const today = useToday()
  const invite = s.pendingInvite
  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState(s.name)
  const [goal, setGoal] = useState<ProgramGoal | 'none' | null>(null)
  const [days, setDays] = useState(3)
  const [minutes, setMinutes] = useState(45)
  const [week, setWeek] = useState<ProgramDay[] | null>(null)

  const finish = () => { if (name.trim()) s.setName(name.trim()); s.setTourDone(true); s.setOnboarded(true) }
  const build = () => {
    const result = generateProgram({
      anchorMonday: toISO(mondayOf(parseISO(today))), fromDate: today, weeks: 4,
      trainWeekdays: defaultWeekdays(days), goal: goal as ProgramGoal, minutes,
      warmup: defaultWarmup(s.genPrefs.warmup, true), rest: s.genPrefs.rest,
    })
    setWeek(result)
    setStep('plan')
  }
  const startPlan = () => {
    if (!week) return
    s.startProgram(Object.fromEntries(week.map((d) => [d.date, d.items])), `${PROGRAM_GOALS.find((g) => g.id === goal)?.label ?? 'My'} plan`, today)
    finish()
  }
  const firstWeek = week?.filter((d) => d.weekIndex === 0) ?? []

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-1.5" aria-label={`Step ${STEPS.indexOf(step) + 1} of ${STEPS.length}`}>
            {STEPS.map((x) => <span key={x} className={`h-1.5 rounded-full ${x === step ? 'w-6 bg-accent' : 'w-1.5 bg-neutral-300'}`} />)}
          </div>
          <button onClick={finish} className="text-sm text-neutral-500">Skip</button>
        </div>

        {step === 'welcome' && (
          <>
            <p className="mb-2 text-5xl" aria-hidden>💪</p>
            <h1 className="mb-2 text-3xl font-semibold tracking-tight">Welcome to EZ Workout Tracker</h1>
            <p className="mb-6 text-neutral-600">Plan workouts, log them in a few taps, and beat what you did last time.</p>
            {invite && <p className="mb-6 rounded-2xl bg-accent/15 px-4 py-3 text-sm">👋 <b className="font-medium">@{invite}</b> invited you. You can add them as a friend once you’re set up.</p>}
            <label className="mb-2 block text-sm font-medium" htmlFor="ob-name">What should we call you?</label>
            <input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" className="mb-5 w-full rounded-2xl bg-surface px-4 py-3.5 text-base outline-none ring-1 ring-neutral-200 focus:ring-accent" />
            <p className="mb-2 text-sm font-medium">Weights in</p>
            <div className="mb-8 flex gap-2">
              {(['lb', 'kg'] as const).map((u) => <button key={u} onClick={() => s.setUnits({ weight: u, distance: u === 'kg' ? 'km' : 'mi' })} className={chip(s.units.weight === u)}>{u === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)'}</button>)}
            </div>
            <div className="mt-auto"><button onClick={() => setStep('goal')} className={primary}>Continue</button></div>
          </>
        )}

        {step === 'goal' && (
          <>
            <h1 className="mb-1 text-2xl font-semibold tracking-tight">What’s your main goal?</h1>
            <p className="mb-5 text-neutral-500">We’ll build your first month around it. You can change it any time.</p>
            <div className="mb-6 space-y-2">
              {PROGRAM_GOALS.map((g) => (
                <button key={g.id} onClick={() => setGoal(g.id)} className={choice(goal === g.id)}>
                  <span className="block font-medium">{g.label}</span>
                  <span className="block text-sm text-neutral-500">{g.blurb}</span>
                </button>
              ))}
              <button onClick={() => setGoal('none')} className={choice(goal === 'none')}>
                <span className="block font-medium">Just log my workouts</span>
                <span className="block text-sm text-neutral-500">No plan for now. I’ll add workouts myself.</span>
              </button>
            </div>
            <div className="mt-auto"><button disabled={!goal} onClick={() => (goal === 'none' ? finish() : setStep('schedule'))} className={primary}>{goal === 'none' ? 'Start using the app' : 'Continue'}</button></div>
          </>
        )}

        {step === 'schedule' && (
          <>
            <h1 className="mb-1 text-2xl font-semibold tracking-tight">How often can you train?</h1>
            <p className="mb-5 text-neutral-500">Be realistic. Consistency beats ambition.</p>
            <p className="mb-2 text-sm font-medium">Days a week</p>
            <div className="mb-2 flex gap-2">{[2, 3, 4, 5, 6].map((n) => <button key={n} onClick={() => setDays(n)} className={chip(days === n)}>{n}</button>)}</div>
            <p className="mb-6 text-sm text-neutral-400">{defaultWeekdays(days).map((d) => DAY[d]).join(', ')}. You can move days later.</p>
            <p className="mb-2 text-sm font-medium">Time per workout</p>
            <div className="mb-8 flex gap-2">{[30, 45, 60, 75].map((m) => <button key={m} onClick={() => setMinutes(m)} className={chip(minutes === m)}>{m} min</button>)}</div>
            <div className="mt-auto space-y-2">
              <button onClick={build} className={primary}>Build my plan</button>
              <button onClick={() => setStep('goal')} className="w-full py-2 text-sm text-neutral-500">Back</button>
            </div>
          </>
        )}

        {step === 'plan' && (
          <>
            <h1 className="mb-1 text-2xl font-semibold tracking-tight">Your first week</h1>
            <p className="mb-5 text-neutral-500">Four weeks are planned, getting a little harder each week. Swap anything you don’t like on the Plan tab.</p>
            <ul className="mb-6 space-y-2">
              {firstWeek.map((d) => (
                <li key={d.date} className={`flex items-center justify-between rounded-2xl px-4 py-3 ${d.rest ? 'text-neutral-400' : 'bg-surface ring-1 ring-neutral-200'}`}>
                  <span className="font-medium">{parseISO(d.date).toLocaleDateString(undefined, { weekday: 'long' })}</span>
                  <span className="text-sm">{d.rest ? 'Rest' : `${d.name ?? 'Workout'} · ${d.items.filter((p) => !p.warmup).length} exercises`}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto space-y-2">
              <button onClick={startPlan} className={primary}>Start my plan</button>
              <button onClick={build} className="w-full py-2 text-sm text-neutral-500">Shuffle workouts</button>
              <button onClick={() => setStep('schedule')} className="w-full py-2 text-sm text-neutral-500">Back</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
