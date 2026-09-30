import { useState } from 'react'
import { WOD_KINDS, buildWodItems, makeTabata, wodTitle, type WodMove } from '../lib/wod'
import { findExercise, useStore } from '../store'
import type { Exercise, Wod, WodKind } from '../types'
import { ExercisePicker } from './ExercisePicker'
import { NumberInput } from './NumberInput'
import { Sheet } from './Sheet'

const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`
const h3 = 'mb-2 text-sm font-semibold text-neutral-700'

/** Build your own AMRAP, EMOM or for-time workout and add it to a day. */
export function WodBuilderSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const { custom, addPlanned } = useStore()
  const [kind, setKind] = useState<WodKind>('amrap')
  const [minutes, setMinutes] = useState<number | null>(12)
  const [interval, setInterval] = useState(1)
  const [rounds, setRounds] = useState<number | null>(5)
  const [work, setWork] = useState<number | null>(20)
  const [rest, setRest] = useState<number | null>(10)
  const [tRounds, setTRounds] = useState<number | null>(8)
  const [moves, setMoves] = useState<(WodMove & { ex: Exercise })[]>([])
  const [picking, setPicking] = useState(false)
  const [blockId] = useState(() => `wod-${Date.now().toString(36)}`)

  const mins = minutes && minutes > 0 ? Math.round(minutes) : 0
  const emomTotal = kind === 'emom' && mins ? Math.max(interval, Math.round(mins / interval) * interval) : mins
  const wod: Wod = kind === 'tabata'
    ? makeTabata(Math.max(1, moves.length), { work: work && work > 0 ? Math.round(work) : 20, rest: rest != null && rest >= 0 ? Math.round(rest) : 10, rounds: tRounds && tRounds > 0 ? Math.round(tRounds) : 8 })
    : { kind, minutes: kind === 'emom' ? emomTotal : mins, ...(kind === 'emom' ? { interval } : {}), ...(kind === 'fortime' ? { rounds: rounds && rounds > 0 ? Math.round(rounds) : 1 } : {}) }
  const valid = (kind === 'tabata' || mins > 0) && moves.length >= (kind === 'tabata' ? 1 : 1)
  const set = (id: string, patch: Partial<WodMove>) => setMoves((l) => l.map((m) => (m.exerciseId === id ? { ...m, ...patch } : m)))

  const add = () => {
    const items = buildWodItems({ wod, moves: moves.map(({ ex: _ex, ...m }) => (void _ex, m)), block: blockId })
    addPlanned(date, items)
    onClose()
  }

  return (
    <>
      <Sheet title="Build a timed workout" onClose={onClose} closeLabel="Cancel">
        <div className="mb-1 flex flex-wrap gap-2">
          {WOD_KINDS.map((k) => <button key={k.id} onClick={() => setKind(k.id)} className={chip(kind === k.id)}>{k.label}</button>)}
        </div>
        <p className="mb-4 text-xs text-neutral-400">{WOD_KINDS.find((k) => k.id === kind)!.blurb}</p>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          {kind !== 'tabata' && <label className="w-24 text-xs text-neutral-500">{kind === 'fortime' ? 'Time cap (min)' : 'Minutes'}<NumberInput value={minutes} onChange={setMinutes} /></label>}
          {kind === 'tabata' && (
            <>
              <label className="w-20 text-xs text-neutral-500">Work (sec)<NumberInput value={work} onChange={setWork} /></label>
              <label className="w-20 text-xs text-neutral-500">Rest (sec)<NumberInput value={rest} onChange={setRest} /></label>
              <label className="w-20 text-xs text-neutral-500">Rounds<NumberInput value={tRounds} onChange={setTRounds} /></label>
            </>
          )}
          {kind === 'fortime' && <label className="w-24 text-xs text-neutral-500">Rounds<NumberInput value={rounds} onChange={setRounds} /></label>}
          {kind === 'emom' && (
            <div className="text-xs text-neutral-500">Every
              <div className="mt-1 flex gap-1.5">{[1, 2, 3].map((n) => <button key={n} onClick={() => setInterval(n)} className={chip(interval === n)}>{n} min</button>)}</div>
            </div>
          )}
        </div>

        <h3 className={h3}>Movements{kind === 'emom' ? ' (one per interval, in order)' : kind === 'tabata' ? ' (each gets its own Tabata)' : ' (one round)'}</h3>
        {moves.length === 0 ? <p className="mb-3 text-sm text-neutral-400">Add two or more movements.</p> : (
          <ul className="mb-3 divide-y divide-neutral-100">
            {moves.map((m) => {
              const timed = m.ex.kind === 'strength' && m.ex.mode === 'time'
              const cardio = m.ex.kind === 'cardio'
              return (
                <li key={m.exerciseId} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 line-clamp-2 text-sm">{m.ex.name}</span>
                  {cardio ? (
                    <input value={m.note ?? ''} onChange={(e) => set(m.exerciseId, { note: e.target.value })} placeholder="250 m" aria-label="Distance or time" className="w-20 rounded-lg bg-neutral-100 px-2 py-1.5 text-center text-sm outline-none" />
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-neutral-400">
                      <span className="w-16"><NumberInput value={timed ? m.seconds ?? null : m.reps ?? null} onChange={(v) => set(m.exerciseId, timed ? { seconds: v ?? undefined } : { reps: v ?? undefined })} /></span>
                      {timed ? 'sec' : 'reps'}
                    </span>
                  )}
                  <button aria-label={`Remove ${m.ex.name}`} onClick={() => setMoves((l) => l.filter((x) => x.exerciseId !== m.exerciseId))} className="px-1 text-neutral-400">✕</button>
                </li>
              )
            })}
          </ul>
        )}
        <button onClick={() => setPicking(true)} className="mb-3 w-full rounded-xl bg-neutral-100 py-2.5 text-sm font-medium text-neutral-700">+ Add movement</button>

        {valid && <p className="mb-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-600">{wodTitle(wod)} · {moves.length} movement{moves.length === 1 ? '' : 's'}{kind === 'tabata' ? ` · about ${wod.minutes} min` : ''}</p>}
        <button disabled={!valid} onClick={add} className="w-full rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent disabled:opacity-30">Add to this day</button>
      </Sheet>
      {picking && (
        <ExercisePicker
          taken={new Set(moves.map((m) => m.exerciseId))}
          onPick={(e) => { setMoves((l) => [...l, { exerciseId: e.id, ex: findExercise(custom, e.id) ?? e, ...(e.kind === 'strength' ? (e.mode === 'time' ? { seconds: 30 } : { reps: 10 }) : {}) }]); setPicking(false) }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}
