import { useState } from 'react'
import { BUILTIN_BY_ID } from '../../data/exercises'
import { fmtLong, parseISO, toISO } from '../../lib/dates'
import { storeDistance, storeWeight } from '../../lib/units'
import { useToday } from '../../lib/useToday'
import { challengeProgress, formatAmount } from '../../social/challengeProgress'
import { useSocial } from '../../social/store'
import { findExercise, useStore } from '../../store'
import type { Exercise, StrengthSet } from '../../types'
import { NumberInput } from '../NumberInput'
import { Sheet } from '../Sheet'
import type { Tab } from '../TabBar'
import { label, primary, secondary } from './styles'
import { Avatar, ErrorNote } from './ui'

/** Take a challenge's exercise from a friend's message without ever letting it overwrite one of your own. */
function cleanExercise(x: { id: string; name: string; kind: 'strength' | 'cardio'; mode?: 'weight' | 'reps' | 'time' }): Exercise | null {
  if (typeof x.id !== 'string' || typeof x.name !== 'string' || (x.kind !== 'strength' && x.kind !== 'cardio')) return null
  const mode = x.mode === 'reps' || x.mode === 'time' || x.mode === 'weight' ? x.mode : 'weight'
  return { id: x.id.slice(0, 60), name: x.name.slice(0, 60), kind: x.kind, mode: x.kind === 'strength' ? mode : undefined, group: x.kind === 'cardio' ? 'Cardio' : 'Other', equipment: 'Custom', custom: true }
}

