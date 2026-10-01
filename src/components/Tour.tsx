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
    icon: '🏠', title: 'Home',
    body: 'Today’s workout and one Start button.',
    points: [
      'Nothing planned? Make a workout, repeat your last one, or pick exercises yourself',
      'Settings is the gear at the top right',
    ],
  },
  {
    icon: '💪', title: 'Workouts',
    body: 'Your week, and each day’s workout ready to log. No clock to manage.',
    points: [
      'Tap ✓ when a set is done. It fills in a target that beats last time, so most sets are one tap',
      '+ Add puts an exercise, a generated workout or a whole week or month plan on a day',
      'Timed workouts (AMRAP, EMOM, Tabata, circuits) come with their own clock',
    ],
  },
  {
    icon: '📈', title: 'Progress',
    body: 'Every workout, charts and bests for each exercise, and your body stats.',
    points: ['Set goals on Home, from a lift to a race'],
  },
  {
    icon: social ? '👥' : '☁️', title: 'Good to know',
    body: social ? 'Friends see only what you choose to share with each of them.' : 'Workouts are saved on this phone.',
    points: [
      'Turn on cloud backup in Settings → Backup & data to keep them safe',
      ...(social ? [] : ['Friends are optional: Settings → Friends & account']),
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
