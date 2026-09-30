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
    icon: '📅', title: 'Plan your week',
    body: 'The Plan tab is your calendar. Pick a day, then tap + Add.',
    points: [
      '+ Add: pick an exercise from 750+, randomize a workout or a whole week/month, build a timed workout, or start a training plan',
      'Day options: copy a day, save or load a routine, share it, or make it a rest day',
      'Tap an exercise’s name for how-to steps, pictures and the muscles it works',
    ],
  },
  {
    icon: '🎯', title: 'Beat last time',
    body: 'Every lift tells you what to try next, based on what you did last time.',
    points: [
      '“Try 140 lb × 8”: hit your reps on every set and it adds weight; otherwise one more rep. Tap Fill to use it',
      '▲ ▼ next to each set shows if you beat last time',
      'Tap a set number to mark a warm-up (it won’t count). Add notes, and use Plates for barbell loading',
      'Cardio cards show the distance or pace to beat. Import a run or ride from a GPX file',
    ],
  },
  {
    icon: '▶️', title: 'Workout mode',
    body: 'Tap ▶ Start workout (Home or Plan) to go one exercise at a time.',
    points: [
      'Tick ✓ as you finish each set; an optional rest timer counts you down',
      'Finish to see what improved, new personal bests, and volume vs last time',
      'Hide it any time and come back from the button at the bottom',
    ],
  },
  {
    icon: '🎲', title: 'Randomizer',
    body: 'Tell it what to train, how long you have and the style. Mix styles if you like.',
    points: [
      'Styles: Standard, Strength, Supersets, Bodyweight, HIIT, Timed and Hyrox/CrossFit',
      'Pick two or more (say Strength + Cardio) and set minutes for each part',
      'Add a warm-up (easy cardio, mobility, ramp-up sets) and pick how long you rest; workouts are built to fill your time',
      'Swap or choose any exercise, step back through versions, then add it or save it as a routine',
    ],
  },
  {
    icon: '⏱️', title: 'Timed workouts',
    body: 'AMRAP, EMOM, Tabata and For time, from the randomizer or built yourself.',
    points: [
      'Each has a built-in clock that calls out the movement and beeps on changes',
      'Log rounds, intervals or your finish time; last time’s result is shown to beat',
      'HIIT circuits get a work/rest timer, and planks and other holds get a stopwatch',
    ],
  },
  {
    icon: '🏁', title: 'Goals and training plans',
    body: 'Set a goal on Home. Pick a race, like a half marathon, and it builds the plan for you.',
    points: [
      'Run and bike plans from Couch to 5K up to a marathon, century or 200K',
      'My programs on the Plan tab: stop or replace a plan any time (logged days are kept)',
      'Goals for workouts a week, a lift, body weight, distance, pace or an event',
    ],
  },
  {
    icon: '📈', title: 'See your progress',
    body: 'History shows how far you’ve come.',
    points: [
      'Workouts: a calendar, and each day compared with the time before',
      'Hard sets per muscle this week vs last, plus charts and personal bests for every exercise',
      'Body: measurements with trends, and progress photos that stay on your phone',
      'Home tracks body weight, this week’s stats and your goals; the bell lists wins and reminders',
    ],
  },
  social
    ? {
        icon: '👥', title: 'Train with friends',
        body: 'The Social tab is where friends live. Send an invite link, or add someone by their exact handle.',
        points: [
          'Being friends shares nothing. You choose, per friend, what they can see or send you',
          'Share a day, week or month; ask a friend to make you a workout; send challenges and log them',
          'Emoji only, no chat. Email is optional',
        ],
      }
    : {
        icon: '👥', title: 'Friends are optional',
        body: 'Social is off. Turn it on any time in Settings to share workouts, send challenges and cheer friends on.',
        points: ['You choose what each friend can see or send you', 'Emoji only, no chat. Email is optional', 'Invite a friend to the app any time from Settings'],
      },
  {
    icon: '⚙️', title: 'Make it yours',
    body: 'Settings has everything else.',
    points: [
      'Cloud backup keeps your workouts safe if you change phones',
      'Dark or light, five accent colours, plain wording, effort (RPE) tracking and a rest timer',
      'Workouts and suggestions are general guidance, not medical advice. Check with a doctor before starting something new',
      'Replay this walkthrough any time from Settings → Help, and add the app to your home screen',
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
