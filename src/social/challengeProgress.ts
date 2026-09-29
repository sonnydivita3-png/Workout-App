import type { Exercise, ExerciseLog, Units } from '../types'
import { showDistance, showWeight } from '../lib/units'
import { hasData } from '../lib/stats'
import { cardioSessions, matchesSport } from '../lib/cardio'
import type { Challenge, ChallengeSpec } from './types'

type Lookup = (id: string) => Exercise | undefined

const localDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * How far along a challenge is, computed from your own log for the days since you accepted it.
 * Units: reps, seconds, pounds (weight), miles (distance), minutes, or exercises completed.
 */
export function challengeProgress(
  c: Pick<Challenge, 'spec' | 'target' | 'acceptedAt' | 'endsAt'>,
  logs: ExerciseLog[],
  today: string,
  lookup: Lookup,
): { progress: number; done: boolean } {
  if (!c.acceptedAt) return { progress: 0, done: false }
  const from = localDate(c.acceptedAt)
  const until = c.endsAt && localDate(c.endsAt) < today ? localDate(c.endsAt) : today
  const window = logs.filter((l) => l.date >= from && l.date <= until && hasData(l))
  const spec: ChallengeSpec = c.spec
  let progress = 0

  if (spec.mode === 'workout') {
    const wanted = new Set((spec.workout?.days.flatMap((d) => d.items.map((i) => i.exerciseId))) ?? [])
    const doneIds = new Set(window.filter((l) => wanted.has(l.exerciseId)).map((l) => l.exerciseId))
    progress = doneIds.size
  } else if (spec.metric === 'distance' || spec.metric === 'minutes') {
    const sessions = cardioSessions(window, lookup).filter((s) => matchesSport(s, spec.sport ?? 'any'))
    const byExercise = spec.exercise ? window.filter((l) => l.exerciseId === spec.exercise!.id && l.cardio) : null
    const values = byExercise
      ? byExercise.map((l) => (spec.metric === 'distance' ? l.cardio!.distance : l.cardio!.minutes) ?? 0)
      : sessions.map((s) => (spec.metric === 'distance' ? s.distance : s.minutes) ?? 0)
    progress = spec.mode === 'best' ? Math.max(0, ...values) : values.reduce((a, v) => a + v, 0)
  } else if (spec.exercise) {
    const value = (s: { weight: number | null; reps: number | null; seconds?: number | null }) =>
      spec.metric === 'reps' ? s.reps ?? 0 : spec.metric === 'seconds' ? s.seconds ?? 0 : s.weight ?? 0
    const values = window.filter((l) => l.exerciseId === spec.exercise!.id).flatMap((l) => (l.sets ?? []).map(value))
    progress = spec.mode === 'best' || spec.metric === 'weight' ? Math.max(0, ...values) : values.reduce((a, v) => a + v, 0)
  }
  progress = Math.round(progress * 100) / 100
  return { progress, done: progress >= c.target }
}

/** A challenge amount for display, in the person's units (stored as pounds and miles). */
export function formatAmount(c: Pick<Challenge, 'spec' | 'target'>, n: number, units: Units): string {
  switch (c.spec.metric) {
    case 'distance': return `${showDistance(n, units)} ${units.distance}`
    case 'weight': return `${showWeight(n, units)} ${units.weight}`
    case 'minutes': return `${Math.round(n)} min`
    case 'seconds': return `${Math.round(n)} sec`
    case 'exercises': return `${Math.round(n)} of ${Math.round(c.target)}`
    default: return `${Math.round(n)}`
  }
}
