import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * These tests run the real migration on a real Postgres (PGlite) and act as different users through the
 * `authenticated` role, so row-level security is enforced exactly as it is in Supabase.
 */
let db: PGlite

const PRELUDE = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema auth to authenticated, anon;
  grant select, delete on auth.users to authenticated;
`

beforeAll(async () => {
  db = new PGlite()
  await db.exec(PRELUDE)
  await db.exec(readFileSync(new URL('../../supabase/migrations/20260930000000_social.sql', import.meta.url), 'utf8'))
}, 120000)
afterAll(async () => { await db.close() })

type Row = Record<string, unknown>

/** Run SQL as a signed-in user (RLS applies). */
async function as<T = Row>(uid: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`)
  try {
    return (await db.query<T>(sql, params)).rows
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}
async function asAnon<T = Row>(sql: string): Promise<T[]> {
  await db.exec('set role anon')
  try {
    return (await db.query<T>(sql)).rows
  } finally {
    await db.exec('reset role')
  }
}
const admin = async <T = Row>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows

let n = 0
async function user(handle?: string): Promise<string> {
  const id = randomUUID()
  const h = handle ?? `user_${(++n).toString(36)}_${id.slice(0, 4)}`
  await admin('insert into auth.users (id) values ($1)', [id])
  await as(id, 'insert into public.profiles (id, handle, display_name) values ($1, $2, $3)', [id, h, h.toUpperCase()])
  return id
}

/** a and b become friends; `grant` is what b lets a do, `grantBack` what a lets b do. */
async function befriend(a: string, b: string, grant: Row = {}, grantBack: Row = {}) {
  const [req] = await as<{ id: string }>(a, 'insert into public.friend_requests (from_id, to_id) values ($1, $2) returning id', [a, b])
  await as(b, 'select public.respond_friend_request($1, true, $2::jsonb)', [req.id, JSON.stringify(grant)])
  if (Object.keys(grantBack).length) {
    const sets = Object.keys(grantBack).map((k) => `${k} = ${grantBack[k]}`).join(', ')
    await as(a, `update public.friend_permissions set ${sets} where owner_id = $1 and friend_id = $2`, [a, b])
  }
}
const share = (from: string, to: string) =>
  as<{ id: string }>(from, `insert into public.shared_workouts (from_id, to_id, scope, title, payload) values ($1, $2, 'day', 'Leg day', '{"days":[]}') returning id`, [from, to])

