import type { StackOrder } from '../lib/programs'
import type { Sport } from '../types'

const chip = (on: boolean) => `flex-1 rounded-full px-3 py-1.5 text-sm ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`

/**
 * Lift or run first, on the days a run/bike plan and a lifting plan share (nothing picked until they answer), or lift
 * or cardio first on lifting days with cardio of their own (`sport` 'cardio').
 */
export function StackOrderPicker({ value, onChange, sport, days, compact = false }: { value?: StackOrder; onChange: (o: StackOrder) => void; sport: Sport | 'cardio'; days?: number; compact?: boolean }) {
  const run = sport === 'bike' ? 'Ride' : sport === 'cardio' ? 'Cardio' : 'Run'
  const hard = sport === 'cardio' ? 'hard cardio session' : run.toLowerCase()
  return (
    <div role="group" aria-label="Lift or run first" className={compact ? '' : 'mb-3 rounded-2xl bg-neutral-50 p-3'}>
      <p className="mb-2 text-sm font-medium text-neutral-700">
        {days ? `On the ${days} day${days === 1 ? '' : 's'} with both, which first?` : 'On days with both, which first?'}
      </p>
      <div className="flex gap-2">
        <button onClick={() => onChange('lift')} aria-pressed={value === 'lift'} className={chip(value === 'lift')}>Lift first</button>
        <button onClick={() => onChange('cardio')} aria-pressed={value === 'cardio'} className={chip(value === 'cardio')}>{run} first</button>
      </div>
      {!compact && (
        <p className="mt-2 text-xs text-neutral-500">
          Do first what matters most to you. Studies find lifting first gives a little more leg strength, while the order makes
          little difference to endurance. A {hard} (intervals, a long one) goes better on fresh legs.
        </p>
      )}
    </div>
  )
}
