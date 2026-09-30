import { describe, expect, it } from 'vitest'
import { inviteText, inviteUrl, readInvite } from './invite'

describe('invite links', () => {
  it('builds the app link, with the handle when given', () => {
    expect(inviteUrl(undefined, 'https://x.github.io/Workout-App/?add=sam#x', '/Workout-App/')).toBe('https://x.github.io/Workout-App/')
    expect(inviteUrl('jay_22', 'https://x.github.io/Workout-App/', '/Workout-App/')).toBe('https://x.github.io/Workout-App/?add=jay_22')
    expect(inviteUrl('jay_22', 'http://localhost:4173/', './')).toBe('http://localhost:4173/?add=jay_22')
    expect(inviteText('jay_22')).toContain('@jay_22')
  })
  it('reads only valid handles', () => {
    expect(readInvite('?add=jay_22')).toBe('jay_22')
    expect(readInvite('?add=%40Jay_22')).toBe('jay_22')
    expect(readInvite('?add=a')).toBeNull()
    expect(readInvite('?add=<script>')).toBeNull()
    expect(readInvite('?other=1')).toBeNull()
    expect(readInvite('')).toBeNull()
  })
})