describe('profiles', () => {
  it('lets you create your own profile but nobody else’s, with a valid unique handle', async () => {
    const a = await user()
    const other = randomUUID()
    await admin('insert into auth.users (id) values ($1)', [other])
    await expect(as(a, `insert into public.profiles (id, handle, display_name) values ($1, 'stolen_one', 'x')`, [other])).rejects.toThrow(/row-level security/)
    for (const bad of ['ab', 'UPPER', 'has space', 'a'.repeat(21), 'emoji💪x', 'dash-ed']) {
      const id = randomUUID()
      await admin('insert into auth.users (id) values ($1)', [id])
      await expect(as(id, `insert into public.profiles (id, handle, display_name) values ($1, $2, 'x')`, [id, bad]), bad).rejects.toThrow(/check constraint/)
    }
    const dupe = randomUUID()
    await admin('insert into auth.users (id) values ($1)', [dupe])
    const [{ handle }] = await as<{ handle: string }>(a, 'select handle from public.profiles where id = $1', [a])
    await expect(as(dupe, `insert into public.profiles (id, handle, display_name) values ($1, $2, 'x')`, [dupe, handle])).rejects.toThrow(/unique/)
  })

  it('keeps handles fixed but lets you rename yourself', async () => {
    const a = await user()
    await as(a, `update public.profiles set display_name = 'New Name', avatar = '🔥' where id = $1`, [a])
    expect((await as(a, 'select display_name, avatar from public.profiles where id = $1', [a]))[0]).toEqual({ display_name: 'New Name', avatar: '🔥' })
    await expect(as(a, `update public.profiles set handle = 'other_handle' where id = $1`, [a])).rejects.toThrow(/handle_locked/)
  })

  it('hides strangers: no browsing, exact-handle lookup only', async () => {
    const a = await user()
    const b = await user('findable_bob')
    expect(await as(a, 'select id from public.profiles where id = $1', [b])).toEqual([])
    expect(await as(a, 'select count(*)::int as c from public.profiles where id <> $1', [a])).toEqual([{ c: 0 }])
    expect(await as(a, `select handle from public.find_profile('findable_bob')`)).toEqual([{ handle: 'findable_bob' }])
    expect(await as(a, `select handle from public.find_profile('  FINDABLE_BOB ')`)).toEqual([{ handle: 'findable_bob' }]) // case and spaces forgiven
    expect(await as(a, `select handle from public.find_profile('findable')`)).toEqual([]) // no partial matches
    expect(await as(a, `select handle from public.find_profile('%')`)).toEqual([])
    const [{ handle }] = await as<{ handle: string }>(a, 'select handle from public.profiles where id = $1', [a])
    expect(await as(a, 'select handle from public.find_profile($1)', [handle])).toEqual([]) // not yourself
  })

  it('never exposes email addresses (they are not in the public schema at all)', async () => {
    const cols = await admin<{ column_name: string }>(`select column_name from information_schema.columns where table_schema = 'public'`)
    expect(cols.some((c) => /mail/i.test(c.column_name))).toBe(false)
  })
})

