import { describe, expect, it } from 'vitest'
import { DemoBackend, type Persistence } from './demo'
import { ALL_PERMS, EMOJI, SocialError, type ChallengeSpec, type SharedPayload } from './types'

const mem = (): Persistence & { json: () => string | null } => {
  let v: string | null = null
  return { load: () => v, save: (j) => { v = j }, json: () => v }
}
const world = () => {
  const be = new DemoBackend(mem())
  const as = (id: string) => { be._actAs(id); return be }
  return { be, as, add: (handle: string) => be._addUser(handle) }
}
const payload: SharedPayload = { version: 1, scope: 'day', days: [{ offset: 0, rest: false, items: [{ exerciseId: 'Pushups', sets: 3, reps: 10 }] }], custom: [] }
const spec: ChallengeSpec = { metric: 'reps', mode: 'total', exercise: { id: 'Pushups', name: 'Pushups', kind: 'strength', mode: 'reps' } }
const denied = (p: Promise<unknown>, c: string) => expect(p).rejects.toMatchObject({ code: c })

/** a asks b; b accepts granting `grant`. */
async function befriend(w: ReturnType<typeof world>, a: string, b: string, grant: Record<string, boolean> = {}) {
  await w.as(a).sendFriendRequest(b)
  const { incoming } = await w.as(b).friendRequests()
  await w.as(b).respondFriendRequest(incoming.find((r) => r.from.id === a)!.id, true, grant)
}

describe('sign-in and profile', () => {
  it('signs in with an emailed code and creates a profile with a valid unique handle', async () => {
    const be = new DemoBackend(mem())
    await denied(be.verifyCode('a@x.com', '123456'), 'invalid_code') // no code requested yet
    await expect(be.sendCode('not an email')).rejects.toBeInstanceOf(SocialError)
    await be.sendCode('a@x.com')
    await denied(be.verifyCode('a@x.com', '000000'), 'invalid_code')
    const user = await be.verifyCode('a@x.com', '123456')
    expect(await be.currentUser()).toEqual(user)
    await denied(be.createProfile({ handle: 'no', displayName: 'A', avatar: '💪' }), 'invalid_handle')
    await denied(be.createProfile({ handle: 'has space', displayName: 'A', avatar: '💪' }), 'invalid_handle')
    await denied(be.createProfile({ handle: 'alex', displayName: 'A', avatar: '💪' }), 'handle_taken') // a simulated friend has it
    const p = await be.createProfile({ handle: '@Sonny_D', displayName: 'Sonny', avatar: '🏃' })
    expect(p.handle).toBe('sonny_d')
    await denied(be.createProfile({ handle: 'another', displayName: 'A', avatar: '💪' }), 'already_exists')
    await be.signOut()
    expect(await be.currentUser()).toBeNull()
    await denied(be.myProfile().then(() => be.friends()), 'not_signed_in')
  })

  it('finds people by exact handle only, never yourself, never anyone blocked', async () => {
    const w = world(); const a = w.add('finder'); const b = w.add('findable_bob')
    expect((await w.as(a).findByHandle('  @FINDABLE_BOB '))?.id).toBe(b)
    expect(await w.as(a).findByHandle('findable')).toBeNull()
    expect(await w.as(a).findByHandle('finder')).toBeNull()
    await w.as(a).blockUser(b)
    expect(await w.as(a).findByHandle('findable_bob')).toBeNull()
    expect(await w.as(b).findByHandle('finder')).toBeNull()
  })
})

