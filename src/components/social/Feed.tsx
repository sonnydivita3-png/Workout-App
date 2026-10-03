import { useEffect, useRef, useState } from 'react'
import { fmtLong } from '../../lib/dates'
import { lastWorkout } from '../../lib/plan'
import { useToday } from '../../lib/useToday'
import { useSocial } from '../../social/store'
import { useStore } from '../../store'
import { PostCard } from './PostCard'
import { PostSheet } from './PostSheet'
import { primary } from './styles'
import { Avatar, Card, ErrorNote } from './ui'

/**
 * Friends' posts ("look what I did") to cheer, and mine with their cheers. Opening it counts their posts as seen, and
 * the cheers on mine as read.
 */
export function Feed() {
  const today = useToday()
  const { posts, friends, emoji, act, backend, refresh } = useSocial()
  const { logs, overrides, postsSeenAt, markPostsSeen } = useStore()
  const [since] = useState(postsSeenAt) // what counted as new when the feed opened
  const [posting, setPosting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const marking = useRef(new Set<string>())

  useEffect(() => {
    const newest = posts.find((p) => !p.mine)?.createdAt
    if (newest) markPostsSeen(newest)
  }, [posts, markPostsSeen])
  useEffect(() => {
    const ids = emoji.filter((m) => !m.mine && !m.read && m.contextType === 'post' && posts.some((p) => p.mine && p.id === m.contextId) && !marking.current.has(m.id)).map((m) => m.id)
    if (ids.length === 0) return
    ids.forEach((id) => marking.current.add(id))
    backend.markEmojiRead(ids).then(refresh).catch(() => ids.forEach((id) => marking.current.delete(id)))
  }, [emoji, posts, backend, refresh])

  const last = lastWorkout(logs, overrides, today)?.date
  const postedLast = !!last && posts.some((p) => p.mine && p.date === last)
  // Nobody's posts are on yet: offer the switches right here (and keep them while they're being used).
  const seesNone = friends.length > 0 && !friends.some((f) => f.iGrant.posts)
  const allow = async (id: string, on: boolean) => {
    setError(null); setTouched(true)
    const r = await act((b) => b.setPermissions(id, { posts: on }))
    if (!r.ok) setError(r.error)
  }

  return (
    <div className="space-y-3">
      {last && !postedLast && (
        <button onClick={() => setPosting(last)} className={primary}>🎉 Post {last === today ? 'today’s workout' : `your workout from ${fmtLong(last)}`}</button>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      {(seesNone || touched) && friends.length > 0 && (
        <Card title="See friends’ workouts">
          <p className="mb-2 text-sm text-neutral-500">Turn on a friend’s posts to see their workouts here and cheer them on.</p>
          <ul className="divide-y divide-neutral-100">
            {friends.map((f) => (
              <li key={f.profile.id} className="flex items-center gap-3 py-2">
                <Avatar profile={f.profile} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.profile.displayName}</span>
                <button
                  role="switch"
                  aria-checked={f.iGrant.posts}
                  aria-label={`Show me ${f.profile.displayName}’s posts`}
                  onClick={() => allow(f.profile.id, !f.iGrant.posts)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${f.iGrant.posts ? 'bg-accent' : 'bg-neutral-200'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${f.iGrant.posts ? 'left-[1.375rem]' : 'left-0.5'}`} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {posts.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-400">{friends.length ? 'No posts yet. When a friend posts a workout, it shows up here for you to cheer.' : 'Add friends to see their workouts here and cheer each other on.'}</p>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} fresh={!p.mine && p.createdAt > since} />)
      )}
      {posting && <PostSheet date={posting} onClose={() => setPosting(null)} />}
    </div>
  )
}