describe('friend requests', () => {
  it('can be sent to someone you found, seen only by the two people, and reveal the sender’s profile to the recipient', async () => {
    const a = await user('req_a'); const b = await user('req_b'); const c = await user()
    const [req] = await as<{ id: string }>(a, 'insert into public.friend_requests (from_id, to_id) values ($1, $2) returning id', [a, b])
    expect(await as(b, 'select from_id from public.friend_requests')).toEqual([{ from_id: a }])
    expect(await as(a, 'select to_id from public.friend_requests')).toEqual([{ to_id: b }])
    expect(await as(c, 'select id from public.friend_requests')).toEqual([])
    expect((await as(b, 'select handle from public.profiles where id = $1', [a]))[0]).toEqual({ handle: 'req_a' })
    expect(await as(c, 'select handle from public.profiles where id = $1', [a])).toEqual([])
    expect(req.id).toBeTruthy()
  })

  it('cannot be forged, duplicated, self-sent, or sent to friends or blocked people', async () => {
    const a = await user(); const b = await user(); const c = await user()
    await expect(as(a, 'insert into public.friend_requests (from_id, to_id) values ($1, $2)', [b, c])).rejects.toThrow(/row-level security/) // pretending to be b
    await expect(as(a, 'insert into public.friend_requests (from_id, to_id) values ($1, $1)', [a])).rejects.toThrow()
    await expect(as(a, `insert into public.friend_requests (from_id, to_id, status) values ($1, $2, 'accepted')`, [a, b])).rejects.toThrow(/row-level security/)
    await as(a, 'insert into public.friend_requests (from_id, to_id) values ($1, $2)', [a, b])
    await expect(as(a, 'insert into public.friend_requests (from_id, to_id) values ($1, $2)', [a, b])).rejects.toThrow(/unique/)
    await expect(as(b, 'insert into public.friend_requests (from_id, to_id) values ($1, $2)', [b, a])).rejects.toThrow(/unique/) // crossing requests
    const d = await user(); const e = await user()
    await befriend(d, e)
    await expect(as(d, 'insert into public.friend_requests (from_id, to_id) values ($1, $2)', [d, e])).rejects.toThrow(/row-level security/)
    const f = await user(); const g = await user()
    await as(f, 'select public.block_user($1)', [g])
    await expect(as(g, 'insert into public.friend_requests (from_id, to_id) values ($1, $2)', [g, f])).rejects.toThrow(/row-level security/)
    await expect(as(f, 'insert into public.friend_requests (from_id, to_id) values ($1, $2)', [f, g])).rejects.toThrow(/row-level security/)
  })

  it('accepting makes mutual friends, with permissions the accepter chose and nothing granted back', async () => {
    const a = await user(); const b = await user()
    const [req] = await as<{ id: string }>(a, 'insert into public.friend_requests (from_id, to_id) values ($1, $2) returning id', [a, b])
    await as(b, 'select public.respond_friend_request($1, true, $2::jsonb)', [req.id, JSON.stringify({ emoji: true, workouts: true })])
    expect(await as(a, 'select friend_id from public.friends')).toEqual([{ friend_id: b }])
    expect(await as(b, 'select friend_id from public.friends')).toEqual([{ friend_id: a }])
    // b allowed a: emoji + workouts only
    const [perm] = await as(a, 'select progress, workouts, requests, challenges, emoji from public.friend_permissions where owner_id = $1 and friend_id = $2', [b, a])
    expect(perm).toEqual({ progress: false, workouts: true, requests: false, challenges: false, emoji: true })
    // a has allowed b nothing yet, and hasn't reviewed
    const [back] = await as(a, 'select progress, workouts, requests, challenges, emoji, reviewed from public.friend_permissions where owner_id = $1', [a])
    expect(back).toEqual({ progress: false, workouts: false, requests: false, challenges: false, emoji: false, reviewed: false })
    // they can now see each other's profiles
    expect(await as(a, 'select handle from public.profiles where id = $1', [b])).toHaveLength(1)
  })

  it('declining leaves no friendship; only the recipient can answer, and only once', async () => {
    const a = await user(); const b = await user()
    const [req] = await as<{ id: string }>(a, 'insert into public.friend_requests (from_id, to_id) values ($1, $2) returning id', [a, b])
    await expect(as(a, 'select public.respond_friend_request($1, true)', [req.id])).rejects.toThrow(/not_found/) // sender can't accept own
    await as(b, 'select public.respond_friend_request($1, false)', [req.id])
    expect(await as(a, 'select * from public.friends')).toEqual([])
    await expect(as(b, 'select public.respond_friend_request($1, true)', [req.id])).rejects.toThrow(/not_found/)
    // after a decline they can try again
    await as(a, 'insert into public.friend_requests (from_id, to_id) values ($1, $2)', [a, b])
  })

  it('a sender can withdraw a pending request but not tamper with it', async () => {
    const a = await user(); const b = await user()
    const [req] = await as<{ id: string }>(a, 'insert into public.friend_requests (from_id, to_id) values ($1, $2) returning id', [a, b])
    await expect(as(a, `update public.friend_requests set status = 'accepted' where id = $1`, [req.id])).rejects.toThrow(/permission denied/)
    await expect(as(b, 'delete from public.friend_requests where id = $1', [req.id])).resolves.toEqual([]) // not theirs to delete: nothing happens
    expect(await admin('select id from public.friend_requests where id = $1', [req.id])).toHaveLength(1)
    await as(a, 'delete from public.friend_requests where id = $1', [req.id])
    expect(await admin('select id from public.friend_requests where id = $1', [req.id])).toHaveLength(0)
  })

  it('friendships cannot be written directly', async () => {
    const a = await user(); const b = await user()
    await expect(as(a, 'insert into public.friends (user_id, friend_id) values ($1, $2)', [a, b])).rejects.toThrow(/permission denied/)
    await expect(as(a, 'insert into public.friend_permissions (owner_id, friend_id, progress) values ($1, $2, true)', [a, b])).rejects.toThrow(/permission denied/)
  })
})

