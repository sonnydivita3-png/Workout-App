import type { Exercise, ExerciseLog, PlannedExercise, TimedLog, Wod, WodKind } from '../types'
import { formatSeconds } from './units'

export const WOD_KINDS: { id: WodKind; label: string; blurb: string }[] = [
  { id: 'amrap', label: 'AMRAP', blurb: 'As many rounds as possible in a set time.' },
  { id: 'emom', label: 'EMOM', blurb: 'Every minute on the minute: do the work, rest for what’s left of the minute.' },
  { id: 'fortime', label: 'For time', blurb: 'Finish a set number of rounds as fast as you can (with a time cap).' },
  { id: 'tabata', label: 'Tabata', blurb: 'Short bursts: 20 seconds all-out, 10 seconds rest, repeated 8 times per movement.' },
]

export const emomIntervals = (w: Wod) => Math.max(1, Math.round(w.minutes / (w.interval ?? 1)))

/** Tabata numbers with the classic defaults filled in. */
export const tabataOf = (w: Wod, movements = 1) => {
  const work = w.work ?? 20
  const rest = w.rest ?? 10
  const rounds = w.rounds ?? 8
  const gap = w.gap ?? 60
  const intervals = w.intervals ?? movements * rounds
  const n = Math.max(1, Math.round(intervals / rounds))
  const block = rounds * (work + rest)
  return { work, rest, rounds, gap, intervals, n, block, total: n * block + (n - 1) * gap }
}

/** A Tabata definition for `n` movements, with its total minutes worked out. */
export function makeTabata(n: number, opts: { work?: number; rest?: number; rounds?: number; gap?: number } = {}): Wod {
  const base: Wod = { kind: 'tabata', minutes: 1, work: opts.work ?? 20, rest: opts.rest ?? 10, rounds: opts.rounds ?? 8, gap: opts.gap ?? 60, intervals: n * (opts.rounds ?? 8) }
  return { ...base, minutes: Math.max(1, Math.ceil(tabataOf(base, n).total / 60)) }
}

export function wodTitle(w: Wod): string {
  if (w.kind === 'amrap') return `AMRAP ${w.minutes} min`
  if (w.kind === 'emom') return `${(w.interval ?? 1) > 1 ? `E${w.interval}MOM` : 'EMOM'} ${w.minutes} min`
  if (w.kind === 'tabata') return `Tabata ${w.work ?? 20}s/${w.rest ?? 10}s × ${w.rounds ?? 8}`
  return `${w.rounds ?? 1} round${(w.rounds ?? 1) === 1 ? '' : 's'} for time · ${w.minutes} min cap`
}

/** The timed format of the block starting at `items[0]`, if it is one. */
export const wodOf = (items: PlannedExercise[]): Wod | undefined => items.find((i) => i.wod)?.wod

/** A timed block's identity, so "last time" can find the same workout again. */
export const wodSignature = (kind: WodKind, ids: string[]) => `${kind}:${[...ids].sort().join(',')}`

export interface WodMove {
  exerciseId: string
  reps?: number
  seconds?: number
  note?: string
}

/** Planned items for a timed block. */
export function buildWodItems(p: { wod: Wod; moves: WodMove[]; block: string; label?: string }): PlannedExercise[] {
  const per = Math.round((p.wod.minutes / Math.max(1, p.moves.length)) * 10) / 10
  const label = p.label ?? wodTitle(p.wod)
  return p.moves.map((m, i) => ({
    exerciseId: m.exerciseId,
    sets: p.wod.kind === 'tabata' ? 1 : p.wod.rounds ?? 1,
    ...(m.reps ? { reps: m.reps } : {}),
    ...(m.seconds ? { seconds: m.seconds } : {}),
    ...(m.note || p.wod.kind === 'emom' ? { note: [m.note, p.wod.kind === 'emom' ? `${(p.wod.interval ?? 1) > 1 ? 'interval' : 'minute'} ${i + 1} of ${p.moves.length}` : undefined].filter(Boolean).join(' · ') } : {}),
    est: per,
    block: p.block,
    blockLabel: label,
    wod: p.wod,
  }))
}

/** A short line for a logged result, e.g. "7 rounds + 5 reps", "11 of 12 intervals", "14:32". */
export function formatResult(t: Pick<TimedLog, 'wod' | 'rounds' | 'reps' | 'intervals' | 'seconds' | 'capped'>): string {
  if (t.wod.kind === 'amrap') return `${t.rounds ?? 0} round${t.rounds === 1 ? '' : 's'}${t.reps ? ` + ${t.reps} reps` : ''}`
  if (t.wod.kind === 'emom') return `${t.intervals ?? 0} of ${emomIntervals(t.wod)} intervals`
  if (t.wod.kind === 'tabata') return `${t.intervals ?? 0} of ${t.wod.intervals ?? 0} intervals${t.reps ? ` · ${t.reps} reps` : ''}`
  if (t.capped) return `Time cap · ${t.rounds ?? 0} of ${t.wod.rounds ?? 1} rounds`
  return t.seconds != null ? formatSeconds(t.seconds) : '—'
}