describe('friend requests', () => {
  it('reject duplicates in either direction, self, friends, and blocked people', async () => {
    const w = world(); const a = w.add('a_one'); const b = w.add('b_two'); const c = w.add('c_three')
    await w.as(a).sendFriendRequest(b)
    await denied(w.as(a).sendFriendRequest(b), 'already_exists')
    await denied(w.as(b).sendFriendRequest(a), 'already_exists')
    await denied(w.as(a).sendFriendRequest(a), 'not_allowed')
    await befriend(w, b, c)
    await denied(w.as(b).sendFriendRequest(c), 'not_allowed')
    await w.as(a).blockUser(c)
    await denied(w.as(c).sendFriendRequest(a), 'not_allowed')
    await denied(w.as(a).sendFriendRequest(c), 'not_allowed')
  })

  it('accepting makes mutual friends with only the permissions the accepter chose', async () => {
    const w = world(); const a = w.add('req_a'); const b = w.add('req_b')
    await befriend(w, a, b, { emoji: true, workouts: true })
    const [fa] = await w.as(a).friends(); const [fb] = await w.as(b).friends()
    expect(fa.profile.id).toBe(b); expect(fb.profile.id).toBe(a)
    expect(fa.theyGrant).toMatchObject({ workouts: true, emoji: true, progress: false, requests: false, challenges: false }) // what b lets a do
    expect(fa.iGrant).toMatchObject({ workouts: false, emoji: false, reviewed: false }) // a has granted nothing, and hasn't reviewed
    expect(fb.iGrant).toMatchObject({ workouts: true, emoji: true, reviewed: true })
  })

  it('only the recipient can answer, once; the sender can withdraw a pending request', async () => {
    const w = world(); const a = w.add('sender'); const b = w.add('receiver')
    await w.as(a).sendFriendRequest(b)
    const { incoming } = await w.as(b).friendRequests()
    const id = incoming[0].id
    await denied(w.as(a).respondFriendRequest(id, true), 'not_found')
    await w.as(b).respondFriendRequest(id, false)
    expect(await w.as(a).friends()).toEqual([])
    await denied(w.as(b).respondFriendRequest(id, true), 'not_found')
    await w.as(a).sendFriendRequest(b) // can try again after a decline
    const out = (await w.as(a).friendRequests()).outgoing[0]
    await denied(w.as(b).cancelFriendRequest(out.id), 'not_found')
    await w.as(a).cancelFriendRequest(out.id)
    expect((await w.as(b).friendRequests()).incoming).toEqual([])
  })

  it('are rate-limited to 20 an hour', async () => {
    const w = world(); const a = w.add('spammer')
    for (let i = 0; i < 20; i++) await w.as(a).sendFriendRequest(w.add(`target_${i}`))
    await denied(w.as(a).sendFriendRequest(w.add('one_too_many')), 'rate_limited')
  })
})

describe('permissions', () => {
  it('start off, and only their owner changes them', async () => {
    const w = world(); const a = w.add('perm_a'); const b = w.add('perm_b'); const c = w.add('perm_c')
    await befriend(w, a, b)
    expect((await w.as(a).friends())[0].theyGrant).toMatchObject({ progress: false, workouts: false, requests: false, challenges: false, emoji: false })
    await w.as(a).setPermissions(b, { workouts: true })
    expect((await w.as(b).friends())[0].theyGrant.workouts).toBe(true) // b sees what a allows b to do
    expect((await w.as(a).friends())[0].iGrant).toMatchObject({ workouts: true, reviewed: true })
    await denied(w.as(c).setPermissions(a, { challenges: true }), 'not_found') // not friends
  })
})

describe('shared workouts and workout requests', () => {
  it('need the recipient’s agreement; withdrawing it stops new ones', async () => {
    const w = world(); const a = w.add('share_a'); const b = w.add('share_b'); const c = w.add('share_c')
    await befriend(w, a, b) // b has NOT allowed workouts
    await denied(w.as(a).sendShare({ toId: b, scope: 'day', title: 'Leg day', payload }), 'not_allowed')
    await denied(w.as(a).sendShare({ toId: c, scope: 'day', title: 'Leg day', payload }), 'not_allowed')
    await w.as(b).setPermissions(a, { workouts: true })
    const id = await w.as(a).sendShare({ toId: b, scope: 'day', title: 'Leg day', emoji: '🔥', payload })
    expect((await w.as(b).shares())[0]).toMatchObject({ id, status: 'pending', mine: false, title: 'Leg day' })
    expect(await w.as(c).shares().catch(() => [])).toEqual([])
    await w.as(b).setPermissions(a, { workouts: false })
    await denied(w.as(a).sendShare({ toId: b, scope: 'day', title: 'Again', payload }), 'not_allowed')
  })

  it('only the recipient adds or dismisses, once; the sender can withdraw while pending', async () => {
    const w = world(); const a = w.add('s_a'); const b = w.add('s_b')
    await befriend(w, a, b, { workouts: true })
    const id = await w.as(a).sendShare({ toId: b, scope: 'week', title: 'Week', payload })
    await denied(w.as(a).respondShare(id, true), 'not_found')
    await w.as(b).respondShare(id, true)
    expect((await w.as(a).shares())[0].status).toBe('added')
    await denied(w.as(b).respondShare(id, false), 'not_found')
    const t = await w.as(a).sendShare({ toId: b, scope: 'day', title: 'Oops', payload })
    await w.as(a).withdrawShare(t)
    expect((await w.as(b).shares()).map((s) => s.id)).toEqual([id])
    await denied(w.as(a).sendShare({ toId: b, scope: 'day', title: '', payload }), 'not_allowed')
  })

  it('a request needs the asked person’s agreement and is fulfilled with a real share to the requester', async () => {
    const w = world(); const a = w.add('ask_a'); const b = w.add('ask_b') // a asks b
    await befriend(w, a, b) // b granted a nothing
    await denied(w.as(a).requestWorkout({ toId: b, scope: 'week', note: 'legs please' }), 'not_allowed')
    await w.as(b).setPermissions(a, { requests: true })
    await w.as(a).setPermissions(b, { workouts: true }) // a allows b to send workouts
    await w.as(a).requestWorkout({ toId: b, scope: 'week', note: 'legs please' })
    const [r] = await w.as(b).workoutRequests()
    await denied(w.as(a).respondWorkoutRequest(r.id, 'decline'), 'not_found')
    await denied(w.as(b).respondWorkoutRequest(r.id, 'fulfill', 'made-up'), 'not_allowed')
    const share = await w.as(b).sendShare({ toId: a, scope: 'week', title: 'Legs', payload })
    await w.as(b).respondWorkoutRequest(r.id, 'fulfill', share)
    expect((await w.as(a).workoutRequests())[0]).toMatchObject({ status: 'fulfilled', shareId: share })
    await denied(w.as(a).requestWorkout({ toId: b, scope: 'day', note: 'x'.repeat(141) }), 'not_allowed')
  })
})

