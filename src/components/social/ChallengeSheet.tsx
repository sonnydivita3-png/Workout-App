import { useMemo, useState } from 'react'
import { BUILTIN_BY_ID } from '../../data/exercises'
import { fmtLong, parseISO, toISO, addDays } from '../../lib/dates'
import { hasData } from '../../lib/stats'
import { formatSeconds, storeDistance } from '../../lib/units'
import { useToday } from '../../lib/useToday'
import { completedWorkout } from '../../social/share'
import { useSocial } from '../../social/store'
import { EMOJI, type ChallengeSpec, type Metric } from '../../social/types'
import { findExercise, useStore } from '../../store'
import type { Exercise } from '../../types'
import { ExercisePicker } from '../ExercisePicker'
import { NumberInput } from '../NumberInput'
import { Sheet } from '../Sheet'
import { chip, label, primary } from './styles'
import { Avatar, ErrorNote } from './ui'

interface Preset {
  id: string
  label: string
  exerciseId?: string
  metric: Metric
  sport?: 'run' | 'bike' | 'any'
  /** Default targets per mode. */
  defaults: { total?: number; best?: number }
  unit: (u: 'mi' | 'km') => string
}

const PRESETS: Preset[] = [
  { id: 'pushups', label: 'Push-ups', exerciseId: 'Pushups', metric: 'reps', defaults: { total: 100, best: 30 }, unit: () => 'reps' },
  { id: 'pullups', label: 'Pull-ups', exerciseId: 'Pullups', metric: 'reps', defaults: { total: 30, best: 10 }, unit: () => 'reps' },
  { id: 'squats', label: 'Squats', exerciseId: 'Bodyweight_Squat', metric: 'reps', defaults: { total: 200, best: 50 }, unit: () => 'reps' },
  { id: 'plank', label: 'Plank hold', exerciseId: 'Plank', metric: 'seconds', defaults: { best: 120 }, unit: () => 'seconds' },
  { id: 'run', label: 'Run distance', metric: 'distance', sport: 'run', defaults: { total: 10, best: 5 }, unit: (u) => u },
  { id: 'ride', label: 'Ride distance', metric: 'distance', sport: 'bike', defaults: { total: 40, best: 25 }, unit: (u) => u },
  { id: 'minutes', label: 'Cardio minutes', metric: 'minutes', sport: 'any', defaults: { total: 150, best: 45 }, unit: () => 'minutes' },
]

const DURATIONS = [1, 3, 7, 14, 30]

interface Props {
  friendId?: string
  /** Start from a workout you completed on this date. */
  fromDate?: string
  onClose: () => void
}