/** One challenge: how it's going, and (if it's yours to do) a place to log what you completed. */
export function ChallengeDetailSheet({ id, onNavigate, onClose }: { id: string; onNavigate: (t: Tab) => void; onClose: () => void }) {
  const today = useToday()
  const { logs, custom, units, saveStrength, saveCardio, addCustomExercises, addPlanned } = useStore()
  const { challenges, act } = useSocial()
  const c = challenges.find((x) => x.id === id)
  const [reps, setReps] = useState<number | null>(null)
  const [secs, setSecs] = useState<number | null>(null)
  const [weight, setWeight] = useState<number | null>(null)
  const [dist, setDist] = useState<number | null>(null)
  const [mins, setMins] = useState<number | null>(null)
  const [sport, setSport] = useState<'running' | 'cycling'>('running')
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!c) return null
  const lookup = (x: string) => findExercise(custom, x) ?? BUILTIN_BY_ID.get(x)
  const { spec } = c
  const other = c.mine ? c.to : c.from
  const live = c.status === 'active' && !c.mine ? challengeProgress(c, logs, today, lookup) : { progress: c.progress, done: c.done }
  const pct = Math.min(100, Math.round((live.progress / Math.max(c.target, 1)) * 100))
  const canLog = !c.mine && c.status === 'active'
  const daysLeft = c.endsAt ? Math.max(0, Math.round((parseISO(toISO(new Date(c.endsAt))).getTime() - parseISO(today).getTime()) / 86400000)) : null

  const respond = async (accept: boolean) => {
    const r = await act((b) => b.respondChallenge(c.id, accept))
    if (!r.ok) setError(r.error); else if (!accept) onClose()
  }

  // ---- logging: add to today's log so it counts like any other workout
  const ex = spec.exercise
  const exerciseId = ex?.id ?? (spec.metric === 'distance' || spec.metric === 'minutes' ? sport : undefined)
  const ensureExercise = () => {
    if (ex && !lookup(ex.id)) { const clean = cleanExercise(ex); if (clean) addCustomExercises([clean]) }
  }
  const isCardio = spec.metric === 'distance' || spec.metric === 'minutes'
  const existing = exerciseId ? logs.find((l) => l.date === today && l.exerciseId === exerciseId) : undefined

  const logStrength = () => {
    if (!exerciseId) return
    const set: StrengthSet | null =
      spec.metric === 'reps' ? (reps ? { weight: null, reps } : null)
      : spec.metric === 'seconds' ? (secs ? { weight: null, reps: null, seconds: secs } : null)
      : weight && reps ? { weight: storeWeight(weight, units)!, reps } : null
    if (!set) return
    ensureExercise()
    saveStrength(today, exerciseId, [...(existing?.sets ?? []), set])
    setNote(spec.metric === 'reps' ? `Logged ${reps} reps` : spec.metric === 'seconds' ? `Logged ${secs} seconds` : `Logged ${weight} ${units.weight} × ${reps}`)
    setReps(null); setSecs(null); setWeight(null)
  }
  const logCardio = () => {
    if (!exerciseId) return
    const d = dist ? storeDistance(dist, units)! : 0
    const m = mins ?? 0
    if ((spec.metric === 'distance' && !d) || (spec.metric === 'minutes' && !m)) return
    ensureExercise()
    saveCardio(today, exerciseId, { distance: (existing?.cardio?.distance ?? 0) + d || null, minutes: (existing?.cardio?.minutes ?? 0) + m || null })
    setNote(`Logged ${dist ? `${dist} ${units.distance}` : ''}${dist && mins ? ' in ' : ''}${mins ? `${mins} min` : ''}`)
    setDist(null); setMins(null)
  }

  // ---- "do this workout" challenges
  const workoutItems = spec.mode === 'workout' ? (spec.workout?.days.flatMap((d) => d.items) ?? []) : []
  const nameOf = (x: string) => lookup(x)?.name ?? spec.workout?.custom.find((e) => e.id === x)?.name ?? 'Exercise'
  const startFrom = c.acceptedAt ? toISO(new Date(c.acceptedAt)) : today
  const didIds = new Set(logs.filter((l) => l.date >= startFrom && l.date <= today).map((l) => l.exerciseId))

  return (
    <Sheet title="Challenge" onClose={onClose}>
      <div className="mb-3 flex items-center gap-3">
        <Avatar profile={other} />
        <div className="min-w-0">
          <p className="font-medium">{c.emoji} {c.title}</p>
          <p className="text-xs text-neutral-400">{c.mine ? `You challenged ${other.displayName}` : `From ${other.displayName}`}{daysLeft !== null && c.status === 'active' ? ` · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : ''}</p>
        </div>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}

      {(c.status === 'active' || c.status === 'completed') && (
        <div className="mb-4 rounded-2xl bg-neutral-50 p-3">
          <div className="h-2 overflow-hidden rounded-full bg-neutral-200"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} /></div>
          <p className="mt-2 text-sm">{live.done ? '🎉 Done!' : `${formatAmount(c, live.progress, units)} of ${formatAmount(c, c.target, units)}`}<span className="text-neutral-400">{c.mine ? ` · ${other.displayName}’s progress` : ''}</span></p>
        </div>
      )}
      {spec.senderResults && spec.senderResults.length > 0 && <p className="mb-4 text-sm text-neutral-500">To beat: {spec.senderResults.join(' · ')}</p>}

      {c.status === 'pending' && !c.mine && (
        <div className="mb-2 flex gap-2">
          <button onClick={() => respond(true)} className={primary}>Accept</button>
          <button onClick={() => respond(false)} className={secondary}>Decline</button>
        </div>
      )}
      {c.status === 'pending' && c.mine && <p className="text-sm text-neutral-500">Waiting for {other.displayName} to accept.</p>}

      {canLog && spec.mode !== 'workout' && !isCardio && ex && (
        <div>
          <p className={label}>Log what you did · {fmtLong(today)}</p>
          <div className="mb-3 flex items-end gap-2">
            {spec.metric === 'weight' && <label className="w-28 text-xs text-neutral-500">Weight ({units.weight})<NumberInput value={weight} step={2.5} onChange={setWeight} /></label>}
            {(spec.metric === 'reps' || spec.metric === 'weight') && <label className="w-28 text-xs text-neutral-500">Reps<NumberInput value={reps} onChange={setReps} /></label>}
            {spec.metric === 'seconds' && <label className="w-28 text-xs text-neutral-500">Seconds held<NumberInput value={secs} step={5} onChange={setSecs} /></label>}
            <button onClick={logStrength} disabled={spec.metric === 'reps' ? !reps : spec.metric === 'seconds' ? !secs : !weight || !reps} className="rounded-xl bg-accent px-4 py-2.5 text-sm text-on-accent disabled:opacity-30">Add</button>
          </div>
          <p className="mb-1 text-xs text-neutral-400">Adds a set of {ex.name} to today’s log, so it shows in your history too.</p>
        </div>
      )}

      {canLog && spec.mode !== 'workout' && isCardio && (
        <div>
          <p className={label}>Log what you did · {fmtLong(today)}</p>
          {!ex && (
            <div className="mb-3 flex gap-2">
              {(spec.sport === 'bike' ? ['cycling'] as const : spec.sport === 'run' ? ['running'] as const : ['running', 'cycling'] as const).map((s) => (
                <button key={s} onClick={() => setSport(s)} className={`rounded-full px-3 py-1.5 text-sm ${(spec.sport === 'bike' ? 'cycling' : spec.sport === 'run' ? 'running' : sport) === s ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`}>{s === 'running' ? 'Run' : 'Ride'}</button>
              ))}
            </div>
          )}
          <div className="mb-3 flex items-end gap-2">
            <label className="w-28 text-xs text-neutral-500">Distance ({units.distance})<NumberInput value={dist} step={0.1} onChange={setDist} /></label>
            <label className="w-28 text-xs text-neutral-500">Minutes<NumberInput value={mins} step={5} onChange={setMins} /></label>
            <button onClick={logCardio} disabled={spec.metric === 'distance' ? !dist : !mins} className="rounded-xl bg-accent px-4 py-2.5 text-sm text-on-accent disabled:opacity-30">Add</button>
          </div>
          <p className="mb-1 text-xs text-neutral-400">Added to today’s {exerciseId === 'cycling' ? 'ride' : 'run'} log.</p>
        </div>
      )}

      {spec.mode === 'workout' && workoutItems.length > 0 && (
        <div className="mb-3">
          <p className={label}>The workout</p>
          <ul className="mb-3 divide-y divide-neutral-100">
            {workoutItems.map((it) => (
              <li key={it.exerciseId} className="flex items-center justify-between py-2 text-sm">
                <span>{nameOf(it.exerciseId)}</span>
                <span className={didIds.has(it.exerciseId) ? 'text-green-600' : 'text-neutral-300'}>{didIds.has(it.exerciseId) ? '✓ done' : '○'}</span>
              </li>
            ))}
          </ul>
          {canLog && (
            <>
              <button onClick={() => { addCustomExercises(spec.workout?.custom.map((e) => cleanExercise({ id: e.id, name: e.name, kind: e.kind, mode: e.mode })).filter((e): e is Exercise => !!e) ?? []); addPlanned(today, workoutItems); setNote('Added to today’s plan') }} className={secondary}>Add to today’s plan</button>
              <button onClick={() => onNavigate('plan')} className={`${primary} mt-2`}>Open Plan to log it</button>
            </>
          )}
        </div>
      )}

      {note && <p role="status" className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{note}</p>}
      {live.done && c.status === 'active' && !c.mine && <p className="mt-3 text-sm text-neutral-500">Nice work. {other.displayName} will see it’s done the next time they open the app.</p>}
    </Sheet>
  )
}
