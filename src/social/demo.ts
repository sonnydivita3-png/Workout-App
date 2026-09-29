import type { PlannedExercise } from '../types'
import type { FriendRequests, SessionUser, SocialBackend } from './backend'
import {
  ALL_PERMS, EMOJI, HANDLE_RE, NO_PERMS, SocialError, isValidAvatar, normalizeHandle,
  type Challenge, type ChallengeSpec, type Emoji, type EmojiMessage, type FriendEntry, type PermKey, type Perms,
  type Profile, type ProgressSnapshot, type Scope, type SharedPayload, type SharedWorkout, type WorkoutRequest,
} from './types'

/**
 * A complete social server that lives in this device's storage, with a few simulated friends. It enforces the
 * same rules as the real database (nothing is allowed until the recipient agrees) so the whole feature can be
 * tried, and tested, without a server. It is NOT shared with other phones.
 */

const DEMO_CODE = '123456'

interface Row { id: string; createdAt: string }
interface Store {
  users: { id: string; email?: string; bot?: boolean }[]
  profiles: Profile[]
  requests: (Row & { fromId: string; toId: string; status: 'pending' | 'accepted' | 'declined' })[]
  friends: { userId: string; friendId: string }[]
  perms: Record<string, Perms & { reviewed: boolean }>
  blocks: { blockerId: string; blockedId: string }[]
  shares: (Row & { fromId: string; toId: string; scope: Scope; title: string; emoji?: string; payload: SharedPayload; status: SharedWorkout['status'] })[]
  wreqs: (Row & { fromId: string; toId: string; scope: Scope; note: string; status: WorkoutRequest['status']; shareId?: string })[]
  challenges: (Row & {
    fromId: string; toId: string; kind: Challenge['kind']; title: string; emoji?: string; spec: ChallengeSpec; target: number; days: number
    status: Challenge['status']; progress: number; done: boolean; acceptedAt?: string; endsAt?: string
  })[]
  emoji: (Row & { fromId: string; toId: string; emoji: Emoji; contextType?: EmojiMessage['contextType']; contextId?: string; readAt?: string })[]
  snapshots: Record<string, ProgressSnapshot>
  meId: string | null
  code?: { email: string; code: string }
  botSent: string[]
  rate: Record<string, number[]>
}

export interface Persistence {
  load(): string | null
  save(json: string): void
}

const KEY = 'ez-social-demo-v1'
export const localPersistence: Persistence = {
  load: () => { try { return localStorage.getItem(KEY) } catch { return null } },
  save: (json) => { try { localStorage.setItem(KEY, json) } catch { /* private mode: keep going in memory */ } },
}

const BOTS: Profile[] = [
  { id: 'bot-alex', handle: 'alex', displayName: 'Alex', avatar: '💪' },
  { id: 'bot-sam', handle: 'sam', displayName: 'Sam', avatar: '🏃' },
  { id: 'bot-maya', handle: 'maya', displayName: 'Maya', avatar: '🚴' },
]

const item = (exerciseId: string, sets: number, extra: Partial<PlannedExercise> = {}): PlannedExercise => ({ exerciseId, sets, ...extra })

/** A week Alex "made": push, pull, legs, and a run. */
function botWeek(): SharedPayload {
  const day = (offset: number, items: PlannedExercise[]) => ({ offset, rest: items.length === 0, items })
  return {
    version: 1,
    scope: 'week',
    custom: [],
    days: [
      day(0, [item('Barbell_Bench_Press_-_Medium_Grip', 3, { reps: 8 }), item('Pushups', 3, { reps: 15 })]),
      day(1, []),
      day(2, [item('Pullups', 3, { reps: 8 }), item('Barbell_Deadlift', 3, { reps: 5 })]),
      day(3, [item('running', 1, { minutes: 30, distance: 3, note: 'Easy run: relaxed and comfortable.' })]),
      day(4, [item('Bodyweight_Squat', 3, { reps: 15 }), item('Plank', 3, { seconds: 45 })]),
      day(5, []),
      day(6, []),
    ],
  }
}