describe('permissions', () => {
  it('start off, are changed only by their owner, and are readable by both friends but not strangers', async () => {
    const a = await user(); const b = await user(); const c = await user()
    await befriend(a, b)
    expect((await as(a, 'select workouts from public.friend_permissions where owner_id = $1', [b]))[0]).toEqual({ workouts: false })
    await as(a, `update public.friend_permissions set workouts = true, reviewed = true where owner_id = $1 and friend_id = $2`, [a, b])
    expect((await as(b, 'select workouts from public.friend_permissions where owner_id = $1 and friend_id = $2', [a, b]))[0]).toEqual({ workouts: true }) // b can see what a lets b do
    // b cannot grant themselves anything from a
    await as(b, `update public.friend_permissions set challenges = true where owner_id = $1 and friend_id = $2`, [a, b])
    expect((await as(a, 'select challenges from public.friend_permissions where owner_id = $1', [a]))[0]).toEqual({ challenges: false })
    expect(await as(c, 'select * from public.friend_permissions')).toEqual([])
  })
})

describe('shared workouts', () => {
  it('need the recipient’s agreement, a friendship, and cannot be forged', async () => {
    const a = await user(); const b = await user(); const c = await user()
    await befriend(a, b) // b has NOT allowed workouts
    await expect(share(a, b)).rejects.toThrow(/row-level security/)
    await expect(share(a, c)).rejects.toThrow(/row-level security/) // not friends
    await as(b, `update public.friend_permissions set workouts = true where owner_id = $1 and friend_id = $2`, [b, a])
    const [s] = await share(a, b)
    expect(await as(b, 'select id, status from public.shared_workouts')).toEqual([{ id: s.id, status: 'pending' }])
    expect(await as(c, 'select id from public.shared_workouts')).toEqual([])
    await expect(as(a, `insert into public.shared_workouts (from_id, to_id, scope, title, payload, status) values ($1, $2, 'day', 'x', '{}', 'added')`, [a, b])).rejects.toThrow(/row-level security/)
    await expect(as(b, `insert into public.shared_workouts (from_id, to_id, scope, title, payload) values ($1, $2, 'day', 'x', '{}')`, [a, b])).rejects.toThrow(/row-level security/) // b pretending to be a
  })

  it('stop being allowed the moment permission is withdrawn, and reject oversized payloads', async () => {
    const a = await user(); const b = await user()
    await befriend(a, b, { workouts: true })
    await share(a, b)
    await as(b, `update public.friend_permissions set workouts = false where owner_id = $1 and friend_id = $2`, [b, a])
    await expect(share(a, b)).rejects.toThrow(/row-level security/)
    await as(b, `update public.friend_permissions set workouts = true where owner_id = $1 and friend_id = $2`, [b, a])
    const big = JSON.stringify({ blob: 'x'.repeat(300000) })
    await expect(as(a, `insert into public.shared_workouts (from_id, to_id, scope, title, payload) values ($1, $2, 'week', 'big', $3::jsonb)`, [a, b, big])).rejects.toThrow(/check constraint/)
  })

  it('only the recipient can add or dismiss, only once; the sender can withdraw while pending', async () => {
    const a = await user(); const b = await user()
    await befriend(a, b, { workouts: true })
    const [s] = await share(a, b)
    await expect(as(a, 'select public.respond_shared_workout($1, true)', [s.id])).rejects.toThrow(/not_found/)
    await expect(as(a, `update public.shared_workouts set status = 'added' where id = $1`, [s.id])).rejects.toThrow(/permission denied/)
    await as(b, 'select public.respond_shared_workout($1, true)', [s.id])
    expect((await as(a, 'select status from public.shared_workouts where id = $1', [s.id]))[0]).toEqual({ status: 'added' })
    await expect(as(b, 'select public.respond_shared_workout($1, false)', [s.id])).rejects.toThrow(/not_found/)
    const [t] = await share(a, b)
    await as(a, 'delete from public.shared_workouts where id = $1', [t.id])
    expect(await admin('select id from public.shared_workouts where id = $1', [t.id])).toHaveLength(0)
  })
})

