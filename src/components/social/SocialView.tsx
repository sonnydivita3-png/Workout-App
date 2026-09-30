import { useState } from 'react'
import { formatAmount } from '../../social/challengeProgress'
import { describePayload } from '../../social/share'
import { describeError, pendingCount, useSocial } from '../../social/store'
import { normalizeHandle, type Challenge, type FriendRequest, type Profile, type SharedWorkout, type WorkoutRequest } from '../../social/types'
import { useStore } from '../../store'
import { AcceptFriendSheet } from './AcceptFriendSheet'
import { AddSharedSheet } from './AddSharedSheet'
import { ChallengeSheet } from './ChallengeSheet'
import { FriendSheet } from './FriendSheet'
import { SocialSetup } from './SocialSetup'
import { ago, chip, input, primary, secondary } from './styles'
import { Avatar, Card, ErrorNote } from './ui'
import type { Tab } from '../TabBar'
import { ChallengeDetailSheet } from './ChallengeDetailSheet'
import { MakeForFriendSheet } from './MakeForFriendSheet'
import { InviteButton } from '../InviteButton'

type Section = 'inbox' | 'friends' | 'challenges'

const pct = (c: Challenge) => Math.min(100, Math.round((c.progress / Math.max(c.target, 1)) * 100))

function ChallengeRow({ c, onOpen, onCancel }: { c: Challenge; onOpen: () => void; onCancel?: () => void }) {
  const other = c.mine ? c.to : c.from
  const { units } = useStore()
  return (
    <li className="flex items-start gap-2 py-3">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <Avatar profile={other} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{c.emoji} {c.title}</p>
          <p className="text-xs text-neutral-400">{c.mine ? `to ${other.displayName}` : `from ${other.displayName}`} · {c.status}</p>
          {(c.status === 'active' || c.status === 'completed') && (
            <>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-accent" style={{ width: `${pct(c)}%` }} /></div>
              <p className="mt-1 text-xs text-neutral-500">{c.done ? '🎉 Done' : `${formatAmount(c, c.progress, units)} / ${formatAmount({ ...c, spec: c.spec }, c.target, units)}`}</p>
            </>
          )}
        </div>
        <span className="mt-1 text-neutral-300">›</span>
      </button>
      {onCancel && <button onClick={onCancel} className="mt-1 text-xs text-neutral-400 underline">Cancel</button>}
    </li>
  )
}

