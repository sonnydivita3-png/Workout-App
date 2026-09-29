import { useState } from 'react'
import { BUILTIN_BY_ID } from '../../data/exercises'
import { payloadFromDays } from '../../social/share'
import type { Scope, SharedPayload, WorkoutRequest } from '../../social/types'
import { findExercise, useStore } from '../../store'
import type { PlannedExercise } from '../../types'
import { useToday } from '../../lib/useToday'
import { ExercisePicker } from '../ExercisePicker'
import type { GeneratorMode } from '../ModeSwitch'
import { ProgramSheet } from '../ProgramSheet'
import { RandomizerSheet } from '../RandomizerSheet'
import { Sheet } from '../Sheet'
import { ShareSheet } from './ShareSheet'
import { label, primary, secondary } from './styles'
import { Avatar } from './ui'

type Step = 'menu' | 'routine' | 'planned' | 'random' | 'build' | 'send'

const SCOPE_TEXT: Record<Scope, string> = { day: 'a day', week: 'a week', month: '4 weeks' }

/** Answering a "make me a workout" request: pick a saved workout or a planned one, let the randomizer make one, or build it yourself. */
export function MakeForFriendSheet({ request, onClose }: { request: WorkoutRequest; onClose: () => void }) {
  const today = useToday()
  const { routines, custom } = useStore()
  const [step, setStep] = useState<Step>('menu')
  const [mode, setMode] = useState<GeneratorMode>('one')
  const [made, setMade] = useState<{ payload: SharedPayload; title: string } | null>(null)
  const from = request.from

  const finish = (payload: SharedPayload, title: string) => { setMade({ payload, title }); setStep('send') }
  const oneDay = (items: PlannedExercise[], title: string) => finish(payloadFromDays([{ offset: 0, items }], 'day', custom), title)
  const back = () => setStep('menu')

  if (step === 'send' && made) return <ShareSheet date={today} friendId={from.id} requestId={request.id} payloadOverride={made.payload} titleOverride={made.title} onClose={onClose} />
  if (step === 'planned') return <ShareSheet date={today} friendId={from.id} scope={request.scope} requestId={request.id} onClose={onClose} />

  if (step === 'random') {
    return mode === 'program' ? (
      <ProgramSheet
        onClose={back}
        onSwitchMode={setMode}
        onApplied={() => undefined}
        onUse={(days, weeks) => finish(payloadFromDays(days, weeks === 4 ? 'month' : 'week', custom), weeks === 4 ? 'Month of workouts' : 'Week of workouts')}
      />
    ) : (
      <RandomizerSheet date={today} onClose={back} onSwitchMode={setMode} onUse={(items) => oneDay(items, 'Random workout')} />
    )
  }
  if (step === 'build') return <BuildSheet onBack={back} onUse={(items) => oneDay(items, 'Custom workout')} />

  if (step === 'routine') {
    return (
      <Sheet title="Saved workouts" onClose={back} closeLabel="Back">
        {routines.length === 0 ? (
          <p className="py-6 text-center text-neutral-400">You haven’t saved any routines yet. Use the randomizer or a day’s options to save one.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {routines.map((r) => (
              <li key={r.id}>
                <button onClick={() => oneDay(r.items, r.name)} className="flex w-full items-center justify-between py-3 text-left">
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{r.name}</span><span className="block text-xs text-neutral-400">{r.items.length} exercise{r.items.length === 1 ? '' : 's'}</span></span>
                  <span className="text-neutral-300">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    )
  }

  const option = (title: string, hint: string, on: () => void) => (
    <button onClick={on} className="flex w-full items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3 text-left">
      <span><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-neutral-400">{hint}</span></span>
      <span className="text-neutral-300">›</span>
    </button>
  )

  return (
    <Sheet title="Make a workout" onClose={onClose} closeLabel="Cancel">
      <div className="mb-4 flex items-center gap-3">
        <Avatar profile={from} />
        <p className="text-sm text-neutral-600"><b className="font-medium">{from.displayName}</b> asked for {SCOPE_TEXT[request.scope]} of workouts.{request.note ? ` “${request.note}”` : ''}</p>
      </div>
      <p className={label}>How do you want to make it?</p>
      <div className="mb-4 space-y-2">
        {option('A saved workout', `${routines.length} saved routine${routines.length === 1 ? '' : 's'}`, () => setStep('routine'))}
        {option('One I’ve planned', 'Pick a day, week or month from your calendar', () => setStep('planned'))}
        {option('Have the randomizer make one', 'Choose muscles, style and time, then tweak it', () => { setMode('one'); setStep('random') })}
        {option('Build one myself', 'Pick the exercises and sets', () => setStep('build'))}
      </div>
    </Sheet>
  )
}

/** A small builder: pick exercises, set how many sets. */
function BuildSheet({ onBack, onUse }: { onBack: () => void; onUse: (items: PlannedExercise[]) => void }) {
  const custom = useStore((s) => s.custom)
  const [items, setItems] = useState<PlannedExercise[]>([])
  const [picking, setPicking] = useState(false)
  const nameOf = (id: string) => findExercise(custom, id)?.name ?? BUILTIN_BY_ID.get(id)?.name ?? id
  const setSets = (id: string, n: number) => setItems((l) => l.map((p) => (p.exerciseId === id ? { ...p, sets: Math.min(10, Math.max(1, n)) } : p)))

  return (
    <>
      <Sheet title="Build a workout" onClose={onBack} closeLabel="Back">
        {items.length === 0 ? <p className="py-6 text-center text-neutral-400">Add the exercises for your friend.</p> : (
          <ul className="mb-3 divide-y divide-neutral-100">
            {items.map((p) => {
              const cardio = findExercise(custom, p.exerciseId)?.kind === 'cardio'
              return (
                <li key={p.exerciseId} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{nameOf(p.exerciseId)}</span>
                  {!cardio && (
                    <span className="flex items-center gap-1 text-sm">
                      <button aria-label="Fewer sets" onClick={() => setSets(p.exerciseId, p.sets - 1)} className="h-7 w-7 rounded-full bg-neutral-100">−</button>
                      <span className="w-14 text-center tabular-nums">{p.sets} sets</span>
                      <button aria-label="More sets" onClick={() => setSets(p.exerciseId, p.sets + 1)} className="h-7 w-7 rounded-full bg-neutral-100">+</button>
                    </span>
                  )}
                  <button aria-label={`Remove ${nameOf(p.exerciseId)}`} onClick={() => setItems((l) => l.filter((x) => x.exerciseId !== p.exerciseId))} className="px-1 text-neutral-400">✕</button>
                </li>
              )
            })}
          </ul>
        )}
        <button onClick={() => setPicking(true)} className={`${secondary} mb-2`}>+ Add exercise</button>
        <button disabled={items.length === 0} onClick={() => onUse(items)} className={primary}>Use this workout</button>
      </Sheet>
      {picking && (
        <ExercisePicker
          taken={new Set(items.map((p) => p.exerciseId))}
          onPick={(e) => { setItems((l) => [...l, { exerciseId: e.id, sets: e.kind === 'strength' ? 3 : 1 }]); setPicking(false) }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}
