import type { Exercise, ExerciseLog, PlannedExercise, TimedLog, Wod, WodKind } from '../types'
import { formatSeconds } from './units'

export const WOD_KINDS: { id: WodKind; label: string; blurb: string }[] = [
  { id: 'amrap', label: 'AMRAP', blurb: 'As many rounds as possible in a set time.' },
  { id: 'emom', label: 'EMOM', blurb: 'Every minute on the minute: do the work, rest for what’s left of the minute.' },
  { id: 'fortime', label: 'For time', blurb: 'Finish a set number of rounds as fast as you can (with a time cap).' },
]

export const emomIntervals = (w: Wod) => Math.max(1, Math.round(w.minutes / (w.interval ?? 1)))

export function wodTitle(w: Wod): string {
  if (w.kind === 'amrap') return `AMRAP ${w.minutes} min`
  if (w.kind === 'emom') return `${(w.interval ?? 1) > 1 ? `E${w.interval}MOM` : 'EMOM'} ${w.minutes} min`
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
    sets: p.wod.rounds ?? 1,
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
    if (ex.kind === 'cardio') {
      out.push({ date: t.date, exerciseId: p.exerciseId, cardio: { distance: null, minutes: Math.max(1, Math.round((p.est ?? t.wod.minutes / n) * (r ? 1 : 0))) } })
    } else if (ex.mode === 'time') {
      out.push({ date: t.date, exerciseId: p.exerciseId, sets: [{ weight: null, reps: null, seconds: (p.seconds ?? 30) * r }] })
    } else {
      out.push({ date: t.date, exerciseId: p.exerciseId, sets: [{ weight: null, reps: (p.reps ?? 1) * r + extra }] })
    }
  })
  return out
}
