import type {
  Challenge, ChallengeSpec, Emoji, EmojiMessage, FriendEntry, FriendRequest, PermKey, Perms, ProgressSnapshot, Profile,
  ReportReason, Scope, SharedPayload, SharedWorkout, WorkoutRequest,
} from './types'

export interface SessionUser {
  id: string
  email?: string
  /** Signed in without an email. The account lives on this device unless an email is added. */
  anonymous?: boolean
}

export interface FriendRequests {
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
}

/**
 * Everything the app needs from a social server. There are two implementations: Supabase (real) and a
 * local demo with simulated friends. Both follow the same rules: nothing reaches a person until they
 * have agreed to it.
 */
export interface SocialBackend {
  readonly kind: 'supabase' | 'demo'

  // ---- account (email code sign-in, no passwords)
  currentUser(): Promise<SessionUser | null>
  sendCode(email: string): Promise<void>
  verifyCode(email: string, code: string): Promise<SessionUser>
  /** Start an account without an email. It lives on this device until an email is added. */
  signInAnonymously(): Promise<SessionUser>
  /** Attach an email to the current account (sends a code) so it can be recovered on another device. */
  addEmail(email: string): Promise<void>
  confirmEmail(email: string, code: string): Promise<SessionUser>
  signOut(): Promise<void>
  /** Deletes the social account and all its server data. Local workouts are untouched. */
  deleteAccount(): Promise<void>

  // ---- profile
  myProfile(): Promise<Profile | null>
  createProfile(p: { handle: string; displayName: string; avatar: string }): Promise<Profile>
  updateProfile(p: { displayName?: string; avatar?: string }): Promise<Profile>
  /** Exact handle only. */
  findByHandle(handle: string): Promise<Profile | null>

  // ---- friends
  friends(): Promise<FriendEntry[]>
  friendRequests(): Promise<FriendRequests>
  sendFriendRequest(toId: string): Promise<void>
  /** Accepting also records what the accepter agrees to let the new friend do. */
  respondFriendRequest(id: string, accept: boolean, grant?: Partial<Perms>): Promise<void>
  cancelFriendRequest(id: string): Promise<void>
  removeFriend(friendId: string): Promise<void>
  blockUser(userId: string): Promise<void>
  /** Flag someone for the app owner to review. Nobody else can read reports. */
  reportUser(userId: string, reason: ReportReason, note?: string): Promise<void>
  setPermissions(friendId: string, perms: Partial<Perms>): Promise<void>

  // ---- shared workouts
  sendShare(p: { toId: string; scope: Scope; title: string; emoji?: string; payload: SharedPayload }): Promise<string>
  shares(): Promise<SharedWorkout[]>
  respondShare(id: string, added: boolean): Promise<void>
  withdrawShare(id: string): Promise<void>

  // ---- "make me a workout"
  requestWorkout(p: { toId: string; scope: Scope; note: string }): Promise<void>
  workoutRequests(): Promise<WorkoutRequest[]>
  respondWorkoutRequest(id: string, action: 'fulfill' | 'decline', shareId?: string): Promise<void>

  // ---- challenges
  sendChallenge(p: { toId: string; title: string; emoji?: string; spec: ChallengeSpec; target: number; days: number }): Promise<string>
  challenges(): Promise<Challenge[]>
  respondChallenge(id: string, accept: boolean): Promise<void>
  reportProgress(id: string, progress: number, done: boolean): Promise<void>
  cancelChallenge(id: string): Promise<void>

  // ---- emoji
  sendEmoji(p: { toId: string; emoji: Emoji; contextType?: EmojiMessage['contextType']; contextId?: string }): Promise<void>
  emojiMessages(): Promise<EmojiMessage[]>
  markEmojiRead(ids: string[]): Promise<void>

  // ---- cloud backup of your own workout data
  pullData(): Promise<{ data: unknown; updatedAt: string } | null>
  /** Returns the server's new timestamp. */
  pushData(data: unknown): Promise<string>

  // ---- progress sharing
  publishProgress(snapshot: ProgressSnapshot): Promise<void>
  friendProgress(friendId: string): Promise<ProgressSnapshot | null>
}

export type { PermKey }