describe('asking a friend for a workout', () => {
  it('needs the asked person’s agreement; they can fulfil it with a workout they sent you, or decline', async () => {
    const a = await user(); const b = await user() // a asks b
    await befriend(a, b, {}, {})
    await expect(as(a, `insert into public.workout_requests (from_id, to_id, scope, note) values ($1, $2, 'week', 'legs please')`, [a, b])).rejects.toThrow(/row-level security/)
    await as(b, `update public.friend_permissions set requests = true, workouts = false where owner_id = $1 and friend_id = $2`, [b, a])
    // b must be allowed to send to a: a grants workouts to b
    await as(a, `update public.friend_permissions set workouts = true where owner_id = $1 and friend_id = $2`, [a, b])
    const [r] = await as<{ id: string }>(a, `insert into public.workout_requests (from_id, to_id, scope, note) values ($1, $2, 'week', 'legs please') returning id`, [a, b])
    await expect(as(a, 'select public.respond_workout_request($1, $2)', [r.id, 'decline'])).rejects.toThrow(/not_found/) // requester can't answer their own
    const [s] = await share(b, a)
    const other = await user()
    await expect(as(b, 'select public.respond_workout_request($1, $2, $3)', [r.id, 'fulfill', randomUUID()])).rejects.toThrow(/not_allowed/) // must be a real share to a
    void other
    await as(b, 'select public.respond_workout_request($1, $2, $3)', [r.id, 'fulfill', s.id])
    expect((await as(a, 'select status, share_id from public.workout_requests where id = $1', [r.id]))[0]).toEqual({ status: 'fulfilled', share_id: s.id })
    const [r2] = await as<{ id: string }>(a, `insert into public.workout_requests (from_id, to_id, scope) values ($1, $2, 'day') returning id`, [a, b])
    await as(b, 'select public.respond_workout_request($1, $2)', [r2.id, 'decline'])
    expect((await as(a, 'select status from public.workout_requests where id = $1', [r2.id]))[0]).toEqual({ status: 'declined' })
  })
})

