import { SocialError } from './types'

/**
 * A basic filter for handles and display names. It isn't meant to catch everything (reports and blocking cover the
 * rest), only the obvious cases. Words are matched inside the name after undoing common letter swaps, so they're
 * chosen to avoid hitting ordinary words (no "ass" as in "class", "rapist" as in "therapist", "pedo" as in "torpedo").
 */
const BLOCKED = [
  'fuck', 'fuk', 'shit', 'cunt', 'bitch', 'whore', 'slut', 'twat', 'wank', 'pussy', 'penis', 'vagina', 'porn', 'dildo',
  'nigger', 'nigga', 'faggot', 'retard', 'tranny', 'kike', 'wetback', 'beaner', 'raghead', 'nazi', 'hitler',
  'molest', 'killyourself',
]

const SWAPS: Record<string, string> = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' }

const squash = (s: string) =>
  s.toLowerCase().split('').map((c) => SWAPS[c] ?? c).join('').replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1')

/** True when a handle or display name contains an obviously offensive word. */
export function isOffensive(text: string): boolean {
  const t = squash(text)
  return BLOCKED.some((w) => t.includes(squash(w))) || /kkk/i.test(text)
}

/** Refuse a handle or display name the filter catches. */
export function checkName(...names: string[]) {
  if (names.some(isOffensive)) throw new SocialError('not_allowed', 'Please choose a different name. That one isn’t allowed.')
}
