import { describe, expect, it } from 'vitest'
import { decideSync, fingerprint, syncPayload } from './sync'

const meta = (lastSyncedAt: string | null, lastHash: string | null) => ({ lastSyncedAt, lastHash })

describe('decideSync', () => {
  it('first backup uploads; a fresh phone with nothing downloads', () => {
    expect(decideSync({ localHash: 'a', localEmpty: false, remote: null, meta: meta(null, null) })).toBe('push')
    expect(decideSync({ localHash: 'e', localEmpty: true, remote: null, meta: meta(null, null) })).toBe('none')
    expect(decideSync({ localHash: 'e', localEmpty: true, remote: { updatedAt: 't1' }, meta: meta(null, null) })).toBe('pull')
  })
  it('one side changed: that side wins', () => {
    expect(decideSync({ localHash: 'b', localEmpty: false, remote: { updatedAt: 't1' }, meta: meta('t1', 'a') })).toBe('push')
    expect(decideSync({ localHash: 'a', localEmpty: false, remote: { updatedAt: 't2' }, meta: meta('t1', 'a') })).toBe('pull')
    expect(decideSync({ localHash: 'a', localEmpty: false, remote: { updatedAt: 't1' }, meta: meta('t1', 'a') })).toBe('none')
  })
  it('both changed: ask, never silently overwrite', () => {
    expect(decideSync({ localHash: 'b', localEmpty: false, remote: { updatedAt: 't2' }, meta: meta('t1', 'a') })).toBe('conflict')
    expect(decideSync({ localHash: 'b', localEmpty: false, remote: { updatedAt: 't2' }, meta: meta(null, null) })).toBe('conflict')
  })
  it('payload is only workout data, and the fingerprint tracks changes', () => {
    const p = syncPayload({ logs: [1], theme: 'dark', plan: [], session: {} })
    expect(Object.keys(p)).toContain('logs')
    expect(p).not.toHaveProperty('theme')
    expect(fingerprint({ a: 1 })).toBe(fingerprint({ a: 1 }))
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }))
  })
})
