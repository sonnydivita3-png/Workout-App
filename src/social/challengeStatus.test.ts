import { describe, expect, it } from 'vitest'
import { challengeStatus } from './challengeStatus'
import { challengeUpdates, pendingCount } from './store'
import type { Challenge, Profile } from './types'

const me: Profile = { id: 'me', handle: 'me', displayName: 'Me', avatar: '💪' }
const alex: Profile = { id: 'a', handle: 'alex', displayName: 'Alex', avatar: '🔥' }
const NOW = new Date('2026-10-01T12:00:00Z').getTime()
const ch = (over: Partial<Challenge>): Challenge => ({
  id: 'c1', from: me, to: alex, kind: 'total', title: 'Push-ups: 100', spec: { metric: 'reps' } as Challenge['spec'], target: 100, days: 7,
  status: 'pending', progress: 0, done: false, createdAt: '2026-09-30T12:00:00Z', mine: true, ...over,
})

describe('challenge status in plain words', () => {
  it('says where a challenge I sent stands', () => {
    expect(challengeStatus(ch({}))).toBe('⏳ Waiting for Alex to accept')
    expect(challengeStatus(ch({ status: 'active', endsAt: '2026-10-07T12:00:00Z' }))).toMatch(/^✅ Alex accepted · ends /)
    expect(challengeStatus(ch({ status: 'declined' }))).toBe('Alex declined')
    expect(challengeStatus(ch({ status: 'completed', done: true }))).toBe('🏆 Alex finished it')
  })
  it('and one sent to me', () => {
    expect(challengeStatus(ch({ mine: false, from: alex, to: me }))).toBe('From Alex · waiting for you')
  })
})

describe('answers to my challenges in the inbox', () => {
  const empty = { requests: { incoming: [], outgoing: [] }, shares: [], workoutRequests: [], emoji: [] }
  it('shows accepted, declined and finished ones until seen, and counts them on the badge', () => {
    const list = [ch({ id: 'a', status: 'active', acceptedAt: '2026-09-30T13:00:00Z' }), ch({ id: 'b', status: 'pending' }), ch({ id: 'c', status: 'declined' }), ch({ id: 'd', status: 'active', mine: false, from: alex, to: me })]
    expect(challengeUpdates(list, {}, NOW).map((c) => c.id)).toEqual(['a', 'c'])
    expect(challengeUpdates(list, { a: 'active' }, NOW).map((c) => c.id)).toEqual(['c'])
    // Seen while active, then finished: it comes back.
    expect(challengeUpdates([ch({ id: 'a', status: 'completed', done: true })], { a: 'active' }, NOW)).toHaveLength(1)
    expect(pendingCount({ ...empty, challenges: list }, {})).toBe(2)
    expect(pendingCount({ ...empty, challenges: list })).toBe(0)
  })
  it('drops old ones after a month', () => {
    expect(challengeUpdates([ch({ status: 'active', acceptedAt: '2026-08-01T00:00:00Z' })], {}, NOW)).toHaveLength(0)
  })
})