describe('challenges', () => {
  const spec = '{"exercise":{"id":"Pushups"},"metric":"reps"}'
  const send = (from: string, to: string, extra = '') =>
    as<{ id: string }>(from, `insert into public.challenges (from_id, to_id, kind, title, spec, target, days ${extra ? ',' + extra.split('=')[0] : ''}) values ($1, $2, 'total', '100 pushups', $3::jsonb, 100, 7 ${extra ? ',' + extra.split('=')[1] : ''}) returning id`, [from, to, spec])

  it('need the recipient’s agreement, start pending at zero, and cannot be pre-completed', async () => {
    const a = await user(); const b = await user()
    await befriend(a, b)
    await expect(send(a, b)).rejects.toThrow(/row-level security/)
    await as(b, `update public.friend_permissions set challenges = true where owner_id = $1 and friend_id = $2`, [b, a])
    await expect(send(a, b, `status='active'`)).rejects.toThrow(/row-level security/)
    await expect(send(a, b, 'progress=50')).rejects.toThrow(/row-level security/)
    await expect(send(a, b, 'done=true')).rejects.toThrow(/row-level security/)
    const [c] = await send(a, b)
    expect((await as(b, 'select status, progress from public.challenges where id = $1', [c.id]))[0]).toEqual({ status: 'pending', progress: '0' })
  })

  it('run from acceptance: the challenged reports progress, the challenger watches, nobody else can interfere', async () => {
    const a = await user(); const b = await user(); const c = await user()
    await befriend(a, b, { challenges: true })
    const [ch] = await send(a, b)
    await expect(as(a, 'select public.respond_challenge($1, true)', [ch.id])).rejects.toThrow(/not_found/)
    await expect(as(b, 'select public.report_challenge_progress($1, 10, false)', [ch.id])).rejects.toThrow(/not_found/) // not active yet
    await as(b, 'select public.respond_challenge($1, true)', [ch.id])
    const [row] = await as<{ status: string; accepted_at: string; ends_at: string }>(b, 'select status, accepted_at, ends_at from public.challenges where id = $1', [ch.id])
    expect(row.status).toBe('active')
    expect((new Date(row.ends_at).getTime() - new Date(row.accepted_at).getTime()) / 86400000).toBeCloseTo(7, 0)
    await expect(as(a, 'select public.report_challenge_progress($1, 90, true)', [ch.id])).rejects.toThrow(/not_found/) // challenger can't fake it
    await expect(as(c, 'select public.report_challenge_progress($1, 90, true)', [ch.id])).rejects.toThrow(/not_found/)
    await expect(as(b, `update public.challenges set progress = 100 where id = $1`, [ch.id])).rejects.toThrow(/permission denied/)
    await as(b, 'select public.report_challenge_progress($1, 60, false)', [ch.id])
    expect((await as(a, 'select progress, status from public.challenges where id = $1', [ch.id]))[0]).toEqual({ progress: '60', status: 'active' })
    await as(b, 'select public.report_challenge_progress($1, 100, true)', [ch.id])
    expect((await as(a, 'select done, status from public.challenges where id = $1', [ch.id]))[0]).toEqual({ done: true, status: 'completed' })
    expect(await as(c, 'select id from public.challenges')).toEqual([])
  })

  it('can be declined, cancelled by the sender, and stop accepting progress once long expired', async () => {
    const a = await user(); const b = await user()
    await befriend(a, b, { challenges: true })
    const [d] = await send(a, b)
    await as(b, 'select public.respond_challenge($1, false)', [d.id])
    expect((await as(a, 'select status from public.challenges where id = $1', [d.id]))[0]).toEqual({ status: 'declined' })
    const [x] = await send(a, b)
    await as(a, 'select public.cancel_challenge($1)', [x.id])
    expect((await as(b, 'select status from public.challenges where id = $1', [x.id]))[0]).toEqual({ status: 'cancelled' })
    await expect(as(b, 'select public.respond_challenge($1, true)', [x.id])).rejects.toThrow(/not_found/)
    const [e] = await send(a, b)
    await as(b, 'select public.respond_challenge($1, true)', [e.id])
    await admin(`update public.challenges set ends_at = now() - interval '3 days' where id = $1`, [e.id])
    await expect(as(b, 'select public.report_challenge_progress($1, 50, false)', [e.id])).rejects.toThrow(/expired/)
  })

  it('reject nonsense: zero targets, absurd durations', async () => {
    const a = await user(); const b = await user()
    await befriend(a, b, { challenges: true })
    await expect(as(a, `insert into public.challenges (from_id, to_id, kind, title, spec, target, days) values ($1, $2, 'total', 't', '{}', 0, 7)`, [a, b])).rejects.toThrow(/check constraint/)
    await expect(as(a, `insert into public.challenges (from_id, to_id, kind, title, spec, target, days) values ($1, $2, 'total', 't', '{}', 5, 400)`, [a, b])).rejects.toThrow(/check constraint/)
  })
})

describe('emoji', () => {
  const sendEmoji = (from: string, to: string, e = '💪') => as(from, 'insert into public.emoji_messages (from_id, to_id, emoji) values ($1, $2, $3)', [from, to, e])

  it('need permission and come only from a fixed set', async () => {
    const a = await user(); const b = await user()
    await befriend(a, b)
    await expect(sendEmoji(a, b)).rejects.toThrow(/row-level security/)
    await as(b, `update public.friend_permissions set emoji = true where owner_id = $1 and friend_id = $2`, [b, a])
    await sendEmoji(a, b, '🔥')
    await expect(sendEmoji(a, b, 'hello there')).rejects.toThrow(/check constraint/) // no free text
    await expect(sendEmoji(a, b, '😈')).rejects.toThrow(/check constraint/)
    expect((await as(b, 'select emoji from public.emoji_messages'))[0]).toEqual({ emoji: '🔥' })
  })

  it('are rate-limited and readable only by the two people; only the recipient marks them read', async () => {
    const a = await user(); const b = await user(); const c = await user()
    await befriend(a, b, { emoji: true })
    for (let i = 0; i < 20; i++) await sendEmoji(a, b)
    await expect(sendEmoji(a, b)).rejects.toThrow(/rate_limited/)
    expect(await as(c, 'select id from public.emoji_messages')).toEqual([])
    const ids = (await as<{ id: string }>(b, 'select id from public.emoji_messages')).map((r) => r.id)
    await as(a, 'select public.mark_emoji_read($1::uuid[])', [ids]) // sender can't
    expect(await admin('select id from public.emoji_messages where read_at is not null')).toHaveLength(0)
    await as(b, 'select public.mark_emoji_read($1::uuid[])', [ids])
    expect((await admin<{ c: number }>('select count(*)::int as c from public.emoji_messages where read_at is not null'))[0].c).toBe(20)
  })
})