const botSnapshot = (name: string): ProgressSnapshot => ({
  updatedAt: new Date().toISOString(),
  weekWorkouts: name === 'Alex' ? 4 : name === 'Sam' ? 3 : 2,
  weekStreak: name === 'Alex' ? 9 : 5,
  recent: [
    { date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), exercises: ['Barbell Squat', 'Leg Press', 'Plank'] },
    { date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), exercises: ['Running'] },
  ],
  bests: [`${name}: longest run yet, 8 mi`],
})

const uuid = () => crypto.randomUUID()

export class DemoBackend implements SocialBackend {
  readonly kind = 'demo' as const
  private s: Store
  /** Overridable so tests can move time. */
  clock: () => number = () => Date.now()

  private persistence: Persistence

  constructor(persistence: Persistence = localPersistence) {
    this.persistence = persistence
    const saved = persistence.load()
    this.s = saved ? (JSON.parse(saved) as Store) : this.empty()
    if (this.s.users.length === 0) this.seedBots()
  }

  // ------------------------------------------------------------------ plumbing
  private empty(): Store {
    return { users: [], profiles: [], requests: [], friends: [], perms: {}, blocks: [], shares: [], wreqs: [], challenges: [], emoji: [], snapshots: {}, meId: null, botSent: [], rate: {} }
  }
  private seedBots() {
    for (const b of BOTS) {
      this.s.users.push({ id: b.id, bot: true })
      this.s.profiles.push({ ...b })
      this.s.snapshots[b.id] = botSnapshot(b.displayName)
    }
    this.save()
  }
  private save() { this.persistence.save(JSON.stringify(this.s)) }
  private now() { return new Date(this.clock()).toISOString() }
  private me(): string {
    if (!this.s.meId) throw new SocialError('not_signed_in')
    return this.s.meId
  }
  private profile(id: string): Profile {
    const p = this.s.profiles.find((x) => x.id === id)
    if (!p) throw new SocialError('not_found')
    return p
  }
  private isBot = (id: string) => !!this.s.users.find((u) => u.id === id)?.bot
  private isFriend = (a: string, b: string) => this.s.friends.some((f) => f.userId === a && f.friendId === b)
  private blocked = (a: string, b: string) => this.s.blocks.some((x) => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a))
  private perm = (owner: string, friend: string) => this.s.perms[`${owner}>${friend}`]
  /** Did `owner` let `friend` do `key`? */
  private allows(owner: string, friend: string, key: PermKey) { return this.perm(owner, friend)?.[key] === true }
  private limit(kind: string, max: number, minutes: number) {
    const k = `${kind}:${this.me()}`
    const t = this.clock()
    const recent = (this.s.rate[k] ?? []).filter((x) => t - x < minutes * 60000)
    if (recent.length >= max) throw new SocialError('rate_limited')
    this.s.rate[k] = [...recent, t]
  }
  private openRequest(a: string, b: string) {
    return this.s.requests.find((r) => r.status === 'pending' && ((r.fromId === a && r.toId === b) || (r.fromId === b && r.toId === a)))
  }

  // ------------------------------------------------------------------ test helpers (not part of the interface)
  /** Switch which person the calls act as. */
  _actAs(userId: string | null) { this.s.meId = userId }
  _state() { return this.s }
  /** Create a person directly, already signed up (for tests). */
  _addUser(handle: string): string {
    const id = uuid()
    this.s.users.push({ id, email: `${handle}@example.com` })
    this.s.profiles.push({ id, handle, displayName: handle, avatar: '💪' })
    this.save()
    return id
  }

  // ------------------------------------------------------------------ account
  async currentUser(): Promise<SessionUser | null> {
    const u = this.s.users.find((x) => x.id === this.s.meId)
    return u ? { id: u.id, email: u.email } : null
  }
  async sendCode(email: string) {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new SocialError('invalid_code', 'Enter a valid email address.')
    this.s.code = { email: email.trim().toLowerCase(), code: DEMO_CODE }
    this.save()
  }
  async verifyCode(email: string, code: string): Promise<SessionUser> {
    const e = email.trim().toLowerCase()
    if (!this.s.code || this.s.code.email !== e || code.trim() !== this.s.code.code) throw new SocialError('invalid_code')
    let user = this.s.users.find((u) => u.email === e)
    if (!user) { user = { id: uuid(), email: e }; this.s.users.push(user) }
    this.s.meId = user.id
    this.s.code = undefined
    this.save()
    return { id: user.id, email: user.email }
  }
  async signOut() { this.s.meId = null; this.save() }
  async deleteAccount() {
    const me = this.me()
    const s = this.s
    s.profiles = s.profiles.filter((p) => p.id !== me)
    s.users = s.users.filter((u) => u.id !== me)
    s.requests = s.requests.filter((r) => r.fromId !== me && r.toId !== me)
    s.friends = s.friends.filter((f) => f.userId !== me && f.friendId !== me)
    s.perms = Object.fromEntries(Object.entries(s.perms).filter(([k]) => !k.split('>').includes(me)))
    s.blocks = s.blocks.filter((b) => b.blockerId !== me && b.blockedId !== me)
    s.shares = s.shares.filter((x) => x.fromId !== me && x.toId !== me)
    s.wreqs = s.wreqs.filter((x) => x.fromId !== me && x.toId !== me)
    s.challenges = s.challenges.filter((x) => x.fromId !== me && x.toId !== me)
    s.emoji = s.emoji.filter((x) => x.fromId !== me && x.toId !== me)
    delete s.snapshots[me]
    s.botSent = s.botSent.filter((k) => !k.endsWith(`>${me}`))
    s.meId = null
    this.save()
  }

  // ------------------------------------------------------------------ profile
  async myProfile() { return this.s.profiles.find((p) => p.id === this.s.meId) ?? null }
  async createProfile(p: { handle: string; displayName: string; avatar: string }) {
    const me = this.me()
    const handle = normalizeHandle(p.handle)
    if (!HANDLE_RE.test(handle)) throw new SocialError('invalid_handle')
    const name = p.displayName.trim()
    if (name.length < 1 || name.length > 40) throw new SocialError('not_allowed', 'Display name must be 1–40 characters.')
    if (this.s.profiles.some((x) => x.handle === handle)) throw new SocialError('handle_taken')
    if (this.s.profiles.some((x) => x.id === me)) throw new SocialError('already_exists')
    if (p.avatar && !isValidAvatar(p.avatar)) throw new SocialError('not_allowed', 'That avatar isn’t valid.')
    const profile: Profile = { id: me, handle, displayName: name, avatar: p.avatar || '💪' }
    this.s.profiles.push(profile)
    // Give a first-time demo user something to act on: two people have already asked to be friends.
    for (const bot of ['bot-alex', 'bot-sam']) this.s.requests.push({ id: uuid(), createdAt: this.now(), fromId: bot, toId: me, status: 'pending' })
    this.save()
    return profile
  }
  async updateProfile(p: { displayName?: string; avatar?: string }) {
    const me = this.profile(this.me())
    if (p.displayName !== undefined) {
      const n = p.displayName.trim()
      if (n.length < 1 || n.length > 40) throw new SocialError('not_allowed')
      me.displayName = n
    }
    if (p.avatar) {
      if (!isValidAvatar(p.avatar)) throw new SocialError('not_allowed', 'That avatar isn’t valid.')
      me.avatar = p.avatar
    }
    this.save()
    return me
  }
  async findByHandle(handle: string) {
    const me = this.me()
    const h = normalizeHandle(handle)
    const found = this.s.profiles.find((p) => p.handle === h && p.id !== me && !this.blocked(me, p.id))
    return found ?? null
  }

  // ------------------------------------------------------------------ friends
  async friends(): Promise<FriendEntry[]> {
    const me = this.me()
    return this.s.friends.filter((f) => f.userId === me).map((f) => ({
      profile: this.profile(f.friendId),
      iGrant: this.perm(me, f.friendId) ?? { ...NO_PERMS, reviewed: false },
      theyGrant: this.perm(f.friendId, me) ?? { ...NO_PERMS, reviewed: false },
    }))
  }
  async friendRequests(): Promise<FriendRequests> {
    const me = this.me()
    const map = (r: Store['requests'][number], direction: 'incoming' | 'outgoing') => ({ id: r.id, from: this.profile(r.fromId), to: this.profile(r.toId), createdAt: r.createdAt, direction })
    const open = this.s.requests.filter((r) => r.status === 'pending')
    return { incoming: open.filter((r) => r.toId === me).map((r) => map(r, 'incoming')), outgoing: open.filter((r) => r.fromId === me).map((r) => map(r, 'outgoing')) }
  }
  async sendFriendRequest(toId: string) {
    const me = this.me()
    if (toId === me) throw new SocialError('not_allowed')
    this.profile(toId)
    if (this.isFriend(me, toId) || this.blocked(me, toId)) throw new SocialError('not_allowed')
    if (this.openRequest(me, toId)) throw new SocialError('already_exists')
    this.limit('friend_requests', 20, 60)
    const r: Store['requests'][number] = { id: uuid(), createdAt: this.now(), fromId: me, toId, status: 'pending' }
    this.s.requests.push(r)
    // Simulated friends say yes straight away and let you do everything.
    if (this.isBot(toId)) {
      r.status = 'accepted'
      this.makeFriends(me, toId, {}, ALL_PERMS)
    }
    this.save()
  }
  private makeFriends(a: string, b: string, aGrantsB: Partial<Perms>, bGrantsA: Partial<Perms>) {
    for (const [u, f] of [[a, b], [b, a]] as const) if (!this.isFriend(u, f)) this.s.friends.push({ userId: u, friendId: f })
    const set = (owner: string, friend: string, g: Partial<Perms>, reviewed: boolean) => {
      const k = `${owner}>${friend}`
      if (!this.s.perms[k]) this.s.perms[k] = { ...NO_PERMS, ...g, reviewed }
    }
    set(a, b, aGrantsB, this.isBot(a) || Object.keys(aGrantsB).length > 0)
    set(b, a, bGrantsA, this.isBot(b) || Object.keys(bGrantsA).length > 0)
  }
  async respondFriendRequest(id: string, accept: boolean, grant: Partial<Perms> = {}) {
    const me = this.me()
    const r = this.s.requests.find((x) => x.id === id && x.toId === me && x.status === 'pending')
    if (!r) throw new SocialError('not_found')
    if (this.blocked(me, r.fromId)) throw new SocialError('not_allowed')
    r.status = accept ? 'accepted' : 'declined'
    if (accept) {
      // I choose what the requester may do; I start with no permission from them, and they have not reviewed mine yet.
      const mine = { ...NO_PERMS, ...grant }
      this.makeFriends(me, r.fromId, mine, {})
      this.s.perms[`${me}>${r.fromId}`] = { ...mine, reviewed: true }
      if (this.isBot(r.fromId)) {
        this.s.perms[`${r.fromId}>${me}`] = { ...ALL_PERMS, reviewed: true }
        for (const k of Object.keys(mine) as PermKey[]) if (mine[k]) this.botReact(r.fromId, me, k)
      }
    }
    this.save()
  }
  async cancelFriendRequest(id: string) {
    const me = this.me()
    const before = this.s.requests.length
    this.s.requests = this.s.requests.filter((r) => !(r.id === id && r.fromId === me && r.status === 'pending'))
    if (this.s.requests.length === before) throw new SocialError('not_found')
    this.save()
  }
  async removeFriend(friendId: string) {
    const me = this.me()
    const s = this.s
    const pair = (a: string, b: string) => (a === me && b === friendId) || (a === friendId && b === me)
    s.friends = s.friends.filter((f) => !pair(f.userId, f.friendId))
    delete s.perms[`${me}>${friendId}`]
    delete s.perms[`${friendId}>${me}`]
    s.shares = s.shares.filter((x) => !(x.status === 'pending' && pair(x.fromId, x.toId)))
    s.wreqs = s.wreqs.filter((x) => !(x.status === 'pending' && pair(x.fromId, x.toId)))
    for (const c of s.challenges) if ((c.status === 'pending' || c.status === 'active') && pair(c.fromId, c.toId)) c.status = 'cancelled'
    s.requests = s.requests.filter((r) => !(r.status === 'pending' && pair(r.fromId, r.toId)))
    s.botSent = s.botSent.filter((k) => !k.startsWith(`${friendId}>`))
    this.save()
  }
  async blockUser(userId: string) {
    const me = this.me()
    if (userId === me) throw new SocialError('not_allowed')
    if (!this.s.blocks.some((b) => b.blockerId === me && b.blockedId === userId)) this.s.blocks.push({ blockerId: me, blockedId: userId })
    await this.removeFriend(userId)
  }
  async setPermissions(friendId: string, perms: Partial<Perms>) {
    const me = this.me()
    if (!this.isFriend(me, friendId)) throw new SocialError('not_found')
    const k = `${me}>${friendId}`
    const before = this.s.perms[k] ?? { ...NO_PERMS, reviewed: false }
    this.s.perms[k] = { ...before, ...perms, reviewed: true }
    if (this.isBot(friendId)) for (const key of Object.keys(perms) as PermKey[]) if (perms[key] && !before[key]) this.botReact(friendId, me, key)
    this.save()
  }

  // ------------------------------------------------------------------ shared workouts
  async sendShare(p: { toId: string; scope: Scope; title: string; emoji?: string; payload: SharedPayload }) {
    const me = this.me()
    if (!this.isFriend(me, p.toId) || !this.allows(p.toId, me, 'workouts')) throw new SocialError('not_allowed')
    if (p.title.trim().length < 1 || p.title.length > 80 || JSON.stringify(p.payload).length > 262144) throw new SocialError('not_allowed')
    this.limit('shares', 30, 60)
    const row = { id: uuid(), createdAt: this.now(), fromId: me, toId: p.toId, scope: p.scope, title: p.title.trim(), emoji: p.emoji, payload: p.payload, status: 'pending' as const }
    this.s.shares.push(row)
    if (this.isBot(p.toId)) this.botEmoji(p.toId, me, '🔥', 'share', row.id)
    this.save()
    return row.id
  }
  async shares(): Promise<SharedWorkout[]> {
    const me = this.me()
    return this.s.shares.filter((x) => x.fromId === me || x.toId === me).map((x) => ({
      id: x.id, from: this.profile(x.fromId), to: this.profile(x.toId), scope: x.scope, title: x.title, emoji: x.emoji,
      payload: x.payload, status: x.status, createdAt: x.createdAt, mine: x.fromId === me,
    }))
  }
  async respondShare(id: string, added: boolean) {
    const x = this.s.shares.find((r) => r.id === id && r.toId === this.me() && r.status === 'pending')
    if (!x) throw new SocialError('not_found')
    x.status = added ? 'added' : 'dismissed'
    this.save()
  }
  async withdrawShare(id: string) {
    const me = this.me()
    const before = this.s.shares.length
    this.s.shares = this.s.shares.filter((x) => !(x.id === id && x.fromId === me && x.status === 'pending'))
    if (before === this.s.shares.length) throw new SocialError('not_found')
    this.save()
  }

  // ------------------------------------------------------------------ "make me a workout"
  async requestWorkout(p: { toId: string; scope: Scope; note: string }) {
    const me = this.me()
    if (!this.isFriend(me, p.toId) || !this.allows(p.toId, me, 'requests') || p.note.length > 140) throw new SocialError('not_allowed')
    this.limit('workout_requests', 20, 60)
    const row: Store['wreqs'][number] = { id: uuid(), createdAt: this.now(), fromId: me, toId: p.toId, scope: p.scope, note: p.note.trim(), status: 'pending' }
    this.s.wreqs.push(row)
    // A simulated friend makes you one if you've allowed them to send you workouts.
    if (this.isBot(p.toId) && this.allows(me, p.toId, 'workouts')) {
      const shareId = this.botShare(p.toId, me, p.scope === 'day' ? 'day' : 'week')
      row.status = 'fulfilled'
      row.shareId = shareId
    }
    this.save()
  }
  async workoutRequests(): Promise<WorkoutRequest[]> {
    const me = this.me()
    return this.s.wreqs.filter((x) => x.fromId === me || x.toId === me).map((x) => ({
      id: x.id, from: this.profile(x.fromId), to: this.profile(x.toId), scope: x.scope, note: x.note, status: x.status, shareId: x.shareId, createdAt: x.createdAt, mine: x.fromId === me,
    }))
  }
  async respondWorkoutRequest(id: string, action: 'fulfill' | 'decline', shareId?: string) {
    const me = this.me()
    const r = this.s.wreqs.find((x) => x.id === id && x.toId === me && x.status === 'pending')
    if (!r) throw new SocialError('not_found')
    if (action === 'fulfill') {
      if (!shareId || !this.s.shares.some((x) => x.id === shareId && x.fromId === me && x.toId === r.fromId)) throw new SocialError('not_allowed')
      r.status = 'fulfilled'
      r.shareId = shareId
    } else if (action === 'decline') r.status = 'declined'
    else throw new SocialError('not_allowed')
    this.save()
  }

  // ------------------------------------------------------------------ challenges
  async sendChallenge(p: { toId: string; title: string; emoji?: string; spec: ChallengeSpec; target: number; days: number }) {
    const me = this.me()
    if (!this.isFriend(me, p.toId) || !this.allows(p.toId, me, 'challenges')) throw new SocialError('not_allowed')
    if (!(p.target > 0) || p.days < 1 || p.days > 90 || p.title.trim().length < 1 || p.title.length > 80) throw new SocialError('not_allowed')
    this.limit('challenges', 30, 60)
    const row = {
      id: uuid(), createdAt: this.now(), fromId: me, toId: p.toId, kind: p.spec.mode, title: p.title.trim(), emoji: p.emoji, spec: p.spec,
      target: p.target, days: p.days, status: 'pending' as Challenge['status'], progress: 0, done: false, acceptedAt: undefined as string | undefined, endsAt: undefined as string | undefined,
    }
    this.s.challenges.push(row)
    if (this.isBot(p.toId)) this.acceptChallenge(row)
    this.save()
    return row.id
  }
  private acceptChallenge(c: Store['challenges'][number]) {
    c.status = 'active'
    c.acceptedAt = this.now()
    c.endsAt = new Date(this.clock() + c.days * 86400000).toISOString()
  }
  async challenges(): Promise<Challenge[]> {
    const me = this.me()
    // Simulated friends make steady progress on challenges you sent them.
    for (const c of this.s.challenges) {
      if (c.fromId === me && c.status === 'active' && this.isBot(c.toId)) {
        c.progress = Math.min(c.target, c.progress + Math.ceil(c.target * 0.34))
        if (c.progress >= c.target) { c.done = true; c.status = 'completed' }
      }
    }
    this.save()
    return this.s.challenges.filter((c) => c.fromId === me || c.toId === me).map((c) => ({
      id: c.id, from: this.profile(c.fromId), to: this.profile(c.toId), kind: c.kind, title: c.title, emoji: c.emoji, spec: c.spec, target: c.target,
      days: c.days, status: c.status, progress: c.progress, done: c.done, acceptedAt: c.acceptedAt, endsAt: c.endsAt, createdAt: c.createdAt, mine: c.fromId === me,
    }))
  }
  async respondChallenge(id: string, accept: boolean) {
    const c = this.s.challenges.find((x) => x.id === id && x.toId === this.me() && x.status === 'pending')
    if (!c) throw new SocialError('not_found')
    if (accept) this.acceptChallenge(c)
    else c.status = 'declined'
    this.save()
  }
  async reportProgress(id: string, progress: number, done: boolean) {
    const c = this.s.challenges.find((x) => x.id === id && x.toId === this.me() && x.status === 'active')
    if (!c) throw new SocialError('not_found')
    if (this.clock() > new Date(c.endsAt!).getTime() + 86400000) throw new SocialError('expired')
    c.progress = Math.max(0, progress)
    c.done = done
    c.status = done ? 'completed' : 'active'
    this.save()
  }
  async cancelChallenge(id: string) {
    const c = this.s.challenges.find((x) => x.id === id && x.fromId === this.me() && (x.status === 'pending' || x.status === 'active'))
    if (!c) throw new SocialError('not_found')
    c.status = 'cancelled'
    this.save()
  }

  // ------------------------------------------------------------------ emoji
  async sendEmoji(p: { toId: string; emoji: Emoji; contextType?: EmojiMessage['contextType']; contextId?: string }) {
    const me = this.me()
    if (!this.isFriend(me, p.toId) || !this.allows(p.toId, me, 'emoji') || !EMOJI.includes(p.emoji)) throw new SocialError('not_allowed')
    this.limit('emoji', 20, 1)
    this.s.emoji.push({ id: uuid(), createdAt: this.now(), fromId: me, toId: p.toId, emoji: p.emoji, contextType: p.contextType, contextId: p.contextId })
    if (this.isBot(p.toId)) this.botEmoji(p.toId, me, '💪')
    this.save()
  }
  async emojiMessages(): Promise<EmojiMessage[]> {
    const me = this.me()
    return this.s.emoji.filter((x) => x.fromId === me || x.toId === me).map((x) => ({
      id: x.id, from: this.profile(x.fromId), to: this.profile(x.toId), emoji: x.emoji, contextType: x.contextType, contextId: x.contextId, createdAt: x.createdAt, read: !!x.readAt, mine: x.fromId === me,
    }))
  }
  async markEmojiRead(ids: string[]) {
    const me = this.me()
    for (const x of this.s.emoji) if (x.toId === me && !x.readAt && ids.includes(x.id)) x.readAt = this.now()
    this.save()
  }

  // ------------------------------------------------------------------ progress
  async publishProgress(snapshot: ProgressSnapshot) {
    this.s.snapshots[this.me()] = snapshot
    this.save()
  }
  async friendProgress(friendId: string) {
    const me = this.me()
    if (!this.isFriend(me, friendId) || !this.allows(friendId, me, 'progress')) return null
    return this.s.snapshots[friendId] ?? null
  }

  // ------------------------------------------------------------------ simulated friends
  /** After you agree to something, the simulated friend acts on it once, like a real friend might. */
  private botReact(bot: string, me: string, key: PermKey) {
    const tag = `${bot}>${me}:${key}`
    if (this.s.botSent.includes(tag)) return
    this.s.botSent.push(tag)
    if (key === 'workouts') this.botShare(bot, me, 'week')
    else if (key === 'challenges') {
      this.s.challenges.push({
        id: uuid(), createdAt: this.now(), fromId: bot, toId: me, kind: 'total', title: '100 push-ups this week', emoji: '💪',
        spec: { metric: 'reps', mode: 'total', exercise: { id: 'Pushups', name: 'Pushups', kind: 'strength', mode: 'reps' } }, target: 100, days: 7,
        status: 'pending', progress: 0, done: false,
      })
    } else if (key === 'requests') this.s.wreqs.push({ id: uuid(), createdAt: this.now(), fromId: bot, toId: me, scope: 'week', note: 'Legs please 🙏', status: 'pending' })
    else if (key === 'emoji') this.botEmoji(bot, me, '👏')
  }
  private botShare(bot: string, me: string, scope: Scope): string {
    const week = botWeek()
    const payload: SharedPayload = scope === 'day' ? { ...week, scope: 'day', days: [week.days[0]] } : week
    const row = { id: uuid(), createdAt: this.now(), fromId: bot, toId: me, scope, title: scope === 'day' ? 'Push day' : 'Push / pull / legs week', emoji: '🔥', payload, status: 'pending' as const }
    this.s.shares.push(row)
    return row.id
  }
  private botEmoji(bot: string, me: string, emoji: Emoji, contextType?: EmojiMessage['contextType'], contextId?: string) {
    if (!this.allows(me, bot, 'emoji')) return // respects your permission like a real friend must
    this.s.emoji.push({ id: uuid(), createdAt: this.now(), fromId: bot, toId: me, emoji, contextType, contextId })
  }
}