/**
 * What a timed result means for each movement's own log, so history, streaks and "done today" count it.
 * AMRAP/for time: each movement done once per completed round (extra reps go on the first movement).
 * EMOM: movements take turns each interval.
 */
export function derivedLogs(t: TimedLog, items: PlannedExercise[], lookup: (id: string) => Exercise | undefined): ExerciseLog[] {
  const n = items.length || 1
  const rounds = (i: number) => {
    if (t.wod.kind === 'tabata') return Math.max(0, Math.min(t.wod.rounds ?? 8, (t.intervals ?? 0) - i * (t.wod.rounds ?? 8)))
    if (t.wod.kind === 'emom') {
      const done = t.intervals ?? 0
      return Math.floor(done / n) + (i < done % n ? 1 : 0)
    }
    if (t.wod.kind === 'fortime') return t.capped ? t.rounds ?? 0 : t.wod.rounds ?? 1
    return t.rounds ?? 0
  }
  const out: ExerciseLog[] = []
  items.forEach((p, i) => {
    const ex = lookup(p.exerciseId)
    if (!ex) return
    const r = rounds(i)
    const extra = t.wod.kind === 'amrap' && i === 0 ? t.reps ?? 0 : 0
    if (r + extra <= 0) return
    const workSecs = t.wod.work ?? 20
    const share = t.wod.kind === 'tabata' && t.reps && (t.intervals ?? 0) > 0 ? Math.round((t.reps * r) / (t.intervals ?? 1)) : 0
    if (ex.kind === 'cardio') {
      out.push({ date: t.date, exerciseId: p.exerciseId, cardio: { distance: null, minutes: Math.max(1, Math.round((p.est ?? t.wod.minutes / n) * (r ? 1 : 0))) } })
    } else if (ex.mode === 'time') {
      out.push({ date: t.date, exerciseId: p.exerciseId, sets: [{ weight: null, reps: null, seconds: (t.wod.kind === 'tabata' ? workSecs : p.seconds ?? 30) * r }] })
    } else {
      out.push({ date: t.date, exerciseId: p.exerciseId, sets: [{ weight: null, reps: (p.reps ? p.reps * r : share || r) + extra }] })
    }
  })
  return out
}

export interface Segment {
  phase: 'work' | 'rest'
  seconds: number
  /** What to do or what's next, e.g. "Burpees" or "Next: Squats". */
  label: string
  detail?: string
}

/** Work/rest timing for a HIIT circuit block, read back from how the randomizer describes it. */
export function parseCircuit(label: string | undefined, items: PlannedExercise[]): { rounds: number; work: number; rest: number; roundRest: number } | null {
  if (!label?.startsWith('HIIT circuit') || items.length === 0) return null
  const t = /(\d+)s on \/ (\d+)s off/.exec(items[0].note ?? '') ?? /(\d+)s on \/ (\d+)s off/.exec(label)
  if (!t) return null
  const rr = /(\d+(?:\.\d+)?) min rest/.exec(label)
  return { rounds: Math.max(1, items[0].sets), work: Number(t[1]), rest: Number(t[2]), roundRest: rr ? Math.round(Number(rr[1]) * 60) : 0 }
}

/** The whole circuit as a list of timed segments: work and rest per movement, a longer break between rounds. */
export function circuitSegments(names: string[], c: { rounds: number; work: number; rest: number; roundRest: number }): Segment[] {
  const out: Segment[] = []
  for (let r = 0; r < c.rounds; r++) {
    names.forEach((name, i) => {
      out.push({ phase: 'work', seconds: c.work, label: name, detail: `Round ${r + 1} of ${c.rounds} · move ${i + 1} of ${names.length}` })
      const lastMove = i === names.length - 1
      const lastRound = r === c.rounds - 1
      if (lastMove && lastRound) return
      if (lastMove) out.push({ phase: 'rest', seconds: c.roundRest || c.rest, label: 'Round break', detail: `Next: ${names[0]}` })
      else if (c.rest > 0) out.push({ phase: 'rest', seconds: c.rest, label: 'Rest', detail: `Next: ${names[i + 1]}` })
    })
  }
  return out
}
