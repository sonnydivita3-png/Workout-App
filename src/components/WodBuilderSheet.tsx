import { useState } from 'react'
import { WOD_KINDS, buildCircuitItems, buildWodItems, circuitSeconds, makeTabata, wodTitle, type CircuitTiming, type WodMove } from '../lib/wod'
import { findExercise, useStore } from '../store'
import type { Exercise, Wod, WodKind } from '../types'
import { ExercisePicker } from './ExercisePicker'
import { NumberInput } from './NumberInput'
import { Sheet } from './Sheet'

const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`
const h3 = 'mb-2 text-sm font-semibold text-neutral-700'

type Kind = WodKind | 'circuit'
const KINDS: { id: Kind; label: string; blurb: string }[] = [
  { id: 'circuit', label: 'Circuit', blurb: 'Each move for a set time, one after another (like 30 seconds each of curls, lunges and skater hops), with a short rest between. Repeat for a few rounds.' },
  ...WOD_KINDS,
]

/** Build your own circuit, AMRAP, EMOM, for-time or Tabata workout and add it to a day. */
export function WodBuilderSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const { custom, addPlanned } = useStore()
  const [kind, setKind] = useState<Kind>('circuit')
  // Circuit: seconds of work and rest for each move, rounds, and the rest between rounds.
  const [cWork, setCWork] = useState<number | null>(30)
  const [cRest, setCRest] = useState<number | null>(15)
  const [cRounds, setCRounds] = useState<number | null>(3)
  const [cRoundRest, setCRoundRest] = useState<number | null>(60)
  const [minutes, setMinutes] = useState<number | null>(12)
  const [interval, setInterval] = useState(1)
  const [rounds, setRounds] = useState<number | null>(5)
  const [work, setWork] = useState<number | null>(20)
  const [rest, setRest] = useState<number | null>(10)
  const [tRounds, setTRounds] = useState<number | null>(8)
  const [moves, setMoves] = useState<(WodMove & { ex: Exercise })[]>([])
  const [picking, setPicking] = useState(false)
  const [stamp] = useState(() => Date.now().toString(36))

  const circuit = kind === 'circuit'
  const timing: CircuitTiming = { work: Math.round(cWork ?? 0), rest: Math.max(0, Math.round(cRest ?? 0)), rounds: Math.round(cRounds ?? 0), roundRest: Math.max(0, Math.round(cRoundRest ?? 0)) }
  const mins = minutes && minutes > 0 ? Math.round(minutes) : 0
  const emomTotal = kind === 'emom' && mins ? Math.max(interval, Math.round(mins / interval) * interval) : mins
  const wod: Wod | null = kind === 'circuit' ? null : kind === 'tabata'
    ? makeTabata(Math.max(1, moves.length), { work: work && work > 0 ? Math.round(work) : 20, rest: rest != null && rest >= 0 ? Math.round(rest) : 10, rounds: tRounds && tRounds > 0 ? Math.round(tRounds) : 8 })
    : { kind, minutes: kind === 'emom' ? emomTotal : mins, ...(kind === 'emom' ? { interval } : {}), ...(kind === 'fortime' ? { rounds: rounds && rounds > 0 ? Math.round(rounds) : 1 } : {}) }
  const valid = moves.length >= 1 && (circuit ? timing.work > 0 && timing.rounds > 0 : kind === 'tabata' || mins > 0)
  const set = (id: string, patch: Partial<WodMove>) => setMoves((l) => l.map((m) => (m.exerciseId === id ? { ...m, ...patch } : m)))

  const add = () => {
    const items = wod
      ? buildWodItems({ wod, moves: moves.map(({ ex: _ex, ...m }) => (void _ex, m)), block: `wod-${stamp}` })
      : buildCircuitItems({ ...timing, moves: moves.map((m) => ({ exerciseId: m.exerciseId, timed: m.ex.kind === 'strength' && m.ex.mode === 'time', note: m.note })), block: `circuit-${stamp}` })
    addPlanned(date, items)
    onClose()
  }

  return (
    <>
      <Sheet title="Build a timed workout" onClose={onClose} closeLabel="Cancel">
        <div className="mb-1 flex flex-wrap gap-2">
          {KINDS.map((k) => <button key={k.id} onClick={() => setKind(k.id)} aria-pressed={kind === k.id} className={chip(kind === k.id)}>{k.label}</button>)}
        </div>
        <p className="mb-4 text-xs text-neutral-400">{KINDS.find((k) => k.id === kind)!.blurb}</p>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          {circuit && (
            <>
              <label className="w-20 text-xs text-neutral-500">Work (sec)<NumberInput value={cWork} step={5} onChange={setCWork} /></label>
              <label className="w-20 text-xs text-neutral-500">Rest (sec)<NumberInput value={cRest} step={5} onChange={setCRest} /></label>
              <label className="w-20 text-xs text-neutral-500">Rounds<NumberInput value={cRounds} onChange={setCRounds} /></label>
              <label className="w-28 text-xs text-neutral-500">Between rounds (sec)<NumberInput value={cRoundRest} step={15} onChange={setCRoundRest} /></label>
            </>
          )}
          {kind !== 'tabata' && !circuit && <label className="w-24 text-xs text-neutral-500">{kind === 'fortime' ? 'Time cap (min)' : 'Minutes'}<NumberInput value={minutes} onChange={setMinutes} /></label>}
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

        <h3 className={h3}>Movements{circuit ? ' (in order, each for the work time)' : kind === 'emom' ? ' (one per interval, in order)' : kind === 'tabata' ? ' (each gets its own Tabata)' : ' (one round)'}</h3>
        {moves.length === 0 ? <p className="mb-3 text-sm text-neutral-400">Add two or more movements.</p> : (
          <ul className="mb-3 divide-y divide-neutral-100">
            {moves.map((m) => {
              const timed = m.ex.kind === 'strength' && m.ex.mode === 'time'
              const cardio = m.ex.kind === 'cardio'
              return (
                <li key={m.exerciseId} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 line-clamp-2 text-sm">{m.ex.name}</span>
                  {circuit && !cardio ? (
                    <span className="text-xs text-neutral-400">{timing.work}s</span>
                  ) : cardio ? (
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

        {valid && (
          <p className="mb-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            {wod
              ? `${wodTitle(wod)} · ${moves.length} movement${moves.length === 1 ? '' : 's'}${kind === 'tabata' ? ` · about ${wod.minutes} min` : ''}`
              : `${timing.rounds} round${timing.rounds === 1 ? '' : 's'} of ${moves.length} move${moves.length === 1 ? '' : 's'} · ${timing.work}s on / ${timing.rest}s off · about ${Math.max(1, Math.round(circuitSeconds(moves.length, timing) / 60))} min`}
          </p>
        )}
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
