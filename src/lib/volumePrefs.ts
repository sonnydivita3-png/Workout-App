import { PER_MUSCLE } from './muscles'
import type { ExtraTime } from './randomizer'

/** What to do when a generated workout would give one muscle more than the person's limit. */
export type ExtraTimeChoice = 'ask' | ExtraTime | 'more'
export const EXTRA_TIME_CHOICES: [ExtraTimeChoice, string][] = [
  ['ask', 'Ask me'], ['heavier', 'Heavier, fewer exercises'], ['finisher', 'Add a cardio finisher'], ['part', 'Add a body part'],
  ['shorter', 'Shorter workout'], ['more', 'Keep adding exercises'],
]
/** Saved values may be old or odd: a whole number from 1 to 12, else the usual 5. */
export const perMuscleOf = (n: unknown) => (typeof n === 'number' && n >= 1 ? Math.min(12, Math.round(n)) : PER_MUSCLE)
export const extraTimeOf = (c: unknown): ExtraTimeChoice => (EXTRA_TIME_CHOICES.some(([id]) => id === c) ? (c as ExtraTimeChoice) : 'ask')