describe('progress snapshots', () => {
  const publish = (u: string, data = '{"weekWorkouts":3}') =>
    as(u, `insert into public.progress_snapshots (user_id, data) values ($1, $2::jsonb) on conflict (user_id) do update set data = excluded.data, updated_at = now()`, [u, data])

  it('are visible to a friend only while they are allowed to see progress', async () => {
    const a = await user(); const b = await user(); const c = await user()
    await befriend(a, b, { progress: true }, {}) // a allowed b?  b accepted a's request granting a progress => a may see b
    await publish(b)
    expect(await as(a, 'select data from public.progress_snapshots where user_id = $1', [b])).toEqual([{ data: { weekWorkouts: 3 } }])
    expect(await as(b, 'select data from public.progress_snapshots where user_id = $1', [b])).toHaveLength(1)
    expect(await as(c, 'select data from public.progress_snapshots where user_id = $1', [b])).toEqual([]) // stranger
    await publish(a) // a never allowed b
    expect(await as(b, 'select data from public.progress_snapshots where user_id = $1', [a])).toEqual([])
    await as(b, `update public.friend_permissions set progress = false where owner_id = $1 and friend_id = $2`, [b, a])
    expect(await as(a, 'select data from public.progress_snapshots where user_id = $1', [b])).toEqual([]) // withdrawn
  })

  it('can only be written by their owner', async () => {
    const a = await user(); const b = await user()
    await befriend(a, b, { progress: true })
    await expect(as(a, `insert into public.progress_snapshots (user_id, data) values ($1, '{}')`, [b])).rejects.toThrow(/row-level security/)
    await publish(b)
    await as(a, `update public.progress_snapshots set data = '{"hacked":true}' where user_id = $1`, [b])
    expect((await admin<{ data: Row }>('select data from public.progress_snapshots where user_id = $1', [b]))[0].data).toEqual({ weekWorkouts: 3 })
  })
})

