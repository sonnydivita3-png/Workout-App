import { useEffect, useState } from 'react'
import { getBackend } from '../social'
import type { SessionUser } from '../social/backend'
import { describeError, useSocial } from '../social/store'
import { useStore } from '../store'
import { useToasts } from '../toastStore'
import { Sheet } from './Sheet'

/**
 * Delete the server account (handle, friends, everything shared, cloud backup). Shown to anyone signed in, whether
 * they use social, cloud backup or both, and whether or not social is currently switched on.
 */
export function AccountSection() {
  const backend = getBackend()
  const cloudOn = useStore((s) => s.cloud.enabled)
  const choice = useStore((s) => s.socialChoice)
  const socialUser = useSocial((s) => s.user)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { backend.currentUser().then(setUser).catch(() => setUser(null)) }, [backend, cloudOn, choice, socialUser])

  if (!user) return null

  const del = async () => {
    setBusy(true); setError(null)
    try {
      await backend.deleteAccount()
    } catch (e) {
      setError(describeError(e)); setBusy(false); return
    }
    const s = useStore.getState()
    useSocial.getState().reset()
    if (s.socialChoice === 'enabled') s.setSocialChoice('declined')
    s.setCloud({ enabled: false, lastSyncedAt: null, lastHash: null, conflict: false, error: null })
    setBusy(false); setConfirm(false); setUser(null)
    useToasts.getState().push({ id: 'account-deleted', title: 'Account deleted', body: 'Everything on the server is gone. Your workouts on this phone are still here.' })
  }

  return (
    <>
      <h2 className="pt-4 text-sm font-semibold text-neutral-700">Account</h2>
      <button onClick={() => { setError(null); setConfirm(true) }} className="w-full rounded-2xl bg-surface px-4 py-3 text-left text-sm text-red-600 shadow-sm ring-1 ring-neutral-200/70">
        Delete my account
        <span className="block text-xs text-neutral-400">{user.email ?? 'Account without an email'}</span>
      </button>
      {confirm && (
        <Sheet title="Delete your account?" onClose={() => setConfirm(false)} closeLabel="Cancel">
          <p className="mb-3 text-sm text-neutral-600">This permanently deletes everything on our server: your handle, friends, shared workouts, challenges, emoji and your cloud backup. It can’t be undone.</p>
          <p className="mb-4 text-sm text-neutral-600">Workouts saved on this phone stay. To remove those too, use <b className="font-medium">Erase all data</b> above.</p>
          {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button disabled={busy} onClick={del} className="w-full rounded-2xl bg-red-600 py-3 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Deleting…' : 'Delete my account'}</button>
        </Sheet>
      )}
    </>
  )
}
