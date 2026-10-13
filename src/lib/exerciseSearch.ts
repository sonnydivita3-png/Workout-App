import type { Exercise } from '../types'
import { areaOf } from './bodyParts'

const squash = (t: string) => t.toLowerCase().replace(/[-\s]/g, '')

/** Gym shorthand and other spellings, as the words the library uses. */
const ALIASES: Record<string, string> = {
  rdl: 'romanian deadlift', sldl: 'stiff legged', ohp: 'overhead press', db: 'dumbbell', bb: 'barbell', kb: 'kettlebell',
  bw: 'bodyweight', tri: 'tricep', bi: 'bicep', ghr: 'glute ham', flies: 'fly', flys: 'fly', skaters: 'skater',
}

/** The words of a search, with shorthand spelled out. Hyphens and spaces don't matter (pushup finds Push-Up). */
export const searchWords = (q: string): string[] =>
  q.trim().toLowerCase().split(/\s+/).flatMap((w) => (ALIASES[w] ?? w).split(' ')).map(squash).filter(Boolean)

// Besides its names, an exercise is found by its muscle group and area ("bicep curl", "leg exercises", "abs"), and a
// shoulder press by "overhead press", what most people call it.
const also = (e: Exercise) =>
  [e.group, areaOf(e.group), e.group === 'Core' ? 'abs' : '', e.group === 'Shoulders' && /press/i.test(e.name) ? 'overhead' : ''].join(' ')

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