describe('removing friends, blocking, deleting your account', () => {
  it('unfriending cuts both directions, cancels pending items, and stops new ones', async () => {
    const a = await user(); const b = await user()
    await befriend(a, b, { workouts: true, challenges: true, emoji: true }, { workouts: true, challenges: true, emoji: true })
    const [s] = await share(a, b)
    const [ch] = await as<{ id: string }>(a, `insert into public.challenges (from_id, to_id, kind, title, spec, target, days) values ($1, $2, 'best', 't', '{}', 5, 3) returning id`, [a, b])
    await as(b, 'select public.remove_friend($1)', [a])
    expect(await admin('select * from public.friends')).not.toContainEqual(expect.objectContaining({ user_id: a, friend_id: b }))
    expect(await admin('select id from public.shared_workouts where id = $1', [s.id])).toHaveLength(0)
    expect((await admin<{ status: string }>('select status from public.challenges where id = $1', [ch.id]))[0].status).toBe('cancelled')
    await expect(share(a, b)).rejects.toThrow(/row-level security/)
    expect(await as(a, 'select id from public.profiles where id = $1', [b])).toEqual([]) // no longer visible
    expect(await admin('select * from public.friend_permissions where owner_id in ($1, $2)', [a, b])).toHaveLength(0)
  })

  it('blocking also unfriends, hides you from lookup, and can be undone', async () => {
    const a = await user('blocker_a'); const b = await user('blocked_b')
    await befriend(a, b)
    await as(a, 'select public.block_user($1)', [b])
    expect(await as(b, 'select * from public.friends')).toEqual([])
    expect(await as(b, `select * from public.find_profile('blocker_a')`)).toEqual([])
    expect(await as(a, `select * from public.find_profile('blocked_b')`)).toEqual([])
    await as(a, 'select public.unblock_user($1)', [b])
    expect(await as(b, `select handle from public.find_profile('blocker_a')`)).toHaveLength(1)
    await expect(as(a, 'select public.block_user($1)', [a])).rejects.toThrow(/not_allowed/)
  })

  it('deleting your account removes you and all your data, and leaves others untouched', async () => {
    const a = await user(); const b = await user()
    await befriend(a, b, { workouts: true, progress: true, emoji: true }, { workouts: true })
    await share(a, b)
    await as(a, `insert into public.progress_snapshots (user_id, data) values ($1, '{}')`, [a])
    await as(a, 'select public.delete_my_account()')
    for (const [table, col] of [['profiles', 'id'], ['friends', 'user_id'], ['shared_workouts', 'from_id'], ['progress_snapshots', 'user_id'], ['friend_permissions', 'owner_id']]) {
      expect(await admin(`select 1 from public.${table} where ${col} = $1`, [a]), table).toHaveLength(0)
    }
    expect(await admin('select 1 from public.friends where friend_id = $1', [a])).toHaveLength(0)
    expect(await admin('select 1 from public.profiles where id = $1', [b])).toHaveLength(1)
    expect(await admin('select 1 from auth.users where id = $1', [a])).toHaveLength(0)
  })
})

describe('signed-out and direct-write access', () => {
  it('anonymous visitors can read nothing and call nothing', async () => {
    for (const t of ['profiles', 'friends', 'friend_requests', 'friend_permissions', 'shared_workouts', 'workout_requests', 'challenges', 'emoji_messages', 'progress_snapshots', 'blocks']) {
      await expect(asAnon(`select * from public.${t}`), t).rejects.toThrow(/permission denied/)
    }
    await expect(asAnon(`select * from public.find_profile('abc')`)).rejects.toThrow(/permission denied/)
  })
  it('signed-in users cannot write the tables that only the server’s actions may change', async () => {
    const a = await user(); const b = await user()
    await befriend(a, b, { challenges: true, workouts: true })
    const [ch] = await as<{ id: string }>(a, `insert into public.challenges (from_id, to_id, kind, title, spec, target, days) values ($1, $2, 'best', 't', '{}', 5, 3) returning id`, [a, b])
    await expect(as(b, `update public.challenges set status = 'completed' where id = $1`, [ch.id])).rejects.toThrow(/permission denied/)
    await expect(as(a, `delete from public.challenges where id = $1`, [ch.id])).rejects.toThrow(/permission denied/)
    await expect(as(a, `delete from public.friends where user_id = $1`, [a])).rejects.toThrow(/permission denied/)
    await expect(as(a, `insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [a, b])).rejects.toThrow(/permission denied/)
    await expect(as(a, `update public.emoji_messages set read_at = now()`)).rejects.toThrow(/permission denied/)
  })
  it('rate-limits friend requests', async () => {
    const a = await user()
    for (let i = 0; i < 20; i++) { const t = await user(); await as(a, 'insert into public.friend_requests (from_id, to_id) values ($1, $2)', [a, t]) }
    const t = await user()
    await expect(as(a, 'insert into public.friend_requests (from_id, to_id) values ($1, $2)', [a, t])).rejects.toThrow(/rate_limited/)
  })
})
