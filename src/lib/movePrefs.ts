import type { Exercise } from '../types'
import { isAdvanced, isIsolation } from './randomUtil'

/** Kinds of movement someone can ask for more or less of. Generated workouts lean towards (or away from) them. */
export const MOVE_TYPES = [
  { id: 'compound', label: 'Compound lifts', hint: 'Squats, presses, rows, deadlifts' },
  { id: 'isolation', label: 'Isolation', hint: 'Curls, raises, extensions, flyes' },
  { id: 'free', label: 'Free weights', hint: 'Barbells, dumbbells, kettlebells' },
  { id: 'machine', label: 'Machines', hint: 'Leg press, chest press, Smith…' },
  { id: 'cable', label: 'Cables', hint: 'Pulldowns, pushdowns, crossovers' },
  { id: 'unilateral', label: 'One arm / one leg', hint: 'Lunges, split squats, single-arm rows' },
  { id: 'bodyweight', label: 'Bodyweight', hint: 'Push-ups, pull-ups, dips, planks' },
] as const
export type MoveType = (typeof MOVE_TYPES)[number]['id']
/** -1 less, 0 no preference, 1 more. */
export type Lean = -1 | 0 | 1
export type MovePrefs = Partial<Record<MoveType, Lean>>

const text = (e: Exercise) => `${e.name} ${e.fullName ?? ''}`
const UNILATERAL = /single[- ]arm|one[- ]arm|single[- ]leg|one[- ]leg|alternat|lunge|split squat|step-?up|bulgarian|pistol|unilateral|kickback/i
/** One-sided moves that really are advanced (one-arm push-ups and pull-ups), whatever someone likes. */
const HARD_ONE_SIDED = /push-?up|pull-?up|chin-?up|handstand|snatch|clean|jerk|pistol/i

export const isUnilateral = (e: Exercise) => UNILATERAL.test(text(e))

const MATCH: Record<MoveType, (e: Exercise) => boolean> = {
  compound: (e) => e.kind === 'strength' && e.group !== 'Core' && e.mode !== 'time' && !isIsolation(e),
  isolation: (e) => e.kind === 'strength' && isIsolation(e),
  free: (e) => ['Barbell', 'Dumbbell', 'Kettlebell', 'EZ bar'].includes(e.equipment ?? ''),
  machine: (e) => e.equipment === 'Machine',
  cable: (e) => e.equipment === 'Cable',
  unilateral: isUnilateral,
  bodyweight: (e) => e.equipment === 'Bodyweight',
}

export const matchesMove = (t: MoveType, e: Exercise) => MATCH[t](e)

// Set from the profile (store.ts), like the equipment and cardio choices, so every generator can read it.
let prefs: MovePrefs = {}
/** Keeps only known kinds with a -1 / 1 lean (the saved value may come from an older or another device). */
export function setMovePrefs(p: MovePrefs | undefined) {
  prefs = {}
  if (!p || typeof p !== 'object') return
  for (const [t, lean] of Object.entries(p)) if (t in MATCH && (lean === 1 || lean === -1)) prefs[t as MoveType] = lean
}
export const movePrefs = () => prefs
export const hasMovePrefs = () => Object.values(prefs).some((v) => v)

/** How much someone wants this exercise: the sum of their leans for each kind it is (e.g. +2 for a liked dumbbell lunge). */
export function moveScore(e: Exercise): number {
  let s = 0
  for (const [t, lean] of Object.entries(prefs) as [MoveType, Lean][]) if (lean && MATCH[t](e)) s += lean
  return s
}

/**
 * Advanced moves stay out of random workouts, but single-arm and single-leg versions of everyday lifts (a single-arm
 * row, a one-leg RDL) are fair game for someone who asked for more one-sided work.
 */
export const tooAdvanced = (e: Exercise) => isAdvanced(e) && !(prefs.unilateral === 1 && isUnilateral(e) && !HARD_ONE_SIDED.test(text(e)))

/**
 * Re-order candidates by preference while keeping each list's own order (staples first, last workout's picks last…):
 * liked kinds take turns with the rest, so "More" means about half of the picks rather than all of them, and a liked
 * move never jumps more than one tier ahead. Unwanted kinds go to the back, used only when nothing else is left.
 */
export function byPreference<T extends Exercise>(list: T[], tier: (e: T) => number = () => 0): T[] {
  if (!hasMovePrefs()) return list
  const liked = list.filter((e) => moveScore(e) > 0)
  const plain = list.filter((e) => moveScore(e) === 0)
  const less = list.filter((e) => moveScore(e) < 0)
  const out: T[] = []
  let i = 0
  let j = 0
  let lastLiked = false
  while (i < liked.length || j < plain.length) {
    const canLiked = i < liked.length && (j >= plain.length || tier(liked[i]) <= tier(plain[j]) + 1)
    // Liked first when it's at least as good a tier, then alternate; a strongly liked move (two kinds) can go twice.
    const takeLiked = canLiked && (j >= plain.length || !lastLiked || moveScore(liked[i]) >= 2 || tier(liked[i]) < tier(plain[j]))
    if (takeLiked) { out.push(liked[i++]); lastLiked = true } else { out.push(plain[j++]); lastLiked = false }
  }
  return [...out, ...less]
}

/** "More free weights, one arm / one leg · less machines", or null with no preference. */
export function movePrefsSummary(moves: MovePrefs | undefined): string | null {
  const name = (id: string) => MOVE_TYPES.find((t) => t.id === id)!.label.toLowerCase()
  const more = MOVE_TYPES.filter((t) => moves?.[t.id] === 1).map((t) => name(t.id))
  const less = MOVE_TYPES.filter((t) => moves?.[t.id] === -1).map((t) => name(t.id))
  const parts = [more.length ? `More ${more.join(', ')}` : '', less.length ? `${more.length ? 'less' : 'Less'} ${less.join(', ')}` : ''].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}
