import { useEffect, useState } from 'react'
import { useSocial } from '../../social/store'
import type { Emoji, PermKey, ProgressSnapshot } from '../../social/types'
import { fmtLong } from '../../lib/dates'
import { Sheet } from '../Sheet'
import { ChallengeSheet } from './ChallengeSheet'
import { EmojiBar } from './EmojiBar'
import { PermissionToggles } from './PermissionToggles'
import { RequestWorkoutSheet } from './RequestWorkoutSheet'
import { ShareSheet } from './ShareSheet'
import { label, secondary } from './styles'
import { Avatar, ErrorNote } from './ui'
import { useToday } from '../../lib/useToday'

/** One friend: their progress (if they allow it), things you can send (if they allow them), and what you allow them. */
export function FriendSheet({ friendId, onClose }: { friendId: string; onClose: () => void }) {
  const today = useToday()
  const { friends, backend, act } = useSocial()
  const friend = friends.find((f) => f.profile.id === friendId)
  const [snap, setSnap] = useState<ProgressSnapshot | null>(null)
  const [sub, setSub] = useState<'share' | 'challenge' | 'request' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'remove' | 'block' | null>(null)
  const canSeeProgress = !!friend?.theyGrant.progress

  useEffect(() => {
    if (!canSeeProgress) return
    let live = true
    backend.friendProgress(friendId).then((s) => { if (live) setSnap(s) }).catch(() => undefined)
    return () => { live = false }
  }, [backend, friendId, canSeeProgress])

  if (!friend) return null
  const { profile, theyGrant, iGrant } = friend

  const sendEmoji = async (e: Emoji) => {
    setError(null)
    const r = await act((b) => b.sendEmoji({ toId: profile.id, emoji: e }))
    if (r.ok) setNote(`${e} sent`); else setError(r.error)
  }
  const setPerm = async (k: PermKey, on: boolean) => {
    const r = await act((b) => b.setPermissions(profile.id, { [k]: on }))
    if (!r.ok) setError(r.error)
  }
  const leave = async (block: boolean) => {
    const r = await act((b) => (block ? b.blockUser(profile.id) : b.removeFriend(profile.id)))
    if (r.ok) onClose(); else setError(r.error)
  }

  if (sub === 'share') return <ShareSheet date={today} friendId={profile.id} onClose={() => setSub(null)} />
  if (sub === 'challenge') return <ChallengeSheet friendId={profile.id} onClose={() => setSub(null)} />
  if (sub === 'request') return <RequestWorkoutSheet friend={friend} onClose={() => setSub(null)} />

  const btn = (ok: boolean, text: string, on: () => void) => (
    <button disabled={!ok} onClick={on} className={secondary}>{text}</button>
  )

  return (
    <Sheet title={profile.displayName} onClose={onClose}>
      <div className="mb-4 flex items-center gap-3">
        <Avatar profile={profile} size="lg" />
        <p className="text-sm text-neutral-400">@{profile.handle}</p>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}

      {!iGrant.reviewed && (
        <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {profile.displayName} can’t do anything with you yet. Choose below what you’re okay with.
        </p>
      )}

      {canSeeProgress && snap && (
        <div className="mb-4 rounded-2xl bg-neutral-50 p-3">
          <p className={label}>Progress</p>
          <p className="text-sm"><b>{snap.weekWorkouts}</b> workout{snap.weekWorkouts === 1 ? '' : 's'} this week · <b>{snap.weekStreak}</b> week streak</p>
          {snap.recent.slice(0, 4).map((r) => (
            <p key={r.date} className="mt-1 text-xs text-neutral-500"><span className="text-neutral-400">{fmtLong(r.date)}</span> · {r.exercises.join(', ')}</p>
          ))}
          {snap.bests.map((b) => <p key={b} className="mt-1 text-xs text-neutral-500">🏅 {b}</p>)}
        </div>
      )}
      {!canSeeProgress && <p className="mb-4 text-xs text-neutral-400">{profile.displayName} hasn’t shared their progress with you.</p>}

      <div className="mb-4 space-y-2">
        {btn(theyGrant.workouts, theyGrant.workouts ? 'Send a workout' : 'Send a workout (not allowed)', () => setSub('share'))}
        {btn(theyGrant.challenges, theyGrant.challenges ? 'Challenge' : 'Challenge (not allowed)', () => setSub('challenge'))}
        {btn(theyGrant.requests, theyGrant.requests ? 'Ask for a workout' : 'Ask for a workout (not allowed)', () => setSub('request'))}
      </div>

      <p className={label}>Send an emoji</p>
      <div className="mb-1"><EmojiBar disabled={!theyGrant.emoji} onPick={sendEmoji} /></div>
      <p className="mb-4 text-xs text-neutral-400" aria-live="polite">{note ?? (theyGrant.emoji ? '' : `${profile.displayName} hasn’t allowed emoji.`)}</p>

      <p className={label}>What {profile.displayName} can do</p>
      <PermissionToggles value={iGrant} onChange={setPerm} />

      <div className="mt-4 flex gap-4 text-sm">
        {confirm === null ? (
          <>
            <button onClick={() => setConfirm('remove')} className="text-neutral-500 underline underline-offset-2">Remove friend</button>
            <button onClick={() => setConfirm('block')} className="text-red-600 underline underline-offset-2">Block</button>
          </>
        ) : (
          <>
            <span className="text-neutral-500">{confirm === 'block' ? 'Block and remove?' : 'Remove this friend?'}</span>
            <button onClick={() => leave(confirm === 'block')} className="font-medium text-red-600">Yes</button>
            <button onClick={() => setConfirm(null)} className="text-neutral-500">No</button>
          </>
        )}
      </div>
    </Sheet>
  )
}
