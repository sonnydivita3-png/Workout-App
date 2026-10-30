import { inclineMet } from '../lib/calories'
import { CARDIO_SESSIONS, SPRINT_ROUNDS, sessionsFor, TABATA_FORMATS, tabataMinutes } from '../lib/cardioSession'
import { ACTIVITIES, cardioIds, exerciseFor, INCLINES, type CardioSetup } from '../lib/cardioSetup'
import { useStore } from '../store'

const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`

/**
 * Cardio for a workout, in the order people think about it: what (run, ride, row…), before or after the lifting, where (outside or on a
 * treadmill / indoor bike), then what kind of session (steady, intervals, tempo, hills, time trial), and on a treadmill,
 * the incline.
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
  // With lifting: first or last (their usual order from plans until they pick).
  const first = value.first ?? prefs.stackOrder === 'cardio'
  const same = ids.length === prefs.cardio.length && ids.every((x) => prefs.cardio.includes(x)) && (ids.length < 2 || value.split === prefs.cardioSplit)
  return (
    <div className="mb-5">
      <h3 className="mb-1 text-sm font-medium">{finisher ? 'Cardio with your workout' : 'What cardio?'}</h3>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Cardio">
        <button onClick={() => onChange({ ...value, activities: [] })} aria-pressed={picked.length === 0} className={chip(picked.length === 0)}>Any</button>
        {ACTIVITIES.map((a) => <button key={a.key} onClick={() => toggle(a.key)} aria-pressed={picked.includes(a.key)} className={chip(picked.includes(a.key))}>{a.label}</button>)}
      </div>
      {finisher && (
        <div className="mb-3 flex gap-2" role="radiogroup" aria-label="Cardio first or last">
          <button role="radio" aria-checked={first} onClick={() => onChange({ ...value, first: true })} className={chip(first)}>Start with it</button>
          <button role="radio" aria-checked={!first} onClick={() => onChange({ ...value, first: false })} className={chip(!first)}>Finish with it</button>
        </div>
      )}
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
          {session === 'tabata' && (() => {
            const format = value.tabata ?? '8'
            const sprints = value.sprints ?? SPRINT_ROUNDS[0]
            return (
              <>
                <div className="mb-1 mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Tabata format">
                  {TABATA_FORMATS.map((t) => <button key={t.id} role="radio" aria-checked={format === t.id} onClick={() => onChange({ ...value, tabata: t.id })} className={chip(format === t.id)}>{t.label}</button>)}
                </div>
                {format === 'sprint' && (
                  <div className="mb-1 flex flex-wrap gap-2" role="radiogroup" aria-label="How many sprints">
                    {SPRINT_ROUNDS.map((n) => <button key={n} role="radio" aria-checked={sprints === n} onClick={() => onChange({ ...value, sprints: n })} className={chip(sprints === n)}>{n} sprints</button>)}
                  </div>
                )}
                <p className="text-xs text-neutral-400">{TABATA_FORMATS.find((t) => t.id === format)!.blurb} About {Math.round(tabataMinutes(format, sprints))} min with 5 min easy before and after.</p>
              </>
            )
          })()}
        </>
      )}
      {value.where === 'in' && session !== 'hills' && picked.some((k) => k === 'running' || k === 'walking') && (
        <>
          <p className="mb-1 mt-3 text-sm font-medium">Treadmill incline</p>
          <div className="mb-1 flex flex-wrap gap-2" role="radiogroup" aria-label="Treadmill incline">
            {INCLINES.map((g) => (
              <button key={g} role="radio" aria-checked={(value.incline ?? 0) === g} onClick={() => onChange({ ...value, incline: g })} className={chip((value.incline ?? 0) === g)}>{g ? `${g}%` : 'Flat'}</button>
            ))}
          </div>
          <p className="text-xs text-neutral-400">{incline(value.incline ?? 0)}</p>
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

/** What an incline does: a 3 mph walk (3.5 METs flat) and a 6 mph run (9.8) at that grade (ACSM equations). */
const x = (n: number) => `${Math.round(n * 10) / 10}×`
const incline = (g: number) =>
  !g ? 'Walking or running uphill burns more: pick an incline to count it.'
    : `At ${g}%, a 3 mph walk burns about ${x((3.5 + inclineMet(3, g, true)) / 3.5)} what it does flat, a 6 mph run about ${x((9.8 + inclineMet(6, g, false)) / 9.8)}.`
