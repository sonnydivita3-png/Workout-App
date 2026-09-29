import { useState } from 'react'
import { useStore } from '../store'

interface Step {
  icon: string
  title: string
  body: string
  points: string[]
}

const steps = (social: boolean): Step[] => [
  {
    icon: '📅', title: 'Plan your week',
    body: 'The Plan tab is a weekly calendar. Pick a day, tap + Add exercise, and choose from 750+ exercises.',
    points: ['Set how many sets you’ll do; drop or swap exercises any time', 'Day options: copy a day, save it as a routine, load one, or mark a rest day'],
  },
  {
    icon: '🎲', title: 'Let the randomizer build it',
    body: 'Tap Randomize on the Plan tab. Choose muscles or cardio, how long you have, and a style.',
    points: ['Styles: standard, strength, supersets, HIIT, PHA, Hyrox, CrossFit, bodyweight', 'Swap or pick any exercise, step back through versions, then add it or save as a routine', 'Switch to Week / month for a random program with rest days', 'Training plan (next to Randomize) builds a run or bike plan for a race; stop or replace any program from the Plan tab'],
  },
  {
    icon: '✍️', title: 'Log as you go',
    body: 'Open a day and enter what you did. The app shows what you did last time on each exercise.',
    points: ['Lifting: weight × reps. Bodyweight: reps. Planks and holds: seconds', 'Cardio: distance and time, with pace worked out for you'],
  },
  {
    icon: '🏠', title: 'Your Home dashboard',
    body: 'Home shows today’s workout, your last real workout, weekly stats and your body weight trend.',
    points: ['Log body weight and watch the chart', 'Set goals: workouts per week, a lift, body weight, or cardio (distance, pace, a race)'],
  },
  {
    icon: '📈', title: 'History and notifications',
    body: 'History charts your progress per exercise and flags personal bests. The bell on Home lists goal progress and reminders.',
    points: ['Turn notification types on or off in Settings', 'Everything works offline, and you can back up to a file'],
  },
  social
    ? {
        icon: '👥', title: 'Train with friends',
        body: 'The Social tab is where friends live. Add someone by their exact handle.',
        points: ['Being friends shares nothing. You choose, per friend, what they can see or send you', 'Share a day, week or month. They add it to their calendar', 'Ask a friend for a workout, or send challenges like push-ups or a run distance', 'Talk with emoji only'],
      }
    : {
        icon: '👥', title: 'Friends are optional',
        body: 'Social is off. Turn it on any time in Settings to share workouts, send challenges and cheer friends on.',
        points: ['You choose what each friend can see or send you', 'Emoji only, no chat'],
      },
  {
    icon: '⚙️', title: 'You’re set',
    body: 'Settings has units, notifications, backup, and a way to erase everything and start over.',
    points: ['Replay this walkthrough any time from Settings → Help', 'Make it yours: pick dark or light and an accent colour in Settings → Look', 'Tip: add the app to your home screen so it opens like any other app'],
  },
]

/** A short first-run walkthrough. Skippable, and replayable from Settings. */
export function Tour() {
  const social = useStore((s) => s.socialChoice === 'enabled')
  const setTourDone = useStore((s) => s.setTourDone)
  const [i, setI] = useState(0)
  const list = steps(social)
  const step = list[i]
  const last = i === list.length - 1

  return (
    <div role="dialog" aria-modal="true" aria-label="App walkthrough" className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-neutral-50">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between text-sm text-neutral-400">
          <span>{i + 1} of {list.length}</span>
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
