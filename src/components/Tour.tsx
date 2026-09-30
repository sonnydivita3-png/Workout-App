import { useState } from 'react'
import { TOUR_VERSION, useStore } from '../store'

interface Step {
  icon: string
  title: string
  body: string
  points: string[]
}

const steps = (social: boolean): Step[] => [
  {
    icon: '🏠', title: 'Start from Home',
    body: 'Home shows today’s workout with one big Start button.',
    points: [
      'Nothing planned? Repeat your last workout, let the app make one, or start empty and add exercises as you go',
      'Your week at a glance, compared with the same point last week',
      'Body weight is one tap to log; the trend is in Progress → Body',
      'Settings is the gear at the top right',
    ],
  },
  {
    icon: '🎯', title: 'Beat last time',
    body: 'Every set has a target based on what you did last time.',
    points: [
      'Tap ✓ when a set is done: it logs the target and starts the rest timer',
      'Use − and + to change weight or reps without typing',
      '▲ ▼ show where you beat or missed last time; tap a set number to mark a warm-up',
      'The screen stays on during a workout, and the phone buzzes when rest is over',
    ],
  },
  {
    icon: '📅', title: 'Plan your week',
    body: 'The Plan tab shows what each day trains (Legs, Full, Run, Rest).',
    points: [
      'An empty day offers Add exercises, Make a workout, Load a routine or Rest day',
      'Changes apply to that date only. Use ⋯ → Repeat every Monday (or any day) for your usual week',
      '+ Add has more: a week or month plan, timed workouts (AMRAP, EMOM, Tabata) and run or ride plans',
    ],
  },
  {
    icon: '🎲', title: 'Make me a workout',
    body: 'Pick what to train and how long. That’s it.',
    points: [
      'Full body is one tap, and it remembers your last choices',
      'More options: style (strength, supersets, HIIT, timed, Hyrox/CrossFit), warm-up and rest',
      'Swap any exercise, step back through versions, or save it as a routine',
    ],
  },
  {
    icon: '📈', title: 'See your progress',
    body: 'The Progress tab has every workout, every exercise and your body stats.',
    points: [
      'Workouts: a calendar, and each session compared with the time before',
      'Exercises: charts and personal bests; Body: weight, measurements and photos that stay on your phone',
      'Set goals on Home, from a lift to a race, and a race goal builds its training plan',
    ],
  },
  social
    ? {
        icon: '👥', title: 'Train with friends',
        body: 'Invite friends with a link, or add them by their exact handle.',
        points: [
          'Being friends shares nothing until you choose what each friend can see or send you',
          'Share workouts, ask for one, send challenges and emoji',
          'Report or block anyone from their profile or friend request',
        ],
      }
    : {
        icon: '👥', title: 'Friends are optional',
        body: 'Turn them on in Settings → Friends & account to share workouts and send challenges.',
        points: ['You choose what each friend can see or send you', 'Email is optional'],
      },
  {
    icon: '☁️', title: 'Keep your workouts safe',
    body: 'Workouts are saved on this phone.',
    points: [
      'Add the app to your home screen so the browser doesn’t clear it',
      'Turn on cloud backup in Settings → Backup & data to restore on a new phone',
      'Workouts and suggestions are general guidance, not medical advice',
      'This guide is in Settings → Help & feedback',
    ],
  },
]

/** A short first-run walkthrough. Skippable, and replayable from Settings. */
export function Tour() {
  const social = useStore((s) => s.socialChoice === 'enabled')
  const setTourDone = useStore((s) => s.setTourDone)
  const returning = useStore((s) => s.tourDone && s.tourVersion < TOUR_VERSION)
  const [i, setI] = useState(0)
  const list = steps(social)
  const step = list[i]
  const last = i === list.length - 1

  return (
    <div role="dialog" aria-modal="true" aria-label="App walkthrough" className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-neutral-50">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between text-sm text-neutral-400">
          <span>{returning && i === 0 ? 'What’s new · ' : ''}{i + 1} of {list.length}</span>
          {!last && <button onClick={() => setTourDone(true)} className="text-neutral-500">Skip</button>}
        </div>
        <div className="flex flex-1 flex-col justify-center py-8">
          <p className="mb-4 text-5xl" aria-hidden>{step.icon}</p>
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">{step.title}</h1>
          <p className="mb-4 text-neutral-600">{step.body}</p>
          <ul className="space-y-2 text-sm text-neutral-500">
            {step.points.map((p) => <li key={p} className="flex gap-2"><span aria-hidden>•</span><span>{p}</span></li>)}
          </ul>
        </div>
        <div className="mb-4 flex justify-center gap-1.5" aria-hidden>
          {list.map((_, n) => <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-5 bg-accent' : 'w-1.5 bg-neutral-300'}`} />)}
        </div>
        <div className="flex gap-2">
          {i > 0 && <button onClick={() => setI(i - 1)} className="w-1/3 rounded-2xl bg-neutral-100 py-3 text-sm font-medium text-neutral-700">Back</button>}
          <button onClick={() => (last ? setTourDone(true) : setI(i + 1))} className="flex-1 rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent">{last ? 'Start' : 'Next'}</button>
        </div>
      </div>
    </div>
  )
}
