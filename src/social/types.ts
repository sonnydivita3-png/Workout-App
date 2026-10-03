import type { Exercise, PlannedExercise } from '../types'

/** The only messages people can send each other. Keep in sync with the emoji check in the database migration. */
export const EMOJI = ['💪', '🔥', '👏', '🎉', '😅', '🏃', '🚴', '❤️', '👀', '🙌', '💯', '😴'] as const
export type Emoji = (typeof EMOJI)[number]

/** An avatar is an emoji, a letter ('letter:A'), or a small photo stored as an image data URL. */
export type AvatarKind = 'emoji' | 'letter' | 'photo'
export const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/
export const MAX_PHOTO_CHARS = 12000
export const letterAvatar = (l: string) => `letter:${l.trim().charAt(0).toUpperCase() || 'A'}`
export function avatarKind(a: string): AvatarKind {
  if (a.startsWith('data:image/')) return 'photo'
  if (/^letter:[A-Z0-9]$/.test(a)) return 'letter'
  return 'emoji'
}
/** Anything else (long text, other data types) is not a valid avatar. */
export const isValidAvatar = (a: unknown): a is string =>
  typeof a === 'string' && (a.length >= 1 && a.length <= 8 ? true : a.length <= MAX_PHOTO_CHARS && PHOTO_RE.test(a))

export const AVATARS = ['💪', '🏃', '🚴', '🏋️', '🧘', '⚡', '🔥', '🦾', '🐺', '🦅', '🐻', '🌟']

/** What a person can let a friend do. All are off until the person agrees. */
export const PERMISSIONS = [
  { key: 'progress', label: 'See my progress', hint: 'Recent workouts, weekly count, streak and new personal bests. Never body weight, measurements, photos or goals.' },
  { key: 'workouts', label: 'Send me workouts', hint: 'Shared days, weeks or months I can add to my calendar.' },
  { key: 'requests', label: 'Ask me to make them a workout', hint: 'Requests appear in my inbox and I can say no.' },
  { key: 'challenges', label: 'Challenge me', hint: 'Simple challenges like push-ups or a run distance.' },
  { key: 'emoji', label: 'Send me emoji', hint: 'A few emoji reactions. No text.' },
] as const
export type PermKey = (typeof PERMISSIONS)[number]['key']
export type Perms = Record<PermKey, boolean>
export const NO_PERMS: Perms = { progress: false, workouts: false, requests: false, challenges: false, emoji: false }
export const ALL_PERMS: Perms = { progress: true, workouts: true, requests: true, challenges: true, emoji: true }

export interface Profile {
  id: string
  handle: string
  displayName: string
  avatar: string
}

export interface FriendEntry {
  profile: Profile
  /** What I let them do. `reviewed` is false until I've looked at it. */
  iGrant: Perms & { reviewed: boolean }
  /** What they let me do. */
  theyGrant: Perms
}

export interface FriendRequest {
  id: string
  from: Profile
  to: Profile
  createdAt: string
  direction: 'incoming' | 'outgoing'
}

export type Scope = 'day' | 'week' | 'month'

/** A shared plan: one day, seven days, or twenty-eight days, as offsets from a start date the receiver picks. */
export interface SharedPayload {
  version: 1
  scope: Scope
  days: { offset: number; rest: boolean; items: PlannedExercise[] }[]
  /** Custom exercises used, so the receiver can show them. Library exercises are looked up locally. */
  custom: Exercise[]
  /** For a workout shared after doing it: what the sender achieved, for comparison. */
  results?: string[]
}

export interface SharedWorkout {
  id: string
  from: Profile
  to: Profile
  scope: Scope
  title: string
  emoji?: string
  payload: SharedPayload
  status: 'pending' | 'added' | 'dismissed'
  createdAt: string
  /** True when I sent it. */
  mine: boolean
}

export interface WorkoutRequest {
  id: string
  from: Profile // who is asking
  to: Profile // who is asked to make one
  scope: Scope
  note: string
  status: 'pending' | 'fulfilled' | 'declined'
  shareId?: string
  createdAt: string
  mine: boolean
}

export type Metric = 'reps' | 'seconds' | 'weight' | 'distance' | 'minutes' | 'exercises'

export interface ChallengeSpec {
  metric: Metric
  /** 'total' adds up over the challenge, 'best' is the best single set/session, 'workout' is completing a shared workout. */
  mode: 'total' | 'best' | 'workout'
  exercise?: { id: string; name: string; kind: 'strength' | 'cardio'; mode?: 'weight' | 'reps' | 'time'; custom?: Exercise }
  sport?: 'run' | 'bike' | 'any'
  workout?: SharedPayload
  /** What the challenger achieved, shown for comparison ("Pushups 3 × 20"). */
  senderResults?: string[]
}

export interface Challenge {
  id: string
  from: Profile
  to: Profile
  kind: 'total' | 'best' | 'workout'
  title: string
  emoji?: string
  spec: ChallengeSpec
  target: number
  days: number
  status: 'pending' | 'active' | 'completed' | 'declined' | 'cancelled'
  progress: number
  done: boolean
  acceptedAt?: string
  endsAt?: string
  createdAt: string
  mine: boolean
}

export interface EmojiMessage {
  id: string
  from: Profile
  to: Profile
  emoji: Emoji
  contextType?: 'share' | 'challenge' | 'request' | 'progress'
  contextId?: string
  createdAt: string
  read: boolean
  mine: boolean
}

/** A person's published summary. Deliberately excludes body weight, goals, and exact numbers. */
export interface ProgressSnapshot {
  updatedAt: string
  weekWorkouts: number
  weekStreak: number
  /** Last seven days, newest first. */
  recent: { date: string; exercises: string[] }[]
  /** Recent personal bests as short sentences. */
  bests: string[]
}

export type SocialErrorCode =
  | 'handle_taken' | 'invalid_handle' | 'not_found' | 'not_allowed' | 'rate_limited' | 'expired'
  | 'invalid_code' | 'not_signed_in' | 'network' | 'already_exists' | 'unavailable'

export class SocialError extends Error {
  code: SocialErrorCode
  constructor(code: SocialErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'SocialError'
    this.code = code
  }
}

export type ReportReason = 'name' | 'avatar' | 'spam' | 'harassment' | 'other'
export const REPORT_REASONS: [ReportReason, string][] = [
  ['name', 'Offensive handle or name'], ['avatar', 'Offensive avatar'], ['spam', 'Spam'], ['harassment', 'Harassment or bullying'], ['other', 'Something else'],
]

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/
export const normalizeHandle = (s: string) => s.trim().replace(/^@/, '').toLowerCase()