describe('challenges', () => {
  const ch = (w: ReturnType<typeof world>, from: string, to: string, over = {}) =>
    w.as(from).sendChallenge({ toId: to, title: '100 push-ups', spec, target: 100, days: 7, ...over })

  it('need agreement, start pending, and run from acceptance with progress reported only by the challenged', async () => {
    const w = world(); const a = w.add('c_a'); const b = w.add('c_b'); const c = w.add('c_c')
    await befriend(w, a, b)
    await denied(ch(w, a, b), 'not_allowed')
    await w.as(b).setPermissions(a, { challenges: true })
    const id = await ch(w, a, b)
    expect((await w.as(b).challenges())[0]).toMatchObject({ status: 'pending', progress: 0 })
    await denied(w.as(a).respondChallenge(id, true), 'not_found')
    await denied(w.as(b).reportProgress(id, 10, false), 'not_found') // not active yet
    await w.as(b).respondChallenge(id, true)
    const active = (await w.as(b).challenges())[0]
    expect(active.status).toBe('active')
    expect((new Date(active.endsAt!).getTime() - new Date(active.acceptedAt!).getTime()) / 86400000).toBeCloseTo(7, 0)
    await denied(w.as(a).reportProgress(id, 90, true), 'not_found') // the challenger can't fake it
    await denied(w.as(c).reportProgress(id, 90, true), 'not_found')
    await w.as(b).reportProgress(id, 60, false)
    expect((await w.as(a).challenges())[0]).toMatchObject({ progress: 60, status: 'active' })
    await w.as(b).reportProgress(id, 100, true)
    expect((await w.as(a).challenges())[0]).toMatchObject({ done: true, status: 'completed' })
  })

  it('can be declined or cancelled, expire, and reject nonsense', async () => {
    const w = world(); const a = w.add('d_a'); const b = w.add('d_b')
    await befriend(w, a, b, { challenges: true })
    const d = await ch(w, a, b); await w.as(b).respondChallenge(d, false)
    expect((await w.as(a).challenges()).find((x) => x.id === d)!.status).toBe('declined')
    const x = await ch(w, a, b); await w.as(a).cancelChallenge(x)
    await denied(w.as(b).respondChallenge(x, true), 'not_found')
    const e = await ch(w, a, b, { days: 2 }); await w.as(b).respondChallenge(e, true)
    w.be.clock = () => Date.now() + 5 * 86400000
    await denied(w.as(b).reportProgress(e, 50, false), 'expired')
    w.be.clock = () => Date.now()
    await denied(ch(w, a, b, { target: 0 }), 'not_allowed')
    await denied(ch(w, a, b, { days: 400 }), 'not_allowed')
  })
})

