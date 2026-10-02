import { useState } from 'react'
import { mondayOf, parseISO, toISO } from '../lib/dates'
import { defaultWeekdays, generateProgram, goalsLabel, PROGRAM_GOALS, type ProgramDay, type ProgramGoal } from '../lib/program'
import { defaultWarmup } from '../lib/randomizer'
import { useToday } from '../lib/useToday'
import { useStore } from '../store'
import { EquipmentPicker } from './EquipmentPicker'
import { LikedCardioPicker, LikedStylesPicker, MovePrefsPicker } from './TrainingPrefsPicker'

type Step = 'welcome' | 'goal' | 'where' | 'likes' | 'moves' | 'cardio' | 'schedule' | 'plan'
const STEPS: Step[] = ['welcome', 'goal', 'where', 'likes', 'moves', 'cardio', 'schedule', 'plan']
const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const primary = 'w-full rounded-2xl bg-accent py-3.5 text-base font-semibold text-on-accent disabled:opacity-30'
const choice = (on: boolean) => `w-full rounded-2xl px-4 py-3.5 text-left ring-1 ${on ? 'bg-accent/15 ring-accent' : 'bg-surface ring-neutral-200'}`
const chip = (on: boolean) => `h-12 flex-1 rounded-2xl text-base font-medium ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`

/**
 * First run: a few one-tap questions (goal, where you train, what you like, cardio, days and time) and a first month
 * planned from the answers, so the app is useful straight away. Every answer can be changed later in Settings, the
 * whole thing can be skipped, and social features are offered later.
 */
