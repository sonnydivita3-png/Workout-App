import { useMemo, useState } from 'react'
import { BUILTIN_BY_ID } from '../../data/exercises'
import { fmtLong } from '../../lib/dates'
import { buildPost } from '../../social/posts'
import { useSocial } from '../../social/store'
import type { Post } from '../../social/types'
import { findExercise, useStore } from '../../store'
import { Sheet } from '../Sheet'
import { PostCard } from './PostCard'
import { input, label, primary } from './styles'
import { Avatar, ErrorNote } from './ui'

const POST_EMOJI = ['💪', '🔥', '🏃', '🚴', '🎉', '💯', '😅']

const names = (list: string[]) => (list.length <= 2 ? list.join(' and ') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`)

/**
 * "Look what I did": post a finished workout so friends can cheer it. It goes to the friends who've turned on your
 * posts (all of them unless you untick some), and nothing lands on anyone's calendar.
 */
export function PostSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const { logs, custom, units } = useStore()
  const { friends, profile, act } = useSocial()
  const built = useMemo(() => buildPost(date, logs, (id) => findExercise(custom, id) ?? BUILTIN_BY_ID.get(id), units), [date, logs, custom, units])
  const open = friends.filter((f) => f.theyGrant.posts)
  const closed = friends.filter((f) => !f.theyGrant.posts)
  const [left, setLeft] = useState<Set<string>>(() => new Set()) // friends unticked for this post
  const [title, setTitle] = useState<string | null>(null)
  const [emoji, setEmoji] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string[] | null>(null)
  const [now] = useState(() => new Date().toISOString())

  if (!built) {
    return (
      <Sheet title="Post a workout" onClose={onClose}>
        <p className="py-6 text-center text-sm text-neutral-500">Nothing is logged on {fmtLong(date)} yet. Log a workout, then post it.</p>
      </Sheet>
    )
  }
  const shownTitle = title ?? built.title
  const shownEmoji = emoji ?? built.emoji
  const chosen = open.filter((f) => !left.has(f.profile.id))
  const preview: Post = { id: 'preview', from: profile ?? { id: '', handle: '', displayName: 'You', avatar: '💪' }, date, title: shownTitle || '…', emoji: shownEmoji, payload: built.payload, createdAt: now, mine: true }

  const post = async () => {
    setBusy(true); setError(null)
    const r = await act((b) => b.sendPost({ audience: chosen.map((f) => f.profile.id), date, title: shownTitle.trim().slice(0, 80), emoji: shownEmoji, payload: built.payload }))
    setBusy(false)
    if (r.ok) setSentTo(chosen.map((f) => f.profile.displayName)); else setError(r.error)
  }

  if (sentTo) {
    return (
      <Sheet title="Posted 🎉" onClose={onClose} closeLabel="Done">
        <p className="py-6 text-center text-neutral-600">{names(sentTo)} can cheer you on now. Their cheers show up in Social.</p>
        <button onClick={onClose} className={primary}>Done</button>
      </Sheet>
    )
  }

  return (
    <Sheet title="Post your workout" onClose={onClose} closeLabel="Cancel">
      <p className="mb-4 text-sm text-neutral-500">Show friends what you did so they can cheer you on. It’s just for the high-fives: nothing goes on their calendar.</p>
      <label className={`${label} block`} htmlFor="post-title">Title</label>
      <input id="post-title" value={shownTitle} maxLength={80} onChange={(e) => setTitle(e.target.value)} className={`${input} mb-3`} />
      <div role="group" aria-label="Post emoji" className="mb-4 flex flex-wrap gap-1.5">
        {POST_EMOJI.map((e) => (
          <button key={e} onClick={() => setEmoji(e)} aria-pressed={shownEmoji === e} aria-label={`Emoji ${e}`} className={`h-9 w-9 rounded-full text-lg ${shownEmoji === e ? 'bg-accent' : 'bg-neutral-100'}`}>{e}</button>
        ))}
      </div>

      <p className={label}>What friends see</p>
      <div className="mb-4"><PostCard post={preview} preview /></div>

      <p className={label}>Who sees it</p>
      {friends.length === 0 ? (
        <p className="mb-4 text-sm text-neutral-500">Add friends first (Social → Friends), then post for them to cheer.</p>
      ) : (
        <div className="mb-4 space-y-1.5">
          {open.map((f) => {
            const on = !left.has(f.profile.id)
            return (
              <button
                key={f.profile.id}
                role="checkbox"
                aria-checked={on}
                onClick={() => setLeft((s) => { const n = new Set(s); if (on) n.add(f.profile.id); else n.delete(f.profile.id); return n })}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${on ? 'bg-accent/15 ring-1 ring-accent' : 'bg-neutral-50'}`}
              >
                <Avatar profile={f.profile} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.profile.displayName}</span>
                <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded-md text-xs ${on ? 'bg-accent text-on-accent' : 'ring-1 ring-neutral-300'}`}>{on ? '✓' : ''}</span>
              </button>
            )
          })}
          {closed.length > 0 && (
            <p className="pt-1 text-xs text-neutral-400">
              {open.length === 0 ? 'None of your friends see your posts yet. ' : `Not ${names(closed.map((f) => f.profile.displayName))}: `}
              {open.length === 0 ? 'Each friend turns on “Show me their posts” for you, in their Friends list.' : 'they haven’t turned on “Show me their posts” for you yet.'}
            </p>
          )}
        </div>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      <button disabled={busy || chosen.length === 0 || !shownTitle.trim()} onClick={post} className={primary}>
        {busy ? 'Posting…' : chosen.length ? `Post to ${chosen.length === open.length && open.length > 1 ? `all ${chosen.length}` : names(chosen.map((f) => f.profile.displayName))}` : 'Post'}
      </button>
    </Sheet>
  )
}