export function SocialView({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const { socialChoice } = useStore()
  const s = useSocial()
  const { status, profile, friends, requests, shares, workoutRequests, challenges, emoji, act, backend } = s
  const [section, setSection] = useState<Section>('inbox')
  const [setup, setSetup] = useState(false)
  const [accepting, setAccepting] = useState<FriendRequest | null>(null)
  const [adding, setAdding] = useState<SharedWorkout | null>(null)
  const [friendId, setFriendId] = useState<string | null>(null)
  const [newChallenge, setNewChallenge] = useState(false)
  const [openChallenge, setOpenChallenge] = useState<string | null>(null)
  const [making, setMaking] = useState<WorkoutRequest | null>(null)
  const [handle, setHandle] = useState('')
  const [found, setFound] = useState<Profile | null | 'none'>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (socialChoice !== 'enabled') {
    return (
      <>
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Social</h1>
        <Card>
          <p className="mb-1 font-medium">Train with friends</p>
          <p className="mb-4 text-sm text-neutral-500">Share workouts, send challenges and cheer each other on with emoji. You choose what each friend can do. Social is off until you set it up.</p>
          <button onClick={() => setSetup(true)} className={primary}>Set up social features</button>
          <InviteButton className={`${secondary} mt-2`}>Invite a friend to the app</InviteButton>
        </Card>
        {setup && <SocialSetup variant="sheet" onDone={() => setSetup(false)} onCancel={() => setSetup(false)} />}
      </>
    )
  }

  if (status === 'signed-out' || status === 'needs-profile' || status === 'idle') {
    return (
      <>
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Social</h1>
        <Card>
          <p className="mb-4 text-sm text-neutral-500">{status === 'needs-profile' ? 'Finish creating your profile to continue.' : 'Sign in to see your friends.'}</p>
          <button onClick={() => setSetup(true)} className={primary}>{status === 'needs-profile' ? 'Finish setup' : 'Sign in'}</button>
        </Card>
        {setup && <SocialSetup variant="sheet" onDone={() => setSetup(false)} onCancel={() => setSetup(false)} />}
      </>
    )
  }

  if (status === 'loading' && !profile) return <p className="py-12 text-center text-neutral-400">Loading…</p>
  if (status === 'error') {
    return (
      <>
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Social</h1>
        <ErrorNote>{s.error ?? 'Something went wrong.'}</ErrorNote>
        <button onClick={() => s.init()} className={secondary}>Try again</button>
      </>
    )
  }

  const pending = pendingCount(s)
  const incomingShares = shares.filter((x) => !x.mine && x.status === 'pending')
  const incomingReqs = workoutRequests.filter((x) => !x.mine && x.status === 'pending')
  const incomingChallenges = challenges.filter((x) => !x.mine && x.status === 'pending')
  const unread = emoji.filter((x) => !x.mine && !x.read)
  const activeChallenges = challenges.filter((c) => c.status === 'active')
  const pastChallenges = challenges.filter((c) => ['completed', 'declined', 'cancelled'].includes(c.status)).slice(0, 10)
  const waitingChallenges = challenges.filter((c) => c.mine && c.status === 'pending')

  const run = async (fn: Parameters<typeof act>[0]) => {
    setError(null)
    const r = await act(fn)
    if (!r.ok) setError(r.error)
  }

  const lookup = async () => {
    setBusy(true); setError(null); setFound(null)
    try {
      const p = await backend.findByHandle(normalizeHandle(handle))
      setFound(p && p.id !== profile?.id ? p : 'none')
    } catch (e) { setError(describeError(e)) } finally { setBusy(false) }
  }

  const alreadyFriend = found && found !== 'none' && friends.some((f) => f.profile.id === found.id)
  const alreadyAsked = found && found !== 'none' && requests.outgoing.some((r) => r.to.id === found.id)

  return (
    <>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Social</h1>
        {profile && <span className="flex items-center gap-2 text-sm text-neutral-400"><Avatar profile={profile} size="sm" />@{profile.handle}</span>}
      </header>
      <div className="mb-4 flex gap-2">
        <button onClick={() => setSection('inbox')} className={chip(section === 'inbox')}>Inbox{pending > 0 ? ` (${pending})` : ''}</button>
        <button onClick={() => setSection('friends')} className={chip(section === 'friends')}>Friends</button>
        <button onClick={() => setSection('challenges')} className={chip(section === 'challenges')}>Challenges</button>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}

      {section === 'inbox' && (
        <div className="space-y-3">
          {pending === 0 && <p className="py-10 text-center text-neutral-400">All caught up. 🙌</p>}
          {requests.incoming.length > 0 && (
            <Card title="Friend requests">
              <ul className="divide-y divide-neutral-100">
                {requests.incoming.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2">
                    <Avatar profile={r.from} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{r.from.displayName}</span><span className="block text-xs text-neutral-400">@{r.from.handle}</span></span>
                    <button onClick={() => setAccepting(r)} className="rounded-full bg-accent px-3 py-1 text-sm text-on-accent">Review</button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {incomingShares.length > 0 && (
            <Card title="Workouts for you">
              <ul className="divide-y divide-neutral-100">
                {incomingShares.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 py-2">
                    <Avatar profile={x.from} size="sm" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{x.emoji} {x.title}</span><span className="block text-xs text-neutral-400">{x.from.displayName} · {describePayload(x.payload)}</span></span>
                    <button onClick={() => setAdding(x)} className="rounded-full bg-accent px-3 py-1 text-sm text-on-accent">View</button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {incomingReqs.length > 0 && (
            <Card title="Workout requests">
              <ul className="divide-y divide-neutral-100">
                {incomingReqs.map((x) => (
                  <li key={x.id} className="py-2">
                    <p className="text-sm"><b className="font-medium">{x.from.displayName}</b> wants a {x.scope === 'day' ? 'day' : x.scope === 'week' ? 'week' : '4 weeks'} of workouts.</p>
                    {x.note && <p className="text-xs text-neutral-500">“{x.note}”</p>}
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => setMaking(x)} className="rounded-full bg-accent px-3 py-1 text-sm text-on-accent">Make one</button>
                      <button onClick={() => run((b) => b.respondWorkoutRequest(x.id, 'decline'))} className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-600">Not now</button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {incomingChallenges.length > 0 && (
            <Card title="Challenges">
              <ul className="divide-y divide-neutral-100">
                {incomingChallenges.map((c) => (
                  <li key={c.id} className="py-2">
                    <button onClick={() => setOpenChallenge(c.id)} className="block text-left"><span className="block text-sm font-medium">{c.emoji} {c.title}</span><span className="block text-xs text-neutral-400">from {c.from.displayName} · tap for details</span></button>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => run((b) => b.respondChallenge(c.id, true))} className="rounded-full bg-accent px-3 py-1 text-sm text-on-accent">Accept</button>
                      <button onClick={() => run((b) => b.respondChallenge(c.id, false))} className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-600">Decline</button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {unread.length > 0 && (
            <Card title="Emoji" action={<button onClick={() => run((b) => b.markEmojiRead(unread.map((u) => u.id)))} className="text-xs text-neutral-400 underline">Mark read</button>}>
              <ul className="space-y-1">
                {unread.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 text-sm"><span className="text-2xl">{m.emoji}</span><span className="flex-1">{m.from.displayName}</span><span className="text-xs text-neutral-400">{ago(m.createdAt)}</span></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {section === 'friends' && (
        <div className="space-y-3">
          {profile && (
            <Card title="Invite friends">
              <p className="mb-3 text-xs text-neutral-400">Send a link by text or any app. When they open it, they can add you in one tap. It includes your handle, so only send it to people you want to hear from.</p>
              <InviteButton handle={profile.handle} className={primary}>Share invite link</InviteButton>
            </Card>
          )}
          <Card title="Add a friend">
            <p className="mb-2 text-xs text-neutral-400">Type their exact handle. There’s no searching, so people only get found by someone who already knows their handle.</p>
            <div className="flex gap-2">
              <input value={handle} onChange={(e) => { setHandle(e.target.value); setFound(null) }} placeholder="@handle" autoCapitalize="none" autoCorrect="off" className={input} />
              <button disabled={busy || handle.trim().length < 3} onClick={lookup} className="shrink-0 rounded-xl bg-accent px-4 text-sm text-on-accent disabled:opacity-30">Find</button>
            </div>
            {found === 'none' && <p className="mt-2 text-sm text-neutral-500">No one with that handle.</p>}
            {found && found !== 'none' && (
              <div className="mt-3 flex items-center gap-3">
                <Avatar profile={found} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{found.displayName}</span><span className="block text-xs text-neutral-400">@{found.handle}</span></span>
                <button disabled={!!alreadyFriend || !!alreadyAsked} onClick={() => run(async (b) => { await b.sendFriendRequest(found.id); setFound(null); setHandle('') })} className="rounded-full bg-accent px-3 py-1 text-sm text-on-accent disabled:opacity-40">
                  {alreadyFriend ? 'Friends' : alreadyAsked ? 'Requested' : 'Add'}
                </button>
              </div>
            )}
          </Card>
          {requests.outgoing.length > 0 && (
            <Card title="Waiting for a reply">
              <ul className="divide-y divide-neutral-100">
                {requests.outgoing.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2">
                    <Avatar profile={r.to} size="sm" /><span className="min-w-0 flex-1 truncate text-sm">{r.to.displayName} <span className="text-neutral-400">@{r.to.handle}</span></span>
                    <button onClick={() => run((b) => b.cancelFriendRequest(r.id))} className="text-xs text-neutral-400 underline">Cancel</button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Friends">
            {friends.length === 0 ? <p className="text-sm text-neutral-400">No friends yet. Invite someone or add them by handle above.</p> : (
              <ul className="divide-y divide-neutral-100">
                {friends.map((f) => (
                  <li key={f.profile.id}>
                    <button onClick={() => setFriendId(f.profile.id)} className="flex w-full items-center gap-3 py-2 text-left">
                      <Avatar profile={f.profile} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{f.profile.displayName}</span><span className="block text-xs text-neutral-400">@{f.profile.handle}</span></span>
                      {!f.iGrant.reviewed && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Set permissions</span>}
                      <span className="text-neutral-300">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {section === 'challenges' && (
        <div className="space-y-3">
          <button disabled={friends.length === 0} onClick={() => setNewChallenge(true)} className={primary}>New challenge</button>
          {friends.length === 0 && <p className="text-center text-xs text-neutral-400">Add a friend first.</p>}
          {activeChallenges.length > 0 && <Card title="Active"><ul className="divide-y divide-neutral-100">{activeChallenges.map((c) => <ChallengeRow key={c.id} c={c} onOpen={() => setOpenChallenge(c.id)} />)}</ul></Card>}
          {waitingChallenges.length > 0 && <Card title="Waiting for a reply"><ul className="divide-y divide-neutral-100">{waitingChallenges.map((c) => <ChallengeRow key={c.id} c={c} onOpen={() => setOpenChallenge(c.id)} onCancel={() => run((b) => b.cancelChallenge(c.id))} />)}</ul></Card>}
          {pastChallenges.length > 0 && <Card title="Past"><ul className="divide-y divide-neutral-100">{pastChallenges.map((c) => <ChallengeRow key={c.id} c={c} onOpen={() => setOpenChallenge(c.id)} />)}</ul></Card>}
        </div>
      )}

      {accepting && <AcceptFriendSheet request={accepting} onClose={() => setAccepting(null)} />}
      {adding && <AddSharedSheet share={adding} onClose={() => setAdding(null)} />}
      {making && <MakeForFriendSheet request={making} onClose={() => setMaking(null)} />}
      {openChallenge && <ChallengeDetailSheet id={openChallenge} onNavigate={(t) => { setOpenChallenge(null); onNavigate(t) }} onClose={() => setOpenChallenge(null)} />}
      {friendId && <FriendSheet friendId={friendId} onClose={() => setFriendId(null)} />}
      {newChallenge && <ChallengeSheet onClose={() => setNewChallenge(false)} />}
    </>
  )
}