export function Onboarding() {
  const s = useStore()
  const today = useToday()
  const invite = s.pendingInvite
  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState(s.name)
  // One or more goals, or 'none' (just logging).
  const [goal, setGoalState] = useState<ProgramGoal[] | 'none'>([])
  const setGoal = (g: ProgramGoal[] | 'none') => { setGoalState(g); s.setTrainingPrefs({ goals: g === 'none' ? [] : g, goal: null }) }
  const goals = goal === 'none' ? [] : goal
  const toggleGoal = (id: ProgramGoal) => setGoal(goals.includes(id) ? goals.filter((x) => x !== id) : [...goals, id])
  const [days, setDays] = useState(3)
  const [minutes, setMinutes] = useState(45)
  const [week, setWeek] = useState<ProgramDay[] | null>(null)
  const [exact, setExact] = useState(false)
  const steps = goal === 'none' ? STEPS.slice(0, 6) : STEPS

  const finish = () => { if (name.trim()) s.setName(name.trim()); s.setTourDone(true); s.setOnboarded(true) }
  const build = () => {
    const result = generateProgram({
      anchorMonday: toISO(mondayOf(parseISO(today))), fromDate: today, weeks: 4,
      trainWeekdays: defaultWeekdays(days), goal: goals, minutes,
      warmup: defaultWarmup(s.genPrefs.warmup, true, s.genPrefs.warmMinutes), rest: s.genPrefs.rest, likedStyles: s.trainingPrefs.styles,
    })
    setWeek(result)
    setStep('plan')
  }
  const startPlan = () => {
    if (!week) return
    s.startProgram(Object.fromEntries(week.map((d) => [d.date, d.items])), `${goals.length ? goalsLabel(goals) : 'My'} plan`, today)
    finish()
  }
  const firstWeek = week?.filter((d) => d.weekIndex === 0) ?? []

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-1.5" aria-label={`Step ${steps.indexOf(step) + 1} of ${steps.length}`}>
            {steps.map((x) => <span key={x} className={`h-1.5 rounded-full ${x === step ? 'w-6 bg-accent' : 'w-1.5 bg-neutral-300'}`} />)}
          </div>
          <button onClick={finish} className="text-sm text-neutral-500">Skip</button>
        </div>

        {step === 'welcome' && (
          <>
            <p className="mb-2 text-5xl" aria-hidden>💪</p>
            <h1 className="mb-2 text-3xl font-semibold tracking-tight">Welcome to Durata</h1>
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
            <h1 className="mb-1 text-2xl font-semibold tracking-tight">What are your goals?</h1>
            <p className="mb-5 text-neutral-500">Pick one or more (like build muscle and lose fat). We’ll build your first month around them. You can change them any time in Settings.</p>
            <div className="mb-6 space-y-2">
              {PROGRAM_GOALS.map((g) => (
                <button key={g.id} onClick={() => toggleGoal(g.id)} aria-pressed={goals.includes(g.id)} className={choice(goals.includes(g.id))}>
                  <span className="block font-medium">{g.label}</span>
                  <span className="block text-sm text-neutral-500">{g.blurb}</span>
                </button>
              ))}
              <button onClick={() => setGoal('none')} aria-pressed={goal === 'none'} className={choice(goal === 'none')}>
                <span className="block font-medium">Just log my workouts</span>
                <span className="block text-sm text-neutral-500">No plan for now. I’ll add workouts myself.</span>
              </button>
            </div>
            <div className="mt-auto"><button disabled={goal !== 'none' && goals.length === 0} onClick={() => setStep('where')} className={primary}>Continue</button></div>
          </>
        )}

        {step === 'where' && (
          <>
            <h1 className="mb-1 text-2xl font-semibold tracking-tight">Where do you usually train?</h1>
            <p className="mb-5 text-neutral-500">Workouts only use equipment you have. You can pick somewhere else for any single workout, like a hotel gym on a trip.</p>
            <div className="mb-3"><EquipmentPicker detailed={exact} /></div>
            {!exact && <button onClick={() => setExact(true)} className="mb-6 text-left text-sm text-neutral-500 underline underline-offset-2">Pick exactly what I have</button>}
            <div className="mt-auto space-y-2">
              <button onClick={() => setStep('likes')} className={primary}>Continue</button>
              <button onClick={() => setStep('goal')} className="w-full py-2 text-sm text-neutral-500">Back</button>
            </div>
          </>
        )}

        {step === 'likes' && (
          <>
            <h1 className="mb-1 text-2xl font-semibold tracking-tight">What do you like to do?</h1>
            <p className="mb-5 text-neutral-500">Pick as many as you like. Your plans and “Make me a workout” lean towards these.</p>
            <div className="mb-6"><LikedStylesPicker /></div>
            <div className="mt-auto space-y-2">
              <button onClick={() => setStep('moves')} className={primary}>{s.trainingPrefs.styles.length ? 'Continue' : 'No preference, continue'}</button>
              <button onClick={() => setStep('where')} className="w-full py-2 text-sm text-neutral-500">Back</button>
            </div>
          </>
        )}

        {step === 'moves' && (
          <>
            <h1 className="mb-1 text-2xl font-semibold tracking-tight">Any exercises you prefer?</h1>
            <p className="mb-5 text-neutral-500">Generated workouts pick more of what you mark “More” and less of “Less”. Every body part still gets trained. You can change this any time in Settings.</p>
            <div className="mb-6"><MovePrefsPicker /></div>
            <div className="mt-auto space-y-2">
              <button onClick={() => setStep('cardio')} className={primary}>{Object.values(s.trainingPrefs.moves ?? {}).some(Boolean) ? 'Continue' : 'No preference, continue'}</button>
              <button onClick={() => setStep('likes')} className="w-full py-2 text-sm text-neutral-500">Back</button>
            </div>
          </>
        )}

        {step === 'cardio' && (
          <>
            <h1 className="mb-1 text-2xl font-semibold tracking-tight">What cardio do you like?</h1>
            <p className="mb-5 text-neutral-500">Used for cardio days, finishers and warm-ups, and as stations in CrossFit-style and timed workouts (like 12 cal on the air bike).</p>
            <div className="mb-6"><LikedCardioPicker /></div>
            <div className="mt-auto space-y-2">
              <button onClick={() => (goal === 'none' ? finish() : setStep('schedule'))} className={primary}>{goal === 'none' ? 'Start using the app' : s.trainingPrefs.cardio.length ? 'Continue' : 'No preference, continue'}</button>
              <button onClick={() => setStep('moves')} className="w-full py-2 text-sm text-neutral-500">Back</button>
            </div>
          </>
        )}

        {step === 'schedule' && (
          <>
            <h1 className="mb-1 text-2xl font-semibold tracking-tight">How often can you train?</h1>
            <p className="mb-5 text-neutral-500">Be realistic. Consistency beats ambition.</p>
            <p className="mb-2 text-sm font-medium">Days a week</p>
            <div className="mb-2 flex gap-2">{[2, 3, 4, 5, 6].map((n) => <button key={n} onClick={() => setDays(n)} className={chip(days === n)}>{n}</button>)}</div>
            <p className="mb-6 text-sm text-neutral-400">{defaultWeekdays(days).map((d) => DAY[d]).join(', ')}. You can move days later.</p>
            <p className="mb-2 text-sm font-medium">Minutes per workout</p>
            <div className="mb-8 flex gap-2">{[30, 45, 60, 75, 90].map((m) => <button key={m} onClick={() => setMinutes(m)} className={chip(minutes === m)}>{m}</button>)}</div>
            <div className="mt-auto space-y-2">
              <button onClick={build} className={primary}>Build my plan</button>
              <button onClick={() => setStep('cardio')} className="w-full py-2 text-sm text-neutral-500">Back</button>
            </div>
          </>
        )}

        {step === 'plan' && (
          <>
            <h1 className="mb-1 text-2xl font-semibold tracking-tight">Your first week</h1>
            <p className="mb-5 text-neutral-500">Four weeks are planned, getting a little harder each week. Swap anything you don’t like on the Workouts tab.</p>
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
