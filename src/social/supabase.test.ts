import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { mapError } from './supabase'
import { EMOJI, SocialError } from './types'

// All migrations together, in order.
const sql = readdirSync('supabase/migrations').sort().map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n')
const src = readFileSync('src/social/supabase.ts', 'utf8')

describe('Supabase backend matches the migration', () => {
  it('every RPC it calls exists and is granted to signed-in users', () => {
    const names = [...src.matchAll(/rpc\('([a-z_]+)'/g)].map((m) => m[1])
    expect(names.length).toBeGreaterThan(8)
    for (const n of names) {
      expect(sql, n).toMatch(new RegExp(`create function public\\.${n}\\(`))
      expect(sql, n).toMatch(new RegExp(`public\\.${n}\\(`, 'g'))
      const grant = sql.slice(sql.indexOf('grant execute on function'))
      expect(grant, `${n} not granted`).toContain(`public.${n}(`)
    }
  })

  it('every table it reads or writes exists', () => {
    const tables = new Set([...src.matchAll(/from\('([a-z_]+)'\)/g)].map((m) => m[1]))
    for (const t of tables) expect(sql, t).toContain(`create table public.${t} (`)
  })

  it('never writes tables the migration makes read-only for clients', () => {
    // friends and blocks are changed only through RPCs.
    expect(src).not.toMatch(/from\('(friends|blocks)'\)\s*\.(insert|update|delete|upsert)/)
  })

  it('the emoji allowed by the database are exactly the ones the app offers', () => {
    const m = sql.match(/emoji text not null check \(emoji in \(([^)]*)\)\)/)!
    const inDb = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
    expect(inDb).toEqual([...EMOJI])
  })
})

describe('mapError', () => {
  it('maps database errors to friendly codes', () => {
    expect(mapError({ message: 'rate_limited' }).code).toBe('rate_limited')
    expect(mapError({ message: 'not_found' }).code).toBe('not_found')
    expect(mapError({ message: 'expired' }).code).toBe('expired')
    expect(mapError({ code: '42501', message: 'new row violates row-level security policy' }).code).toBe('not_allowed')
    expect(mapError({ code: '23505', message: 'duplicate key value violates unique constraint "profiles_handle_key"' }).code).toBe('handle_taken')
    expect(mapError({ code: '23505', message: 'duplicate key' }).code).toBe('already_exists')
    expect(mapError({ message: 'Token has expired or is invalid' }).code).toBe('invalid_code')
    expect(mapError(new SocialError('not_signed_in')).code).toBe('not_signed_in')
    expect(mapError({ message: 'A user with this email address has already been registered' }).code).toBe('already_exists')
    expect(mapError({ message: 'Anonymous sign-ins are disabled' }).code).toBe('unavailable')
    expect(mapError({ message: 'email rate limit exceeded', status: 429 }).code).toBe('rate_limited')
    expect(mapError({ message: 'For security purposes, you can only request this after 48 seconds.' }).code).toBe('rate_limited')
    expect(mapError({ message: 'Signups not allowed for otp' }).message).toMatch(/sign-ups are turned off/)
    expect(mapError(undefined).code).toBe('unavailable')
    // A server that hasn't had a newer migration run yet.
    expect(mapError({ code: 'PGRST205', message: "Could not find the table 'public.posts' in the schema cache" }).message).toMatch(/server update/)
    expect(mapError({ code: 'PGRST204', message: "Could not find the 'posts' column of 'friend_permissions' in the schema cache" }).message).toMatch(/server update/)
  })
})
