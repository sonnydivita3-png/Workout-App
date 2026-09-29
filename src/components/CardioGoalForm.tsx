import { useState } from 'react'
import { goalEventsFor } from '../lib/cardioEvents'
import { distanceFactor, showDistance, storeDistance } from '../lib/units'
import { useStore } from '../store'
import type { CardioSport, GoalPeriod, NewGoal, Sport } from '../types'
import { NumberInput } from './NumberInput'
import { primaryBtn } from './Sheet'

type Sub = 'distance' | 'time' | 'pace' | 'event'

const SUBS: { id: Sub; label: string }[] = [
  { id: 'distance', label: 'Distance' },
  { id: 'time', label: 'Time' },
  { id: 'pace', label: 'Pace / speed' },
  { id: 'event', label: 'Run or ride an event' },
]

const chip = (on: boolean) => `rounded-full px-3 py-1 text-sm ${on ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`

export function CardioGoalForm({ onDone }: { onDone: () => void }) {
  const { units, addGoal } = useStore()
  const [sub, setSub] = useState<Sub>('distance')
  const [sport, setSport] = useState<CardioSport>('run')
  const [period, setPeriod] = useState<GoalPeriod>('week')
  const [amount, setAmount] = useState<number | null>(null) // distance (units) or minutes, by sub
  const [minDistance, setMinDistance] = useState<number | null>(null) // pace goals: distance in units
  const [paceMin, setPaceMin] = useState<number | null>(null)
  const [paceSec, setPaceSec] = useState<number | null>(null)
  const [speed, setSpeed] = useState<number | null>(null)
  const [eventIdx, setEventIdx] = useState(0)
  const [date, setDate] = useState('')

  const dUnit = units.distance
  const factor = distanceFactor(units) // units per mile
  const specific: Sport = sport === 'any' ? 'run' : sport // pace and events need one sport
  const events = goalEventsFor(specific)
  const ev = events[Math.min(eventIdx, events.length - 1)]

  const build = (): NewGoal | null => {
    if (sub === 'distance') return amount ? { type: 'cardio-distance', sport, period, target: storeDistance(amount, units)! } : null
    if (sub === 'time') return amount ? { type: 'cardio-time', sport, period, target: amount } : null
    if (sub === 'pace') {
      if (!minDistance) return null
      if (specific === 'run') {
        const perUnit = (paceMin ?? 0) + (paceSec ?? 0) / 60
        return perUnit > 0 ? { type: 'cardio-pace', sport: 'run', minDistance: storeDistance(minDistance, units)!, target: perUnit * factor } : null
      }
      return speed ? { type: 'cardio-pace', sport: 'bike', minDistance: storeDistance(minDistance, units)!, target: speed / factor } : null
    }
    return ev ? { type: 'race', sport: specific, label: ev.label, distance: ev.miles!, ...(date ? { date } : {}) } : null
  }
  const goal = build()

  const sports: [CardioSport, string][] = sub === 'pace' || sub === 'event'
    ? [['run', 'Running'], ['bike', 'Cycling']]
    : [['run', 'Running'], ['bike', 'Cycling'], ['any', 'Any cardio']]
  const chooseSport = (s: CardioSport) => { setSport(s); setEventIdx(0); setMinDistance(null) }

  const quick = specific === 'run'
    ? [1, 3.107, 6.214, 13.109].map((mi) => showDistance(mi, units)!)
    : [10, 25, 50, 100].map((mi) => showDistance(mi, units)!)

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {SUBS.map((s) => (
          <button key={s.id} onClick={() => { setSub(s.id); setAmount(null); if (sport === 'any' && (s.id === 'pace' || s.id === 'event')) setSport('run') }} className={chip(s.id === sub)}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {sports.map(([id, label]) => <button key={id} onClick={() => chooseSport(id)} className={chip(id === sport || (sport === 'any' && id === 'run' && sub !== 'distance' && sub !== 'time'))}>{label}</button>)}
      </div>

      {(sub === 'distance' || sub === 'time') && (
        <>
          <div className="mb-4 flex gap-2">
            {(['week', 'month'] as const).map((p) => <button key={p} onClick={() => setPeriod(p)} className={chip(p === period)}>Per {p}</button>)}
          </div>
          <label className="mb-4 block text-sm text-neutral-500">
            {sub === 'distance' ? `Target distance (${dUnit})` : 'Target time (minutes)'}
            <div className="mt-1 w-28"><NumberInput value={amount} step={sub === 'distance' ? 1 : 10} onChange={setAmount} /></div>
          </label>
        </>
      )}

      {sub === 'pace' && (
        <>
          <label className="mb-2 block text-sm text-neutral-500">
            Over at least ({dUnit})
            <div className="mt-1 w-28"><NumberInput value={minDistance} step={0.5} onChange={setMinDistance} /></div>
          </label>
          <div className="mb-4 flex flex-wrap gap-2">
            {quick.map((q) => <button key={q} onClick={() => setMinDistance(q)} className={chip(minDistance === q)}>{q} {dUnit}</button>)}
          </div>
          {specific === 'run' ? (
            <div className="mb-4 text-sm text-neutral-500">
              Target pace (per {dUnit})
              <div className="mt-1 flex items-center gap-2">
                <div className="w-20"><NumberInput value={paceMin} placeholder="min" onChange={setPaceMin} /></div>
                <span>:</span>
                <div className="w-20"><NumberInput value={paceSec} placeholder="sec" onChange={setPaceSec} /></div>
              </div>
            </div>
          ) : (
            <label className="mb-4 block text-sm text-neutral-500">
              Average speed ({dUnit === 'km' ? 'km/h' : 'mph'})
              <div className="mt-1 w-28"><NumberInput value={speed} step={0.5} onChange={setSpeed} /></div>
            </label>
          )}
        </>
      )}

      {sub === 'event' && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {events.map((e, i) => <button key={e.id} onClick={() => setEventIdx(i)} className={chip(i === eventIdx)}>{e.label}</button>)}
          </div>
          <label className="mb-1 block text-sm text-neutral-500">
            Event date (optional)
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block w-full rounded-lg bg-neutral-100 px-3 py-2 text-neutral-900 outline-none" />
          </label>
          <p className="mb-4 text-xs text-neutral-400">
            Counts as reached once you log a single {specific === 'run' ? 'run' : 'ride'} of {ev && showDistance(ev.miles!, units)} {dUnit} or more.
          </p>
        </>
      )}

      <button disabled={!goal} onClick={() => { addGoal(goal!); onDone() }} className={primaryBtn}>Add goal</button>
    </>
  )
}
