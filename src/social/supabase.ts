import type { SupabaseClient } from '@supabase/supabase-js'
import type { FriendRequests, SessionUser, SocialBackend } from './backend'
import {
  HANDLE_RE, NO_PERMS, SocialError,
  type Challenge, type ChallengeSpec, type Emoji, type EmojiMessage, type FriendEntry, type FriendRequest, type PermKey, type Perms,
  type ProgressSnapshot, type Profile, type Scope, type SharedPayload, type SharedWorkout, type WorkoutRequest,
} from './types'

type Row = Record<string, any>

const PERM_KEYS: PermKey[] = ['progress', 'workouts', 'requests', 'challenges', 'emoji']
const GONE = (id: string): Profile => ({ id, handle: 'unknown', displayName: 'Former friend', avatar: '👤' })

const toProfile = (r: Row): Profile => ({ id: r.id, handle: r.handle, displayName: r.display_name, avatar: r.avatar })
const permsOf = (r: Row | undefined): Perms => (r ? Object.fromEntries(PERM_KEYS.map((k) => [k, !!r[k]])) as Perms : { ...NO_PERMS })

/** Turn a Supabase/Postgres error into a SocialError the UI knows how to describe. */
export function mapError(e: unknown): SocialError {
  if (e instanceof SocialError) return e
  const err = (e ?? {}) as { code?: string; message?: string; status?: number }
  const msg = err.message ?? ''
  if (/invalid.*(token|otp|code)|token has expired|expired.*token/i.test(msg)) return new SocialError('invalid_code')
  if (/already.*registered|email_exists/i.test(msg)) return new SocialError('already_exists', 'That email is already used by another account.')
  if (/anonymous sign-?ins? (are )?disabled/i.test(msg)) return new SocialError('unavailable', 'Sign-up without an email isn’t turned on for this app yet.')
  if (/^rate_limited$/.test(msg)) return new SocialError('rate_limited')
  if (/^not_found$/.test(msg)) return new SocialError('not_found')
  if (/^expired$/.test(msg)) return new SocialError('expired')
  if (/not_allowed|row-level security/i.test(msg) || err.code === '42501') return new SocialError('not_allowed')
  if (err.code === '23505') return /handle/.test(msg) ? new SocialError('handle_taken') : new SocialError('already_exists')
  if (err.code === '23514') return new SocialError('invalid_handle')
  if (/fetch|network/i.test(msg)) return new SocialError('network')
  return new SocialError('unavailable', msg || undefined)
}

const ok = <T>(r: { data: T | null; error: unknown }): T => {
  if (r.error) throw mapError(r.error)
  return r.data as T
}

/** The real backend. Every rule that matters is enforced by row-level security in the database migration. */
export class SupabaseBackend implements SocialBackend {
  readonly kind = 'supabase' as const
  private client: Promise<SupabaseClient>