describe('emoji', () => {
  it('need permission, come only from a fixed set, are rate-limited, and are private', async () => {
    const w = world(); const a = w.add('e_a'); const b = w.add('e_b'); const c = w.add('e_c')
    await befriend(w, a, b)
    await denied(w.as(a).sendEmoji({ toId: b, emoji: '💪' }), 'not_allowed')
    await w.as(b).setPermissions(a, { emoji: true })
    await w.as(a).sendEmoji({ toId: b, emoji: '🔥' })
    await denied(w.as(a).sendEmoji({ toId: b, emoji: '😈' as never }), 'not_allowed')
    for (let i = 0; i < 19; i++) await w.as(a).sendEmoji({ toId: b, emoji: '💪' })
    await denied(w.as(a).sendEmoji({ toId: b, emoji: '💪' }), 'rate_limited')
    expect(await w.as(c).emojiMessages().catch(() => [])).toEqual([])
    const ids = (await w.as(b).emojiMessages()).map((m) => m.id)
    await w.as(a).markEmojiRead(ids) // the sender can't mark them read
    expect((await w.as(b).emojiMessages()).every((m) => !m.read)).toBe(true)
    await w.as(b).markEmojiRead(ids)
    expect((await w.as(b).emojiMessages()).every((m) => m.read)).toBe(true)
    expect(EMOJI).toHaveLength(12)
  })
})

describe('progress', () => {
  const snap = { updatedAt: new Date().toISOString(), weekWorkouts: 3, weekStreak: 2, recent: [], bests: [] }
  it('is visible to a friend only while they are allowed to see it', async () => {
    const w = world(); const a = w.add('p_a'); const b = w.add('p_b'); const c = w.add('p_c')
    await befriend(w, a, b, { progress: true }) // b lets a see b's progress
    await w.as(b).publishProgress(snap)
    expect(await w.as(a).friendProgress(b)).toMatchObject({ weekWorkouts: 3 })
    expect(await w.as(c).friendProgress(b)).toBeNull()
    await w.as(a).publishProgress(snap)
    expect(await w.as(b).friendProgress(a)).toBeNull() // a never allowed b
    await w.as(b).setPermissions(a, { progress: false })
    expect(await w.as(a).friendProgress(b)).toBeNull()
  })
})

describe('removing friends, blocking, deleting', () => {
  it('unfriending cuts both ways and cancels what was pending', async () => {
    const w = world(); const a = w.add('r_a'); const b = w.add('r_b')
    await befriend(w, a, b, { workouts: true, challenges: true })
    await w.as(a).setPermissions(b, { workouts: true, challenges: true })
    await w.as(a).sendShare({ toId: b, scope: 'day', title: 'x', payload })
    const id = await ch(w, a, b)
    await w.as(b).removeFriend(a)
    expect(await w.as(a).friends()).toEqual([]); expect(await w.as(b).friends()).toEqual([])
    expect(await w.as(b).shares()).toEqual([])
    expect((await w.as(a).challenges()).find((c) => c.id === id)!.status).toBe('cancelled')
    await denied(w.as(a).sendShare({ toId: b, scope: 'day', title: 'y', payload }), 'not_allowed')
  })
  const ch = (w: ReturnType<typeof world>, from: string, to: string) => w.as(from).sendChallenge({ toId: to, title: 't', spec, target: 5, days: 3 })

  it('blocking unfriends and hides; deleting an account removes everything of yours only', async () => {
    const w = world(); const a = w.add('b_a'); const b = w.add('b_b'); const c = w.add('b_c')
    await befriend(w, a, b); await befriend(w, b, c, { workouts: true })
    await w.as(c).sendShare({ toId: b, scope: 'day', title: 'z', payload }).catch(() => undefined)
    await w.as(a).blockUser(b)
    expect(await w.as(b).friends().then((f) => f.map((x) => x.profile.id))).toEqual([c])
    await w.as(b).deleteAccount()
    expect(await w.as(c).friends()).toEqual([])
    expect(w.be._state().profiles.some((p) => p.id === b)).toBe(false)
    expect(w.be._state().profiles.some((p) => p.id === c)).toBe(true)
  })
})

