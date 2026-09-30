import { useEffect, useState } from 'react'
import { describeError, useSocial } from '../../social/store'
import { useStore } from '../../store'
import { useToasts } from '../../toastStore'
import { SocialSetup } from './SocialSetup'

/** Someone opened an invite link (?add=handle): offer to send that person a friend request. */
export function InviteBanner() {
  const handle = useStore((s) => s.pendingInvite)
  const setPendingInvite = useStore((s) => s.setPendingInvite)
  const enabled = useStore((s) => s.socialChoice === 'enabled')
  const { status, profile, friends, requests, act, backend } = useSocial()
  const [setup, setSetup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ready = enabled && status === 'ready' && !!profile
  const known = ready && handle && (
    profile?.handle === handle ||
    friends.some((f) => f.profile.handle === handle) ||
    requests.outgoing.some((r) => r.to.handle === handle) ||
    requests.incoming.some((r) => r.from.handle === handle)
  )
  // Your own link, an existing friend or an open request: nothing to do.
  useEffect(() => { if (known) setPendingInvite(null) }, [known, setPendingInvite])

  if (!handle || known) return null
  if (enabled && (status === 'loading' || status === 'idle')) return null

  const add = async () => {
    setBusy(true); setError(null)
    try {
      const p = await backend.findByHandle(handle)
      if (!p) { setError(`No one has the handle @${handle} any more.`); return }
      const r = await act((b) => b.sendFriendRequest(p.id))
      if (!r.ok) { setError(r.error); return }
      useToasts.getState().push({ id: 'invite-sent', title: 'Friend request sent 🤝', body: `@${handle} gets it next time they open the app.` })
      setPendingInvite(null)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-accent/40">
      <p className="text-sm"><span aria-hidden>👋 </span><b className="font-medium">@{handle}</b> invited you to train together.</p>
      <p className="mb-3 text-xs text-neutral-400">
        {ready ? 'Send a friend request? Being friends shares nothing until you each choose what the other can see.' : 'Set up social features to add them as a friend. It takes a minute, and email is optional.'}
      </p>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        {ready
          ? <button disabled={busy} onClick={add} className="rounded-full bg-accent px-4 py-1.5 text-sm text-on-accent disabled:opacity-40">{busy ? 'Sending…' : 'Add friend'}</button>
          : <button onClick={() => setSetup(true)} className="rounded-full bg-accent px-4 py-1.5 text-sm text-on-accent">Set up social</button>}
        <button onClick={() => setPendingInvite(null)} className="rounded-full bg-neutral-100 px-4 py-1.5 text-sm text-neutral-600">Not now</button>
      </div>
      {setup && <SocialSetup variant="sheet" onDone={() => setSetup(false)} onCancel={() => setSetup(false)} />}
    </div>
  )
}
