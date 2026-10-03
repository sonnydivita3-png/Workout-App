import { useState } from 'react'
import { fmtLong, toISO } from '../../lib/dates'
import { describePostItem, postItemName } from '../../social/posts'
import { useSocial } from '../../social/store'
import type { Emoji, Post } from '../../social/types'
import { useStore } from '../../store'
import { ago } from './styles'
import { Avatar, ErrorNote } from './ui'

/** The cheers on offer: the encouraging ones from the fixed emoji set. */
const CHEERS: Emoji[] = ['💪', '🔥', '👏', '🎉', '🙌', '💯']

/**
 * A post in the feed. A friend's: tap a cheer (one per post). Mine: the cheers it got, and a way to delete it.
 * `preview` shows just the post, as friends will see it.
 */
export function PostCard({ post, fresh, preview }: { post: Post; fresh?: boolean; preview?: boolean }) {
  const units = useStore((s) => s.units)
  const act = useSocial((s) => s.act)
  const all = useSocial((s) => s.emoji)
  const cheers = all.filter((m) => m.contextType === 'post' && m.contextId === post.id)
  const myCheer = cheers.find((m) => m.mine)
  const received = cheers.filter((m) => !m.mine).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const [sending, setSending] = useState<Emoji | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const items = post.payload.items.slice(0, 8)
  const more = post.payload.items.length - items.length
  const posted = toISO(new Date(post.createdAt))

  const cheer = async (e: Emoji) => {
    setSending(e); setError(null)
    const r = await act((b) => b.sendEmoji({ toId: post.from.id, emoji: e, contextType: 'post', contextId: post.id }))
    setSending(null)
    if (!r.ok) setError(r.error)
  }
  const remove = async () => {
    const r = await act((b) => b.deletePost(post.id))
    if (!r.ok) setError(r.error)
  }

  return (
    <article aria-label={`${post.mine ? 'Your post' : post.from.displayName}: ${post.title}`} className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70">
      <div className="mb-2 flex items-center gap-3">
        <Avatar profile={post.from} size="sm" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{post.mine && !preview ? 'You' : post.from.displayName}</p>
        {fresh && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase text-on-accent">New</span>}
        {!preview && <span className="shrink-0 text-xs text-neutral-400">{ago(post.createdAt)}</span>}
      </div>
      <h3 className="text-lg font-semibold leading-snug">{post.emoji} {post.title}</h3>
      {post.date !== posted && !preview && <p className="text-xs text-neutral-400">Workout on {fmtLong(post.date)}</p>}
      <ul className="mt-2 space-y-1.5">
        {items.map((i) => (
          <li key={i.exerciseId} className="text-sm leading-snug">
            <span className="font-medium">{postItemName(i)}</span> <span className="text-neutral-500">{describePostItem(i, units)}</span>
            {i.best && <span className="block text-xs font-medium text-green-600">🏆 {i.best}</span>}
          </li>
        ))}
        {more > 0 && <li className="text-xs text-neutral-400">+{more} more</li>}
      </ul>
      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
      {preview ? null : post.mine ? (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-100 pt-3 text-sm">
          <p className="min-w-0 text-neutral-600" aria-label="Cheers">
            {received.length ? received.map((m) => <span key={m.id} className="mr-2 inline-block">{m.emoji} {m.from.displayName}</span>) : <span className="text-neutral-400">No cheers yet</span>}
          </p>
          {confirm ? (
            <span className="flex shrink-0 gap-3">
              <button onClick={remove} className="font-medium text-red-600">Delete</button>
              <button onClick={() => setConfirm(false)} className="text-neutral-500">Keep</button>
            </span>
          ) : (
            <button onClick={() => setConfirm(true)} className="shrink-0 text-xs text-neutral-400 underline underline-offset-2">Delete</button>
          )}
        </div>
      ) : myCheer ? (
        <p role="status" className="mt-3 border-t border-neutral-100 pt-3 text-sm font-medium text-green-600">You cheered {myCheer.emoji}</p>
      ) : (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <div role="group" aria-label={`Cheer ${post.from.displayName} on`} className="flex flex-wrap gap-1.5">
            {CHEERS.map((e) => (
              <button
                key={e}
                disabled={!!sending}
                onClick={() => cheer(e)}
                aria-label={`Cheer ${e}`}
                className={`h-10 w-10 rounded-full text-xl ${sending === e ? 'bg-accent' : 'bg-neutral-100 hover:bg-neutral-200'} disabled:opacity-60`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}