describe('simulated friends', () => {
  async function signUp(be: DemoBackend, email = 'me@x.com') {
    await be.sendCode(email); await be.verifyCode(email, '123456')
    return be.createProfile({ handle: 'tester', displayName: 'Tester', avatar: '💪' })
  }

  it('greet a new user with two friend requests and nothing else', async () => {
    const be = new DemoBackend(mem()); await signUp(be)
    const { incoming } = await be.friendRequests()
    expect(incoming.map((r) => r.from.handle).sort()).toEqual(['alex', 'sam'])
    expect(await be.shares()).toEqual([]); expect(await be.challenges()).toEqual([]); expect(await be.emojiMessages()).toEqual([])
  })

  it('only do what you have agreed to: no permissions means silence', async () => {
    const be = new DemoBackend(mem()); await signUp(be)
    const [alex] = (await be.friendRequests()).incoming
    await be.respondFriendRequest(alex.id, true, {})
    expect(await be.shares()).toEqual([]); expect(await be.challenges()).toEqual([]); expect(await be.emojiMessages()).toEqual([]); expect(await be.workoutRequests()).toEqual([])
    const [friend] = await be.friends()
    expect(friend.theyGrant).toMatchObject(ALL_PERMS) // simulated friends allow you everything
    await be.setPermissions(friend.profile.id, { emoji: true })
    expect((await be.emojiMessages()).map((m) => m.emoji)).toEqual(['👏'])
    expect(await be.shares()).toEqual([]) // still no workouts, because you didn't agree to them
    await be.setPermissions(friend.profile.id, { workouts: true, challenges: true, requests: true })
    expect((await be.shares())[0]).toMatchObject({ scope: 'week', mine: false })
    expect((await be.challenges())[0]).toMatchObject({ status: 'pending', mine: false, target: 100 })
    expect((await be.workoutRequests())[0]).toMatchObject({ status: 'pending' })
    // switching a permission off and on again doesn't make them repeat themselves
    await be.setPermissions(friend.profile.id, { workouts: false })
    await be.setPermissions(friend.profile.id, { workouts: true })
    expect(await be.shares()).toHaveLength(1)
  })

  it('accept your requests, share progress, take challenges and make progress, and make you a workout when asked', async () => {
    const be = new DemoBackend(mem()); await signUp(be)
    const maya = (await be.findByHandle('maya'))!
    await be.sendFriendRequest(maya.id)
    expect((await be.friends()).map((f) => f.profile.handle)).toEqual(['maya'])
    expect(await be.friendProgress(maya.id)).toMatchObject({ weekStreak: 5 })
    // challenge: she accepts and makes steady progress
    await be.setPermissions(maya.id, { emoji: true, workouts: true })
    const id = await be.sendChallenge({ toId: maya.id, title: 'Run 5 mi', spec: { metric: 'distance', mode: 'total', sport: 'run' }, target: 5, days: 7 })
    const seen: number[] = []
    for (let i = 0; i < 4; i++) seen.push((await be.challenges()).find((c) => c.id === id)!.progress)
    expect(seen[0]).toBeGreaterThan(0)
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
    expect((await be.challenges()).find((c) => c.id === id)).toMatchObject({ status: 'completed', done: true })
    // a workout request is fulfilled because I allowed her to send workouts
    await be.requestWorkout({ toId: maya.id, scope: 'day', note: 'quick one' })
    expect((await be.workoutRequests())[0].status).toBe('fulfilled')
    expect((await be.shares()).some((s) => s.from.handle === 'maya' && s.scope === 'day')).toBe(true)
    // emoji back, only because I allowed emoji
    await be.sendEmoji({ toId: maya.id, emoji: '🎉' })
    expect((await be.emojiMessages()).some((m) => !m.mine && m.emoji === '💪')).toBe(true)
  })

  it('won’t send you emoji you have not allowed', async () => {
    const be = new DemoBackend(mem()); await signUp(be)
    const maya = (await be.findByHandle('maya'))!
    await be.sendFriendRequest(maya.id)
    await be.setPermissions(maya.id, { workouts: true }) // emoji NOT allowed
    await be.sendShare({ toId: maya.id, scope: 'day', title: 'Hi', payload })
    expect((await be.emojiMessages()).filter((m) => !m.mine)).toEqual([])
  })
})

describe('persistence', () => {
  it('survives a reload', async () => {
    const store = mem()
    const first = new DemoBackend(store)
    await first.sendCode('keep@x.com'); await first.verifyCode('keep@x.com', '123456')
    await first.createProfile({ handle: 'keeper', displayName: 'Keeper', avatar: '🔥' })
    const second = new DemoBackend(store)
    expect((await second.myProfile())?.handle).toBe('keeper')
    expect((await second.friendRequests()).incoming).toHaveLength(2)
  })
})