export function ChallengeSheet({ friendId, fromDate, onClose }: Props) {
  const today = useToday()
  const { logs, custom, units } = useStore()
  const { friends, act } = useSocial()
  const [to, setTo] = useState<string | null>(friendId ?? null)
  const [kind, setKind] = useState<string>(fromDate ? 'workout' : 'pushups') // preset id, 'pick', or 'workout'
  const [mode, setMode] = useState<'total' | 'best'>('total')
  const [target, setTarget] = useState<number | null>(null)
  const [days, setDays] = useState(7)
  const [emoji, setEmoji] = useState<string | undefined>('💪')
  const [picked, setPicked] = useState<Exercise | null>(null)
  const [pickedMetric, setPickedMetric] = useState<'distance' | 'minutes'>('distance')
  const [picking, setPicking] = useState(false)
  const [workoutDate, setWorkoutDate] = useState<string | null>(fromDate ?? null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const lookup = (id: string) => findExercise(custom, id) ?? BUILTIN_BY_ID.get(id)
  const preset = PRESETS.find((p) => p.id === kind)

  // Recent days with a real workout logged, for "copy a workout I did".
  const doneDays = useMemo(() => {
    const dates = new Set<string>()
    for (const l of logs) if (hasData(l) && l.date <= today && l.date >= toISO(addDays(parseISO(today), -21))) dates.add(l.date)
    return [...dates].sort().reverse()
  }, [logs, today])
  const workout = useMemo(() => (workoutDate ? completedWorkout(workoutDate, logs, (id) => findExercise(custom, id) ?? BUILTIN_BY_ID.get(id), custom) : null), [workoutDate, logs, custom])

  const modes: ('total' | 'best')[] = kind === 'pick' ? (picked?.mode === 'weight' || (picked && !picked.mode && picked.kind !== 'cardio') ? [] : ['total', 'best']) : preset?.defaults.total !== undefined ? ['total', 'best'] : []
  const effectiveMode = modes.length ? mode : 'best'
  const shownTarget = target ?? (preset ? preset.defaults[effectiveMode] ?? preset.defaults.total ?? preset.defaults.best : null)

  const amount = target ?? shownTarget

  // Work out the challenge from the choices.
  const spec = ((): { spec: ChallengeSpec; target: number; title: string } | null => {
    const d = `${days} day${days === 1 ? '' : 's'}`
    if (kind === 'workout') {
      if (!workout) return null
      const first = lookup(workout.days[0].items[0].exerciseId)?.name ?? 'workout'
      return { spec: { metric: 'exercises', mode: 'workout', workout, senderResults: workout.results }, target: workout.days[0].items.length, title: `Do my workout: ${first}${workout.days[0].items.length > 1 ? ' & more' : ''}` }
    }
    if (kind === 'pick') {
      if (!picked || !amount) return null
      if (picked.kind === 'cardio') {
        const t = pickedMetric === 'distance' ? storeDistance(amount, units)! : amount
        return { spec: { metric: pickedMetric, mode, exercise: { id: picked.id, name: picked.name, kind: 'cardio', ...(picked.custom ? { custom: picked } : {}) } }, target: t, title: `${picked.name} ${amount} ${pickedMetric === 'distance' ? units.distance : 'min'} in ${d}` }
      }
      const m: Metric = picked.mode === 'time' ? 'seconds' : picked.mode === 'reps' ? 'reps' : 'weight'
      const t = m === 'weight' ? amount / (units.weight === 'kg' ? 1 / 2.20462262 : 1) : amount
      return { spec: { metric: m, mode: m === 'weight' ? 'best' : mode, exercise: { id: picked.id, name: picked.name, kind: 'strength', mode: picked.mode ?? 'weight', ...(picked.custom ? { custom: picked } : {}) } }, target: t, title: `${picked.name}: ${m === 'seconds' ? formatSeconds(amount) : amount}${m === 'weight' ? ' ' + units.weight : m === 'reps' ? ' reps' : ''} in ${d}` }
    }
    if (!preset || !amount) return null
    const t = preset.metric === 'distance' ? storeDistance(amount, units)! : amount
    const spec: ChallengeSpec = {
      metric: preset.metric, mode: preset.defaults.total === undefined ? 'best' : mode, ...(preset.sport ? { sport: preset.sport } : {}),
      ...(preset.exerciseId ? { exercise: { id: preset.exerciseId, name: BUILTIN_BY_ID.get(preset.exerciseId)!.name, kind: 'strength' as const, mode: BUILTIN_BY_ID.get(preset.exerciseId)!.mode } } : {}),
    }
    const verb = spec.mode === 'best' ? (preset.metric === 'reps' ? 'in one set' : 'in one go') : 'total'
    return { spec, target: t, title: `${preset.label}: ${amount} ${preset.unit(units.distance)} ${verb} in ${d}` }
  })()

  const chosen = friends.find((f) => f.profile.id === to)
  const ready = !!chosen && chosen.theyGrant.challenges && !!spec
  const unitLabel = kind === 'pick' ? (picked?.kind === 'cardio' ? (pickedMetric === 'distance' ? units.distance : 'min') : picked?.mode === 'time' ? 'seconds' : picked?.mode === 'reps' ? 'reps' : units.weight) : preset?.unit(units.distance) ?? ''

  const send = async () => {
    if (!chosen || !spec) return
    setBusy(true); setError(null)
    const r = await act((b) => b.sendChallenge({ toId: chosen.profile.id, title: spec.title.slice(0, 80), emoji, spec: spec.spec, target: spec.target, days }))
    setBusy(false)
    if (r.ok) setSent(true); else setError(r.error)
  }

  if (sent) {
    return (
      <Sheet title="Challenge sent" onClose={onClose} closeLabel="Done">
        <p className="py-6 text-center text-neutral-600">{emoji} {chosen?.profile.displayName} can accept “{spec?.title}”.</p>
        <button onClick={onClose} className={primary}>Done</button>
      </Sheet>
    )
  }

  return (
    <>
      <Sheet title="Challenge a friend" onClose={onClose} closeLabel="Cancel">
        <p className={label}>Challenge</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => <button key={p.id} onClick={() => { setKind(p.id); setTarget(null); setMode(p.defaults.total !== undefined ? 'total' : 'best') }} className={chip(kind === p.id)}>{p.label}</button>)}
          <button onClick={() => { setKind('pick'); setTarget(null); if (!picked) setPicking(true) }} className={chip(kind === 'pick')}>Any exercise…</button>
          {doneDays.length > 0 && <button onClick={() => { setKind('workout'); setWorkoutDate(workoutDate ?? doneDays[0]) }} className={chip(kind === 'workout')}>A workout I did</button>}
        </div>

        {kind === 'pick' && (
          <div className="mb-4">
            <button onClick={() => setPicking(true)} className="mb-2 flex w-full items-center justify-between rounded-xl bg-neutral-100 px-4 py-2.5 text-left">
              <span className={picked ? '' : 'text-neutral-400'}>{picked?.name ?? 'Choose an exercise'}</span><span className="text-neutral-300">›</span>
            </button>
            {picked?.kind === 'cardio' && (
              <div className="flex gap-2">
                {(['distance', 'minutes'] as const).map((m) => <button key={m} onClick={() => setPickedMetric(m)} className={chip(pickedMetric === m)}>{m === 'distance' ? 'Distance' : 'Time'}</button>)}
              </div>
            )}
          </div>
        )}

        {kind === 'workout' && (
          <div className="mb-4">
            <p className={label}>Which workout</p>
            <div className="flex flex-wrap gap-2">
              {doneDays.slice(0, 8).map((d) => <button key={d} onClick={() => setWorkoutDate(d)} className={chip(workoutDate === d)}>{fmtLong(d)}</button>)}
            </div>
            {workout && <p className="mt-2 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-600">{workout.results?.join(' · ')}</p>}
            <p className="mt-2 text-xs text-neutral-400">They’ll be asked to complete the same exercises. Your results are shown so they can beat them.</p>
          </div>
        )}

        {kind !== 'workout' && (
          <>
            {modes.length > 0 && (
              <div className="mb-4 flex gap-2">
                <button onClick={() => { setMode('total'); setTarget(null) }} className={chip(effectiveMode === 'total')}>Add up over the days</button>
                <button onClick={() => { setMode('best'); setTarget(null) }} className={chip(effectiveMode === 'best')}>Best single {kind === 'pick' && picked?.kind !== 'cardio' ? 'set' : 'effort'}</button>
              </div>
            )}
            <label className="mb-4 block text-sm text-neutral-500">
              Target ({unitLabel})
              <div className="mt-1 w-32"><NumberInput value={target ?? shownTarget ?? null} step={1} onChange={setTarget} /></div>
            </label>
          </>
        )}

        <p className={label}>How long to complete it</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {DURATIONS.map((n) => <button key={n} onClick={() => setDays(n)} className={chip(days === n)}>{n === 1 ? '1 day' : `${n} days`}</button>)}
        </div>

        <p className={label}>Challenge who</p>
        <div className="mb-4 space-y-1.5">
          {friends.length === 0 && <p className="text-sm text-neutral-400">You don’t have any friends yet.</p>}
          {friends.filter((f) => !friendId || f.profile.id === friendId).map((f) => {
            const ok = f.theyGrant.challenges
            return (
              <button key={f.profile.id} disabled={!ok} onClick={() => setTo(f.profile.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${to === f.profile.id ? 'bg-accent text-on-accent' : 'bg-neutral-50'} disabled:opacity-50`}>
                <Avatar profile={f.profile} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.profile.displayName}</span>
                {!ok && <span className="text-xs text-neutral-400">hasn’t allowed challenges</span>}
              </button>
            )
          })}
        </div>

        <p className={label}>Add an emoji</p>
        <div className="mb-5 flex flex-wrap gap-1.5">
          {EMOJI.map((e) => <button key={e} onClick={() => setEmoji(emoji === e ? undefined : e)} className={`h-9 w-9 rounded-full text-lg ${emoji === e ? 'bg-accent' : 'bg-neutral-100'}`}>{e}</button>)}
        </div>

        {spec && <p className="mb-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm">{emoji} {spec.title}</p>}
        {error && <ErrorNote>{error}</ErrorNote>}
        <button disabled={!ready || busy} onClick={send} className={primary}>{busy ? 'Sending…' : 'Send challenge'}</button>
        <p className="mt-2 text-center text-xs text-neutral-400">They can accept or decline. If they accept, you’ll see their progress on this challenge.</p>
      </Sheet>
      {picking && <ExercisePicker taken={new Set()} onPick={(e) => { setPicked(e); setPicking(false); setTarget(null) }} onClose={() => setPicking(false)} />}
    </>
  )
}
