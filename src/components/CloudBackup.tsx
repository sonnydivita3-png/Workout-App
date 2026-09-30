import { useEffect, useState } from 'react'
import { getBackend } from '../social'
import type { SessionUser } from '../social/backend'
import { describeError } from '../social/store'
import { syncNow } from '../lib/useCloudSync'
import { useStore } from '../store'
import { AddEmailSheet } from './social/AddEmailSheet'
import { Sheet } from './Sheet'

const ago = (t: number | null) => {
  if (!t) return 'not yet'
  const m = Math.round((Date.now() - t) / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString()
}
const btn = 'w-full rounded-2xl bg-surface px-4 py-3 text-left text-sm shadow-sm ring-1 ring-neutral-200/70'

/** Settings block: back up workouts to the cloud and restore them on a new phone. */
export function CloudBackup() {
  const cloud = useStore((s) => s.cloud)
  const setCloud = useStore((s) => s.setCloud)
  const backend = getBackend()
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined)
  const [signIn, setSignIn] = useState(false)
  const [addEmail, setAddEmail] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { backend.currentUser().then(setUser).catch(() => setUser(null)) }, [backend, cloud.enabled, signIn, addEmail])

  const turnOn = async () => {
    const u = await backend.currentUser().catch(() => null)
    if (!u) { setSignIn(true); return }
    setCloud({ enabled: true })
  }
  const now = async (force?: 'keep-local' | 'use-cloud') => { setBusy(true); await syncNow(force); setBusy(false) }

  return (
    <>
      <h2 className="pt-4 text-xs uppercase tracking-wide text-neutral-400">Cloud backup</h2>
      {backend.kind === 'demo' && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Preview mode: backups are kept in this browser until the app is connected to a server, so they won’t survive clearing it yet.</p>}
      {!cloud.enabled ? (
        <>
          <p className="text-sm text-neutral-500">Your workouts live on this phone. Turn on backup so they’re safe if you lose, reset or change phones, and restore them by signing in on the new one.</p>
          <button onClick={turnOn} className="w-full rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent">Turn on cloud backup</button>
        </>
      ) : (
        <>
          {cloud.conflict && (
            <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
              <p className="mb-2 font-medium">This phone and your backup both changed since the last sync.</p>
              <p className="mb-3">Pick which one to keep. The other is replaced.</p>
              <div className="flex flex-col gap-2">
                <button disabled={busy} onClick={() => now('keep-local')} className="rounded-xl bg-surface px-3 py-2 text-left">Keep this phone’s data <span className="block text-xs opacity-70">and overwrite the backup</span></button>
                <button disabled={busy} onClick={() => now('use-cloud')} className="rounded-xl bg-surface px-3 py-2 text-left">Use the backup <span className="block text-xs opacity-70">and replace what’s on this phone</span></button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 shadow-sm ring-1 ring-neutral-200/70">
            <span>
              <span className="block">{cloud.error ? '⚠️ Backup problem' : '✅ Backed up'}</span>
              <span className="block text-xs text-neutral-400">{cloud.error ?? `Checked ${ago(cloud.checkedAt)}`}{user?.email ? ` · ${user.email}` : user?.anonymous ? ' · no email' : ''}</span>
            </span>
            <button disabled={busy} onClick={() => now()} className="rounded-full bg-neutral-100 px-3 py-1 text-sm">{busy ? '…' : 'Sync now'}</button>
          </div>
          {user === null && (
            <button onClick={() => setSignIn(true)} className="w-full rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent">Sign in to back up</button>
          )}
          {user?.anonymous && (
            <button onClick={() => setAddEmail(true)} className={btn}>
              Add an email so you can restore on a new phone
              <span className="block text-xs text-neutral-400">Without one, the backup can only be reached from this phone.</span>
            </button>
          )}
          <button onClick={() => setCloud({ enabled: false })} className={btn}>Turn off cloud backup <span className="block text-xs text-neutral-400">Your existing backup stays; nothing new is uploaded.</span></button>
        </>
      )}
      {signIn && <BackupSignIn onDone={(ok) => { setSignIn(false); if (ok) setCloud({ enabled: true }) }} />}
      {addEmail && <AddEmailSheet onClose={() => setAddEmail(false)} />}
    </>
  )
}

function BackupSignIn({ onDone }: { onDone: (ok: boolean) => void }) {
  const backend = getBackend()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(null); try { await fn() } catch (e) { setError(describeError(e)) } finally { setBusy(false) } }
  const input = 'mb-3 w-full rounded-xl bg-neutral-100 px-4 py-2.5 outline-none'
  return (
    <Sheet title="Sign in to back up" onClose={() => onDone(false)} closeLabel="Cancel">
      {step === 'email' ? (
        <>
          <p className="mb-3 text-sm text-neutral-600">Use the same email on a new phone to get everything back. We send a 6-digit code, no password.{backend.kind === 'demo' && ' (Preview mode: the code is 123456.)'}</p>
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={input} />
          <button disabled={busy || !email.includes('@')} onClick={() => run(async () => { await backend.sendCode(email); setStep('code') })} className="w-full rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent disabled:opacity-30">Send code</button>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-neutral-600">Enter the code sent to {email}.</p>
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="123456" className={`${input} text-center text-2xl tracking-widest`} />
          <button disabled={busy || code.length < 6} onClick={() => run(async () => { await backend.verifyCode(email, code); onDone(true) })} className="w-full rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent disabled:opacity-30">Continue</button>
        </>
      )}
    </Sheet>
  )
}
