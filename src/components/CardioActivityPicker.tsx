import { CARDIO_SESSIONS, sessionsFor } from '../lib/cardioSession'
import { ACTIVITIES, cardioIds, exerciseFor, type CardioSetup } from '../lib/cardioSetup'
import { useStore } from '../store'

const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`

/**
 * Cardio for a workout, in the order people think about it: what (run, ride, row…), where (outside or on a
 * treadmill / indoor bike), then what kind of session (steady, intervals, tempo, hills, time trial).
 */
export function CardioActivityPicker({ value, onChange, finisher }: { value: CardioSetup; onChange: (v: CardioSetup) => void; finisher: boolean }) {
  const prefs = useStore((s) => s.trainingPrefs)
  const setTrainingPrefs = useStore((s) => s.setTrainingPrefs)
  const picked = value.activities
  const toggle = (k: string) => onChange({ ...value, activities: picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k] })
  const indoorable = ACTIVITIES.filter((a) => a.in && picked.includes(a.key))
  const ids = cardioIds(value)
  const one = ids.length === 1 ? exerciseFor(ids[0]) : undefined
  // Session types for one activity (hills only where there's a hill, incline or resistance); several share steady time.
  const kinds = ids.length > 1 ? [] : one ? sessionsFor(one) : CARDIO_SESSIONS.map((s) => s.id).filter((k) => k !== 'hills')
  const session = kinds.includes(value.session) ? value.session : 'steady'
  const same = ids.length === prefs.cardio.length && ids.every((x) => prefs.cardio.includes(x)) && (ids.length < 2 || value.split === prefs.cardioSplit)
  return (
    <div className="mb-5">
      <h3 className="mb-1 text-sm font-medium">{finisher ? 'Cardio to finish with' : 'What cardio?'}</h3>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Cardio">
        <button onClick={() => onChange({ ...value, activities: [] })} aria-pressed={picked.length === 0} className={chip(picked.length === 0)}>Any</button>
        {ACTIVITIES.map((a) => <button key={a.key} onClick={() => toggle(a.key)} aria-pressed={picked.includes(a.key)} className={chip(picked.includes(a.key))}>{a.label}</button>)}
      </div>
      {indoorable.length > 0 && (
        <>
          <p className="mb-1 text-sm font-medium">Where?</p>
          <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Where">
            <button role="radio" aria-checked={value.where === 'out'} onClick={() => onChange({ ...value, where: 'out' })} className={chip(value.where === 'out')}>Outside</button>
            <button role="radio" aria-checked={value.where === 'in'} onClick={() => onChange({ ...value, where: 'in' })} className={chip(value.where === 'in')}>
              {[...new Set(indoorable.map((a) => a.inLabel))].join(' / ')}
            </button>
          </div>
        </>
      )}
      {picked.length > 1 && (
        <div className="mb-3 flex gap-2 text-sm" role="radiogroup" aria-label="Several kinds of cardio">
          <button role="radio" aria-checked={!value.split} onClick={() => onChange({ ...value, split: false })} className={chip(!value.split)}>One per workout</button>
          <button role="radio" aria-checked={value.split} onClick={() => onChange({ ...value, split: true })} className={chip(value.split)}>Split the time</button>
        </div>
      )}
      {kinds.length > 1 && (
        <>
          <p className="mb-1 text-sm font-medium">What kind of session?</p>
          <div className="mb-1 flex flex-wrap gap-2" role="radiogroup" aria-label="Kind of cardio session">
            {CARDIO_SESSIONS.filter((s) => kinds.includes(s.id)).map((s) => (
              <button key={s.id} role="radio" aria-checked={session === s.id} onClick={() => onChange({ ...value, session: s.id })} className={chip(session === s.id)}>{s.label}</button>
            ))}
          </div>
          <p className="text-xs text-neutral-400">{CARDIO_SESSIONS.find((s) => s.id === session)!.blurb}</p>
        </>
      )}
      {!same && (
        <p className="mt-2 text-xs text-neutral-400">
          Just for this workout.{' '}
          <button onClick={() => setTrainingPrefs({ cardio: ids, cardioSplit: value.split })} className="underline underline-offset-2">Make it my default</button>
        </p>
      )}
    </div>
  )
}
