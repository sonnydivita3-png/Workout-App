/** How calories are worked out, in plain words (Settings → Help, linked from Profile). */
const QA: [string, string][] = [
  [
    'How are calories estimated?',
    'For cardio, the app uses the standard formula: how hard the activity is (its MET value, from the Compendium of Physical Activities) × your bodyweight in kg × the time. Running, walking and cycling use your pace when you log a distance, so faster counts as harder. Then it subtracts what your body would have burned resting over the same time, so the number is what the workout added. Most watches show it the same way.',
  ],
  [
    'What information does it need?',
    'Your bodyweight (log it in Progress → Body) and the workout’s minutes. That’s all that’s required. Sex, age and height are optional (Settings → Profile): with them, your resting burn is worked out for you (the Mifflin-St Jeor equation) instead of a standard average.',
  ],
  [
    'Why don’t sex and age change it more?',
    'The energy cost of moving is mostly about your weight and speed: a 180 lb man and a 180 lb woman running the same pace use about the same energy. Sex, age and height mainly change your resting burn, which is the part that gets subtracted.',
  ],
  [
    'How accurate is it?',
    'Treat it as a rough guide, within about 10–20% for steady running, walking and cycling, and looser for machines and intervals. Watches are estimates too (heart rate helps them, but they can be off by more). If you trust your watch, type its number on the cardio card and the app uses that instead.',
  ],
  [
    'What counts?',
    'Cardio: runs, rides, rows, machines, and the cardio inside Hyrox and timed workouts. Lifting and bodyweight moves aren’t counted, because estimates for them are unreliable.',
  ],
]

export function CaloriesFaq() {
  return (
    <div className="divide-y divide-neutral-100 rounded-2xl bg-surface shadow-sm ring-1 ring-neutral-200/70">
      {QA.map(([q, a]) => (
        <details key={q} className="group px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">
            {q}
            <span className="text-neutral-400 transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <p className="mt-2 text-sm text-neutral-500">{a}</p>
        </details>
      ))}
    </div>
  )
}
