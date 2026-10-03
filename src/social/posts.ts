import { BUILTIN_BY_ID } from '../data/exercises'
import { newCardioBests } from '../lib/cardioBests'
import { isTicked } from '../lib/setRows'
import { hasData } from '../lib/stats'
import { workoutSummary } from '../lib/summary'
import { formatCardioTime, formatDistanceFor, formatSeconds, showWeight } from '../lib/units'
import type { Exercise, ExerciseLog, Units } from '../types'
import type { Emoji, Post, PostItem, PostPayload } from './types'

/** How far back the feed goes. */
export const POST_DAYS = 30

/**
 * "Look what I did": a finished workout as a post. Each exercise carries its headline numbers (sets, top set, distance,
 * time) and any new personal best; a headline like "2 new personal bests" is suggested as the title.
 */
export function buildPost(date: string, logs: ExerciseLog[], lookup: (id: string) => Exercise | undefined, units: Units): { payload: PostPayload; title: string; emoji: Emoji } | null {
  const day = logs.filter((l) => l.date === date && hasData(l))
  const summary = workoutSummary(date, day.map((l) => ({ exerciseId: l.exerciseId, sets: 1 })), logs, lookup, units)
  const items: PostItem[] = []
  for (const l of day) {
    const ex = lookup(l.exerciseId)
    if (!ex || items.some((i) => i.exerciseId === ex.id)) continue
    const item: PostItem = { exerciseId: ex.id, name: ex.name }
    if (ex.kind === 'cardio' || l.cardio) {
      item.cardio = true
      if (l.cardio?.distance) item.distance = l.cardio.distance
      if (l.cardio?.minutes) item.minutes = l.cardio.minutes
      // Records, without units: the distance itself is shown in each friend's units.
      const bests = newCardioBests(logs, ex.id, l.cardio, date, units, ex)
      if (bests.length) item.best = bests.map((b) => (b.key.startsWith('fastest') ? `${b.title}: ${b.value}` : b.title)).join(' · ')
    } else {
      const work = (l.sets ?? []).filter((s) => !s.warmup && !s.drop && isTicked(s))
      if (work.length === 0) continue
      item.sets = work.length
      if (ex.mode === 'time') {
        const secs = Math.max(0, ...work.map((s) => s.seconds ?? 0))
        if (secs) item.seconds = secs
      } else {
        const top = work.reduce((a, s) => ((s.weight ?? 0) > (a.weight ?? 0) ? s : a))
        if (top.weight) { item.weight = top.weight; if (top.reps) item.reps = top.reps }
        else { const reps = Math.max(0, ...work.map((s) => s.reps ?? 0)); if (reps) item.reps = reps }
      }
      if (summary.results.find((r) => r.exerciseId === ex.id)?.pr) item.best = 'New best'
    }
    items.push(item)
  }
  if (items.length === 0) return null
  const { prs, beat, compared } = summary
  const title = prs ? (prs === 1 ? 'A new personal best' : `${prs} new personal bests`)
    : compared && beat === compared ? 'Beat last time on everything'
    : beat ? `Beat last time on ${beat} of ${compared}`
    : 'Workout done'
  return { payload: { version: 1, items }, title, emoji: prs || beat ? '🔥' : '💪' }
}

// ---------------------------------------------------------------------------------------------
// A post comes from another person: checked and clamped before it's shown.
// ---------------------------------------------------------------------------------------------

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const num = (x: unknown, lo: number, hi: number) => (typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi ? x : undefined)
const str = (x: unknown, max: number) => (typeof x === 'string' && x.trim().length > 0 && x.length <= max ? x : undefined)

function cleanItem(x: unknown): PostItem | null {
  if (!isObj(x)) return null
  const exerciseId = str(x.exerciseId, 100)
  const name = str(x.name, 60)
  if (!exerciseId || !name) return null
  const out: PostItem = { exerciseId, name }
  if (x.cardio === true) out.cardio = true
  const sets = num(x.sets, 1, 100); if (sets !== undefined) out.sets = Math.round(sets)
  const reps = num(x.reps, 1, 10000); if (reps !== undefined) out.reps = Math.round(reps)
  const weight = num(x.weight, 0.1, 5000); if (weight !== undefined) out.weight = weight
  const seconds = num(x.seconds, 1, 86400); if (seconds !== undefined) out.seconds = Math.round(seconds)
  const distance = num(x.distance, 0.001, 1000); if (distance !== undefined) out.distance = distance
  const minutes = num(x.minutes, 0.01, 10000); if (minutes !== undefined) out.minutes = minutes
  const best = str(x.best, 120); if (best) out.best = best
  return out
}

/** A clean payload, or null if it isn't one this version can show. */
export function sanitizePost(raw: unknown): PostPayload | null {
  if (!isObj(raw) || raw.version !== 1 || !Array.isArray(raw.items)) return null
  const items = raw.items.slice(0, 40).map(cleanItem).filter((i): i is PostItem => !!i)
  return items.length ? { version: 1, items } : null
}

/** Library exercises go by the viewer's own name for them; custom ones by the poster's. */
export const postItemName = (i: PostItem) => BUILTIN_BY_ID.get(i.exerciseId)?.name ?? i.name

/** "3 sets · top 185 lb × 8", "3.1 mi · 25:40", in the viewer's units. */
export function describePostItem(i: PostItem, units: Units): string {
  if (i.cardio) return [formatDistanceFor(i.distance ?? null, i.exerciseId, units), formatCardioTime(i.minutes ?? null)].filter(Boolean).join(' · ')
  const sets = i.sets ? `${i.sets} set${i.sets === 1 ? '' : 's'}` : ''
  const top = i.seconds ? `best ${formatSeconds(i.seconds)}`
    : i.weight ? `top ${showWeight(i.weight, units)} ${units.weight}${i.reps ? ` × ${i.reps}` : ''}`
    : i.reps ? `best ${i.reps} reps` : ''
  return [sets, top].filter(Boolean).join(' · ')
}

/** Friends' posts I haven't looked at yet. */
export const newPosts = (posts: Post[], seenAt: string | undefined) => posts.filter((p) => !p.mine && p.createdAt > (seenAt ?? ''))