  constructor(url: string, anonKey: string) {
    this.client = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }),
    )
  }

  private async db() { return this.client }
  private async me(): Promise<string> {
    const u = await this.currentUser()
    if (!u) throw new SocialError('not_signed_in')
    return u.id
  }

  // ---- account
  async currentUser(): Promise<SessionUser | null> {
    const c = await this.db()
    const { data } = await c.auth.getSession()
    const u = data.session?.user
    return u ? { id: u.id, email: u.email || undefined, anonymous: !!u.is_anonymous } : null
  }
  async sendCode(email: string) {
    const c = await this.db()
    const { error } = await c.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
    if (error) throw mapError(error)
  }
  async verifyCode(email: string, code: string): Promise<SessionUser> {
    const c = await this.db()
    const { data, error } = await c.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    if (error || !data.user) throw mapError(error ?? new Error('invalid code'))
    return { id: data.user.id, email: data.user.email ?? undefined, anonymous: !!data.user.is_anonymous }
  }
  async signInAnonymously(): Promise<SessionUser> {
    const c = await this.db()
    const { data, error } = await c.auth.signInAnonymously()
    if (error || !data.user) throw mapError(error ?? new Error('unavailable'))
    return { id: data.user.id, anonymous: true }
  }
  async addEmail(email: string) {
    const c = await this.db()
    const { error } = await c.auth.updateUser({ email: email.trim() })
    if (error) throw mapError(error)
  }
  async confirmEmail(email: string, code: string): Promise<SessionUser> {
    const c = await this.db()
    const { data, error } = await c.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email_change' })
    if (error || !data.user) throw mapError(error ?? new Error('invalid code'))
    return { id: data.user.id, email: data.user.email || undefined, anonymous: false }
  }
  async signOut() {
    const c = await this.db()
    await c.auth.signOut()
  }
  async deleteAccount() {
    const c = await this.db()
    ok(await c.rpc('delete_my_account'))
    await c.auth.signOut()
  }

  // ---- profiles
  private async profilesById(ids: string[]): Promise<Map<string, Profile>> {
    const unique = [...new Set(ids)]
    const map = new Map<string, Profile>()
    if (unique.length === 0) return map
    const c = await this.db()
    const rows = ok(await c.from('profiles').select('id, handle, display_name, avatar').in('id', unique)) as Row[]
    for (const r of rows) map.set(r.id, toProfile(r))
    return map
  }
  async myProfile(): Promise<Profile | null> {
    const id = await this.me()
    const c = await this.db()
    const r = ok(await c.from('profiles').select('id, handle, display_name, avatar').eq('id', id).maybeSingle()) as Row | null
    return r ? toProfile(r) : null
  }
  async createProfile(p: { handle: string; displayName: string; avatar: string }): Promise<Profile> {
    const id = await this.me()
    if (!HANDLE_RE.test(p.handle)) throw new SocialError('invalid_handle')
    const c = await this.db()
    const r = ok(await c.from('profiles').insert({ id, handle: p.handle, display_name: p.displayName, avatar: p.avatar }).select('id, handle, display_name, avatar').single()) as Row
    return toProfile(r)
  }
  async updateProfile(p: { displayName?: string; avatar?: string }): Promise<Profile> {
    const id = await this.me()
    const c = await this.db()
    const patch: Row = {}
    if (p.displayName !== undefined) patch.display_name = p.displayName
    if (p.avatar !== undefined) patch.avatar = p.avatar
    const r = ok(await c.from('profiles').update(patch).eq('id', id).select('id, handle, display_name, avatar').single()) as Row
    return toProfile(r)
  }
  async findByHandle(handle: string): Promise<Profile | null> {
    const c = await this.db()
    const rows = ok(await c.rpc('find_profile', { p_handle: handle })) as Row[] | null
    return rows && rows[0] ? toProfile(rows[0]) : null
  }

  // ---- friends
  async friends(): Promise<FriendEntry[]> {
    const id = await this.me()
    const c = await this.db()
    const rel = ok(await c.from('friends').select('friend_id').eq('user_id', id)) as Row[]
    const ids = rel.map((r) => r.friend_id as string)
    if (ids.length === 0) return []
    const [profiles, perms] = await Promise.all([
      this.profilesById(ids),
      c.from('friend_permissions').select('*').or(`owner_id.eq.${id},friend_id.eq.${id}`),
    ])
    const rows = ok(perms) as Row[]
    return ids.map((fid) => {
      const mine = rows.find((r) => r.owner_id === id && r.friend_id === fid)
      const theirs = rows.find((r) => r.owner_id === fid && r.friend_id === id)
      return { profile: profiles.get(fid) ?? GONE(fid), iGrant: { ...permsOf(mine), reviewed: !!mine?.reviewed }, theyGrant: permsOf(theirs) }
    }).sort((a, b) => a.profile.displayName.localeCompare(b.profile.displayName))
  }
  async friendRequests(): Promise<FriendRequests> {
    const id = await this.me()
    const c = await this.db()
    const rows = ok(await c.from('friend_requests').select('id, from_id, to_id, created_at').eq('status', 'pending').order('created_at', { ascending: false })) as Row[]
    const profiles = await this.profilesById(rows.flatMap((r) => [r.from_id, r.to_id]))
    const build = (r: Row, direction: FriendRequest['direction']): FriendRequest => ({
      id: r.id, from: profiles.get(r.from_id) ?? GONE(r.from_id), to: profiles.get(r.to_id) ?? GONE(r.to_id), createdAt: r.created_at, direction,
    })
    return {
      incoming: rows.filter((r) => r.to_id === id).map((r) => build(r, 'incoming')),
      outgoing: rows.filter((r) => r.from_id === id).map((r) => build(r, 'outgoing')),
    }
  }
  async sendFriendRequest(toId: string) {
    const id = await this.me()
    const c = await this.db()
    ok(await c.from('friend_requests').insert({ from_id: id, to_id: toId }))
  }
  async respondFriendRequest(id: string, accept: boolean, grant: Partial<Perms> = {}) {
    const c = await this.db()
    ok(await c.rpc('respond_friend_request', { p_id: id, p_accept: accept, p_grant: accept ? grant : {} }))
  }
  async cancelFriendRequest(id: string) {
    const c = await this.db()
    ok(await c.from('friend_requests').delete().eq('id', id))
  }
  async removeFriend(friendId: string) {
    const c = await this.db()
    ok(await c.rpc('remove_friend', { p_friend: friendId }))
  }
  async blockUser(userId: string) {
    const c = await this.db()
    ok(await c.rpc('block_user', { p_user: userId }))
  }
  async setPermissions(friendId: string, perms: Partial<Perms>) {
    const id = await this.me()
    const c = await this.db()
    ok(await c.from('friend_permissions').update({ ...perms, reviewed: true, updated_at: new Date().toISOString() }).eq('owner_id', id).eq('friend_id', friendId))
  }

  // ---- shared workouts
  async sendShare(p: { toId: string; scope: Scope; title: string; emoji?: string; payload: SharedPayload }): Promise<string> {
    const id = await this.me()
    const c = await this.db()
    const r = ok(await c.from('shared_workouts').insert({ from_id: id, to_id: p.toId, scope: p.scope, title: p.title, emoji: p.emoji ?? null, payload: p.payload }).select('id').single()) as Row
    return r.id
  }
  async shares(): Promise<SharedWorkout[]> {
    const id = await this.me()
    const c = await this.db()
    const rows = ok(await c.from('shared_workouts').select('*').order('created_at', { ascending: false }).limit(100)) as Row[]
    const profiles = await this.profilesById(rows.flatMap((r) => [r.from_id, r.to_id]))
    return rows.map((r) => ({
      id: r.id, from: profiles.get(r.from_id) ?? GONE(r.from_id), to: profiles.get(r.to_id) ?? GONE(r.to_id), scope: r.scope, title: r.title,
      emoji: r.emoji ?? undefined, payload: r.payload, status: r.status, createdAt: r.created_at, mine: r.from_id === id,
    }))
  }
  async respondShare(id: string, added: boolean) {
    const c = await this.db()
    ok(await c.rpc('respond_shared_workout', { p_id: id, p_added: added }))
  }
  async withdrawShare(id: string) {
    const c = await this.db()
    ok(await c.from('shared_workouts').delete().eq('id', id))
  }

  // ---- workout requests
  async requestWorkout(p: { toId: string; scope: Scope; note: string }) {
    const id = await this.me()
    const c = await this.db()
    ok(await c.from('workout_requests').insert({ from_id: id, to_id: p.toId, scope: p.scope, note: p.note }))
  }
  async workoutRequests(): Promise<WorkoutRequest[]> {
    const id = await this.me()
    const c = await this.db()
    const rows = ok(await c.from('workout_requests').select('*').order('created_at', { ascending: false }).limit(100)) as Row[]
    const profiles = await this.profilesById(rows.flatMap((r) => [r.from_id, r.to_id]))
    return rows.map((r) => ({
      id: r.id, from: profiles.get(r.from_id) ?? GONE(r.from_id), to: profiles.get(r.to_id) ?? GONE(r.to_id), scope: r.scope, note: r.note,
      status: r.status, shareId: r.share_id ?? undefined, createdAt: r.created_at, mine: r.from_id === id,
    }))
  }
  async respondWorkoutRequest(id: string, action: 'fulfill' | 'decline', shareId?: string) {
    const c = await this.db()
    ok(await c.rpc('respond_workout_request', { p_id: id, p_action: action, p_share: shareId ?? null }))
  }

  // ---- challenges
  async sendChallenge(p: { toId: string; title: string; emoji?: string; spec: ChallengeSpec; target: number; days: number }): Promise<string> {
    const id = await this.me()
    const c = await this.db()
    const r = ok(await c.from('challenges').insert({ from_id: id, to_id: p.toId, kind: p.spec.mode, title: p.title, emoji: p.emoji ?? null, spec: p.spec, target: p.target, days: p.days }).select('id').single()) as Row
    return r.id
  }
  async challenges(): Promise<Challenge[]> {
    const id = await this.me()
    const c = await this.db()
    const rows = ok(await c.from('challenges').select('*').order('created_at', { ascending: false }).limit(100)) as Row[]
    const profiles = await this.profilesById(rows.flatMap((r) => [r.from_id, r.to_id]))
    return rows.map((r) => ({
      id: r.id, from: profiles.get(r.from_id) ?? GONE(r.from_id), to: profiles.get(r.to_id) ?? GONE(r.to_id), kind: r.kind, title: r.title,
      emoji: r.emoji ?? undefined, spec: r.spec, target: Number(r.target), days: r.days, status: r.status, progress: Number(r.progress), done: r.done,
      acceptedAt: r.accepted_at ?? undefined, endsAt: r.ends_at ?? undefined, createdAt: r.created_at, mine: r.from_id === id,
    }))
  }
  async respondChallenge(id: string, accept: boolean) {
    const c = await this.db()
    ok(await c.rpc('respond_challenge', { p_id: id, p_accept: accept }))
  }
  async reportProgress(id: string, progress: number, done: boolean) {
    const c = await this.db()
    ok(await c.rpc('report_challenge_progress', { p_id: id, p_progress: progress, p_done: done }))
  }
  async cancelChallenge(id: string) {
    const c = await this.db()
    ok(await c.rpc('cancel_challenge', { p_id: id }))
  }

  // ---- emoji
  async sendEmoji(p: { toId: string; emoji: Emoji; contextType?: EmojiMessage['contextType']; contextId?: string }) {
    const id = await this.me()
    const c = await this.db()
    ok(await c.from('emoji_messages').insert({ from_id: id, to_id: p.toId, emoji: p.emoji, context_type: p.contextType ?? null, context_id: p.contextId ?? null }))
  }
  async emojiMessages(): Promise<EmojiMessage[]> {
    const id = await this.me()
    const c = await this.db()
    const rows = ok(await c.from('emoji_messages').select('*').order('created_at', { ascending: false }).limit(60)) as Row[]
    const profiles = await this.profilesById(rows.flatMap((r) => [r.from_id, r.to_id]))
    return rows.map((r) => ({
      id: r.id, from: profiles.get(r.from_id) ?? GONE(r.from_id), to: profiles.get(r.to_id) ?? GONE(r.to_id), emoji: r.emoji,
      contextType: r.context_type ?? undefined, contextId: r.context_id ?? undefined, createdAt: r.created_at, read: !!r.read_at, mine: r.from_id === id,
    }))
  }
  async markEmojiRead(ids: string[]) {
    if (ids.length === 0) return
    const c = await this.db()
    ok(await c.rpc('mark_emoji_read', { p_ids: ids }))
  }

  // ---- cloud backup
  async pullData(): Promise<{ data: unknown; updatedAt: string } | null> {
    const id = await this.me()
    const c = await this.db()
    const r = ok(await c.from('user_data').select('data, updated_at').eq('user_id', id).maybeSingle()) as Row | null
    return r ? { data: r.data, updatedAt: r.updated_at } : null
  }
  async pushData(data: unknown): Promise<string> {
    const id = await this.me()
    const c = await this.db()
    const r = ok(await c.from('user_data').upsert({ user_id: id, data, updated_at: new Date().toISOString() }).select('updated_at').single()) as Row
    return r.updated_at
  }

  // ---- progress
  async publishProgress(snapshot: ProgressSnapshot) {
    const id = await this.me()
    const c = await this.db()
    ok(await c.from('progress_snapshots').upsert({ user_id: id, data: snapshot, updated_at: new Date().toISOString() }))
  }
  async friendProgress(friendId: string): Promise<ProgressSnapshot | null> {
    const c = await this.db()
    const r = ok(await c.from('progress_snapshots').select('data').eq('user_id', friendId).maybeSingle()) as Row | null
    return r ? (r.data as ProgressSnapshot) : null
  }
}
