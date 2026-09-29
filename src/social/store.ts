import { create } from 'zustand'
import type { FriendRequests, SessionUser, SocialBackend } from './backend'
import { getBackend } from './index'
import {
  SocialError,
  type Challenge, type EmojiMessage, type FriendEntry, type Perms, type Profile, type SharedWorkout, type WorkoutRequest,
} from './types'

export type SocialStatus = 'idle' | 'loading' | 'signed-out' | 'needs-profile' | 'ready' | 'error'

interface SocialState {
  backend: SocialBackend
  status: SocialStatus
  user: SessionUser | null
  profile: Profile | null
  friends: FriendEntry[]
  requests: FriendRequests
  shares: SharedWorkout[]
  workoutRequests: WorkoutRequest[]
  challenges: Challenge[]
  emoji: EmojiMessage[]
  error: string | null
  /** Figure out whether someone is signed in and load everything if so. */
  init: () => Promise<void>
  refresh: () => Promise<void>
  /** Run an action against the server, then reload. Returns an error message instead of throwing. */
  act: <T>(fn: (b: SocialBackend) => Promise<T>) => Promise<{ ok: true; value: T } | { ok: false; error: string }>
  signOut: () => Promise<void>
  reset: () => void
}

const empty = { friends: [], requests: { incoming: [], outgoing: [] }, shares: [], workoutRequests: [], challenges: [], emoji: [] }

export const describeError = (e: unknown): string => {
  if (e instanceof SocialError) {
    return (
      {
        handle_taken: 'That handle is already taken.', invalid_handle: 'Handles are 3–20 letters, numbers or underscores.', not_found: 'That is no longer available.',
        not_allowed: 'That isn’t allowed right now. The other person may not have agreed to it.', rate_limited: 'Slow down a little and try again in a minute.',
        expired: 'That challenge has ended.', invalid_code: 'That code didn’t work. Check it and try again.', not_signed_in: 'Please sign in first.',
        network: 'Couldn’t reach the server. Check your connection.', already_exists: 'That already exists.', unavailable: 'Social features aren’t available right now.',
      }[e.code] ?? e.message
    )
  }
  return e instanceof Error ? e.message : 'Something went wrong.'
}

export const useSocial = create<SocialState>()((set, get) => ({
  backend: getBackend(),
  status: 'idle',
  user: null,
  profile: null,
  ...empty,
  error: null,

  init: async () => {
    const { backend } = get()
    set({ status: 'loading', error: null })
    try {
      const user = await backend.currentUser()
      if (!user) return set({ status: 'signed-out', user: null, profile: null, ...empty })
      const profile = await backend.myProfile()
      set({ user, profile, status: profile ? 'ready' : 'needs-profile' })
      if (profile) await get().refresh()
    } catch (e) {
      set({ status: 'error', error: describeError(e) })
    }
  },

  refresh: async () => {
    const { backend, status } = get()
    if (status !== 'ready') return
    try {
      const [friends, requests, shares, workoutRequests, challenges, emoji] = await Promise.all([
        backend.friends(), backend.friendRequests(), backend.shares(), backend.workoutRequests(), backend.challenges(), backend.emojiMessages(),
      ])
      set({ friends, requests, shares, workoutRequests, challenges, emoji, error: null })
    } catch (e) {
      set({ error: describeError(e) })
    }
  },

  act: async (fn) => {
    try {
      const value = await fn(get().backend)
      await get().refresh()
      return { ok: true, value }
    } catch (e) {
      return { ok: false, error: describeError(e) }
    }
  },

  signOut: async () => {
    await get().backend.signOut().catch(() => undefined)
    set({ status: 'signed-out', user: null, profile: null, ...empty })
  },

  reset: () => set({ status: 'idle', user: null, profile: null, ...empty, error: null }),
}))

/** Things waiting on the person: requests to answer, workouts to look at, challenges to accept, unread emoji. */
export function pendingCount(s: Pick<SocialState, 'requests' | 'shares' | 'workoutRequests' | 'challenges' | 'emoji'>): number {
  return (
    s.requests.incoming.length +
    s.shares.filter((x) => !x.mine && x.status === 'pending').length +
    s.workoutRequests.filter((x) => !x.mine && x.status === 'pending').length +
    s.challenges.filter((x) => !x.mine && x.status === 'pending').length +
    s.emoji.filter((x) => !x.mine && !x.read).length
  )
}

export type { Perms }
