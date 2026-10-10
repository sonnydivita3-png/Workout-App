import type { Exercise } from '../types'
import { hasFavorites, isFavorite } from './favorites'
import { isAdvanced, isIsolation, type Rng } from './randomUtil'

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

/** How much likelier a pick is: 3× for each kind they asked for more of (up to 9×). */
const likedWeight = (e: Exercise) => { const s = moveScore(e); return s > 0 ? 3 ** Math.min(2, s) : 1 }

/** A favorite is a sure pick in about three workouts out of four that train its body part (and can turn up anyway). */
export const FAVORITE_ODDS = 0.75

/** A kind they asked for less of (and not a favorite): only used when nothing else fits. */
export const unwanted = (e: Exercise) => moveScore(e) < 0 && !isFavorite(e)

/**
 * Order candidates by preference, keeping the list's tiers (`tier`: lifts they've been logging, everyday lifts,
 * everyday bodyweight moves, the rest; anything in `avoid` a tier lower):
 * - a favorite goes first, most times (FAVORITE_ODDS);
 * - a kind they asked for more of is about three times as likely within its tier, and can move up one tier, so it
 *   gains whatever share it starts from without pushing out everything else;
 * - a kind they asked for less of goes to the back.
 */
export function byPreference<T extends Exercise>(list: T[], rng: Rng, tier: (e: T) => number = () => 0, avoid: ReadonlySet<string> = new Set()): T[] {
  if (!hasMovePrefs() && !hasFavorites()) return list
  const keyed = list.filter((e) => !unwanted(e)).map((e) => {
    const fav = isFavorite(e) && rng() < FAVORITE_ODDS
    const w = fav ? 5 : likedWeight(e)
    const t = tier(e)
    const up = fav ? 0 : w > 1 ? Math.max(t - 1, Math.min(t, 1)) : t
    // Weighted random order within a tier (Efraimidis-Spirakis): log(u) / w, largest first.
    return { e, t: up + (avoid.has(e.id) ? 1 : 0), key: Math.log(rng()) / w }
  })
  keyed.sort((a, b) => a.t - b.t || b.key - a.key)
  return [...keyed.map((x) => x.e), ...list.filter(unwanted)]
}

/**
 * The same for picks made by score (one exercise per part on full-body days): a liked kind gets a random bonus, so it
 * wins close calls often but not always (+2.2 on average); a favorite, most times, enough to beat the part's usual
 * lift (but not something just like an exercise already in); a kind they want less of loses to anything else that
 * fits. No preferences or favorites: no bonus, and no random numbers used.
 */
export function preferenceBonus(e: Exercise, rng: Rng): number {
  if (unwanted(e)) return -20
  const w = likedWeight(e)
  return (w > 1 ? Math.log(w) * rng() * 4 : 0) + (isFavorite(e) && rng() < FAVORITE_ODDS ? 7.5 : 0)
}

/** "More free weights, one arm / one leg · less machines", or null with no preference. */
export function movePrefsSummary(moves: MovePrefs | undefined): string | null {
  const name = (id: string) => MOVE_TYPES.find((t) => t.id === id)!.label.toLowerCase()
  const more = MOVE_TYPES.filter((t) => moves?.[t.id] === 1).map((t) => name(t.id))
  const less = MOVE_TYPES.filter((t) => moves?.[t.id] === -1).map((t) => name(t.id))
  const parts = [more.length ? `More ${more.join(', ')}` : '', less.length ? `${more.length ? 'less' : 'Less'} ${less.join(', ')}` : ''].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}
