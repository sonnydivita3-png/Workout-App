import { describe, expect, it } from 'vitest'
import { isOffensive } from './nameFilter'

describe('name filter', () => {
  it('catches obvious words, including letter swaps and padding', () => {
    for (const bad of ['fuck_you', 'Sh1tHead', 'b1tch99', 'n4zi_lifter', 'fuuuuck', 'kkk_member', 'kill_your_self']) expect(isOffensive(bad), bad).toBe(true)
  })
  it('leaves ordinary names alone', () => {
    for (const ok of ['classic_lifter', 'peacock', 'Dickens', 'grape_ape', 'spicy_runner', 'bass_player', 'Sam', 'jay_22', 'Assistant Coach', 'therapist', 'torpedo', 'skyscraper', 'pedometer'])
      expect(isOffensive(ok), ok).toBe(false)
  })
})
