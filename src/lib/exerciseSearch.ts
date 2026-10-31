import type { Exercise } from '../types'
import { areaOf } from './bodyParts'

const squash = (t: string) => t.toLowerCase().replace(/[-\s]/g, '')

/** Gym shorthand and other spellings, as the words the library uses. */
const ALIASES: Record<string, string> = {
  rdl: 'romanian deadlift', sldl: 'stiff legged', ohp: 'overhead press', db: 'dumbbell', bb: 'barbell', kb: 'kettlebell',
  bw: 'bodyweight', tri: 'tricep', bi: 'bicep', ghr: 'glute ham', flies: 'fly', flys: 'fly', skaters: 'skater',
  trx: 'suspension', medball: 'medicine ball', mb: 'medicine ball',
}

/** The words of a search, with shorthand spelled out. Hyphens and spaces don't matter (pushup finds Push-Up). */
export const searchWords = (q: string): string[] =>
  q.trim().toLowerCase().split(/\s+/).flatMap((w) => (ALIASES[w] ?? w).split(' ')).map(squash).filter(Boolean)

// Besides its names, an exercise is found by its muscle group and area ("bicep curl", "leg exercises", "abs"), its
// equipment ("chest press machine"), and a shoulder press by "overhead press", what most people call it.
const also = (e: Exercise) =>
  [e.group, areaOf(e.group), e.equipment ?? '', e.group === 'Core' ? 'abs' : '', e.group === 'Shoulders' && /press/i.test(e.name) ? 'overhead' : ''].join(' ')

const hays = new WeakMap<Exercise, string>()
const hay = (e: Exercise) => {
  let h = hays.get(e)
  if (h === undefined) {
    h = squash(`${e.name} ${e.fullName ?? ''} ${also(e)}`)
    hays.set(e, h)
  }
  return h
}

/** Every word is somewhere in the exercise; a plural finds the singular ("hammer curls" finds Hammer Curl). */
export function matchesSearch(e: Exercise, words: string[]): boolean {
  const h = hay(e)
  return words.every((w) => h.includes(w) || (w.length >= 4 && w.endsWith('s') && (h.includes(w.slice(0, -1)) || (w.endsWith('es') && h.includes(w.slice(0, -2))))))
}

// ---------------------------------------------------------------------------------------------
// Closest matches, for a search where nothing has every word: a typo ("dumbell"), an extra word, or something the
// library calls by another name.
// ---------------------------------------------------------------------------------------------

/** Singular, roughly: curls → curl, presses → press, flies → fly (press stays press). */
const stem = (w: string) =>
  w.length <= 3 ? w : /(ss|sh|ch|x)es$/.test(w) ? w.slice(0, -2) : w.endsWith('ies') ? `${w.slice(0, -3)}y` : /[^s]s$/.test(w) ? w.slice(0, -1) : w
const FILLER = new Set(['a', 'an', 'the', 'with', 'and', 'on', 'of', 'to', 'for', 'in', 'or'])
const splitWords = (t: string) => t.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w && !FILLER.has(w)).map(stem)

/** Edits (a letter added, dropped, changed, or two swapped) to turn one word into the other, stopping early past 2. */
function edits(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3
  let prev2: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], prev2[j - 2] + 1)
    }
    prev2 = prev
    prev = row
  }
  return prev[b.length]
}

/** How alike a typed word and a word of an exercise are, 0 to 1. */
function wordLike(w: string, t: string): number {
  if (w === t) return 1
  const short = Math.min(w.length, t.length)
  if (short >= 3 && (t.startsWith(w) || (w.startsWith(t) && t.length >= w.length * 0.75))) return 0.9 // lat → lateral, abduct → abductor
  let same = 0
  while (same < short && w[same] === t[same]) same++
  if (same >= 5 && same >= short * 0.7) return 0.85 // abduction → abductor
  if (short >= 4) {
    const d = edits(w, t)
    if (d === 1) return 0.75 // dumbell → dumbbell
    if (d === 2 && short >= 7) return 0.6 // romainian → romanian
  }
  if (w.length >= 3 && t.endsWith(w)) return 0.7 // fly → butterfly
  if (w.length >= 4 && t.includes(w)) return 0.65
  return 0
}

const tokens = new WeakMap<Exercise, { name: string[]; named: string; other: string[] }>()
/** Its names' words (and the names run together, for "skullcrusher"), and its muscle group, area and equipment. */
function tokensOf(e: Exercise) {
  let t = tokens.get(e)
  if (!t) {
    const names = `${e.name} ${e.fullName ?? ''}`
    t = { name: [...new Set(splitWords(names))], named: squash(names), other: [...new Set(splitWords(also(e)))] }
    tokens.set(e, t)
  }
  return t
}

/**
 * The exercises closest to a search that nothing matched in full, best first (at most `n`). Each typed word counts for
 * its best match among the exercise's words (its name matters more than its muscle group or equipment), a word few
 * exercises have counts for more than one most have ("landmine" over "press"), and an exercise needs at least half the
 * words. Then the one whose name the search covers best (Dumbbell Shoulder Press before Dumbbell One-Arm Shoulder
 * Press). Ties keep the order of `list`, so pass it in the order you'd list it.
 */
export function closestExercises(list: Exercise[], query: string, n = 5): Exercise[] {
  const words = [...new Set(splitWords(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).map((w) => ALIASES[w] ?? w).join(' ')))]
  if (words.length === 0) return []
  const like = list.map((e) => {
    const t = tokensOf(e)
    const covered = new Set<number>()
    const per = words.map((w) => {
      let best = w.length >= 4 && t.named.includes(squash(w)) ? 0.9 : 0
      t.name.forEach((x, j) => { const s = wordLike(w, x); if (s >= 0.6) covered.add(j); best = Math.max(best, s) })
      for (const x of t.other) best = Math.max(best, 0.7 * wordLike(w, x))
      return best
    })
    return { per, coverage: t.name.length ? covered.size / t.name.length : 0 }
  })
  // Rarer words weigh more (how many of the exercises match each one at all).
  const weight = words.map((_, i) => Math.log((list.length + 1) / (1 + like.filter((l) => l.per[i] >= 0.6).length)) + 0.1)
  const need = Math.ceil(words.length / 2)
  return list
    .map((e, k) => ({ e, matched: like[k].per.filter((s) => s >= 0.6).length, score: like[k].per.reduce((a, s, i) => a + s * weight[i], 0) + 0.5 * like[k].coverage }))
    .filter((x) => x.matched >= need && x.score > 0)
    .sort((a, b) => b.matched - a.matched || b.score - a.score)
    .slice(0, n)
    .map((x) => x.e)
}
