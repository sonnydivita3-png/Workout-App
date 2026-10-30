import { describe, expect, it } from 'vitest'
import { cleanAcceptance, TERMS_VERSION, termsAccepted } from './legal'
import { repairState } from './migrate'

describe('agreeing to the terms', () => {
  it('counts only an agreement to the current version or later', () => {
    expect(termsAccepted(null)).toBe(false)
    expect(termsAccepted({ version: TERMS_VERSION, at: '2026-10-30T12:00:00.000Z' })).toBe(true)
    expect(termsAccepted({ version: TERMS_VERSION - 1, at: '2026-10-30T12:00:00.000Z' })).toBe(false)
  })
  it('keeps a real saved agreement and drops anything else', () => {
    const ok = { version: 1, at: '2026-10-30T12:00:00.000Z' }
    expect(cleanAcceptance(ok)).toEqual(ok)
    for (const bad of [null, 'yes', true, { version: '1', at: ok.at }, { version: 1.5, at: ok.at }, { version: 0, at: ok.at }, { version: 1, at: 'whenever' }, { version: 1 }]) expect(cleanAcceptance(bad)).toBeNull()
    expect(cleanAcceptance({ ...ok, extra: 1 })).toEqual(ok)
  })
  it('is checked when the app loads or a backup is restored', () => {
    const defaults = { legalAccepted: null as unknown, logs: [] as unknown[] }
    expect(repairState({ legalAccepted: { version: 1, at: '2026-10-30T12:00:00.000Z' } }, defaults).legalAccepted).toEqual({ version: 1, at: '2026-10-30T12:00:00.000Z' })
    expect(repairState({ legalAccepted: { version: 99, at: 'not a date' } }, defaults).legalAccepted).toBeNull()
    expect(repairState({}, defaults).legalAccepted).toBeNull()
  })
})
