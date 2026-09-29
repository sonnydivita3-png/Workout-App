import { useState } from 'react'
import { useSocial } from '../../social/store'
import { useStore } from '../../store'
import { Sheet } from '../Sheet'
import { SocialSetup } from './SocialSetup'
import { AvatarPicker } from './AvatarPicker'
import { Avatar, ErrorNote } from './ui'

const row = 'flex items-center justify-between rounded-2xl bg-surface px-4 py-3 shadow-sm ring-1 ring-neutral-200/70'
const btn = 'w-full rounded-2xl bg-surface px-4 py-3 text-left text-sm shadow-sm ring-1 ring-neutral-200/70'

/** Settings block: turn social on later, see your handle, sign out, or delete the social account. */
export function SocialSettings() {
  const { socialChoice, setSocialChoice } = useStore()
  const { profile, backend, status, signOut, reset, act, updateProfile } = useSocial()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [setup, setSetup] = useState(false)
  const [confirm, setConfirm] = useState<'off' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const enabled = socialChoice === 'enabled'

  const turnOff = () => { void signOut(); setSocialChoice('declined'); reset(); setConfirm(null) }
  const del = async () => {
    const r = await act((b) => b.deleteAccount())
    if (!r.ok) { setError(r.error); return }
    reset(); setSocialChoice('declined'); setConfirm(null)
  }

  return (
    <>
      <h2 className="pt-4 text-xs uppercase tracking-wide text-neutral-400">Social</h2>
      {backend.kind === 'demo' && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Preview mode: friends are simulated on this device until the app is connected to a server.</p>}
      {!enabled ? (
        <>
          <p className="text-sm text-neutral-500">Social is {socialChoice === 'declined' ? 'off' : 'not set up'}. Turn it on to share workouts and send challenges to friends. You choose what each friend can do.</p>
          <button onClick={() => setSetup(true)} className="w-full rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent">Set up social features</button>
        </>
      ) : (
        <>
          <div className={row}>
            <span>Handle</span>
            <span className="flex items-center gap-2 text-neutral-500">{profile && <Avatar profile={profile} size="sm" />}{profile ? `@${profile.handle}` : status === 'loading' ? '…' : 'Not signed in'}</span>
          </div>
          {profile && <button onClick={() => { setDraft(profile.avatar); setError(null); setEditing(true) }} className={btn}>Change avatar</button>}
          {profile && <div className={row}><span>Display name</span><span className="text-neutral-500">{profile.displayName}</span></div>}
          {!profile && <button onClick={() => setSetup(true)} className={btn}>Sign in or finish setup</button>}
          {profile && <button onClick={() => void signOut()} className={btn}>Sign out</button>}
          <button onClick={() => setConfirm('off')} className={btn}>Turn off social features</button>
          {profile && <button onClick={() => setConfirm('delete')} className={`${btn} text-red-600`}>Delete my social account</button>}
        </>
      )}
      {setup && <SocialSetup variant="sheet" onDone={() => setSetup(false)} onCancel={() => setSetup(false)} />}
      {editing && profile && (
        <Sheet title="Your avatar" onClose={() => setEditing(false)} closeLabel="Cancel">
          <AvatarPicker value={draft} onChange={setDraft} name={profile.displayName} />
          {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
          <button
            onClick={async () => { const e = await updateProfile({ avatar: draft }); if (e) setError(e); else setEditing(false) }}
            className="mt-4 w-full rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent"
          >
            Save
          </button>
        </Sheet>
      )}
      {confirm === 'off' && (
        <Sheet title="Turn off social?" onClose={() => setConfirm(null)} closeLabel="Cancel">
          <p className="mb-4 text-sm text-neutral-600">You’ll be signed out on this device. Your account and friends stay on the server, so you can sign back in later. Your workouts are not affected.</p>
          <button onClick={turnOff} className="w-full rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent">Turn off</button>
        </Sheet>
      )}
      {confirm === 'delete' && (
        <Sheet title="Delete social account?" onClose={() => setConfirm(null)} closeLabel="Cancel">
          <p className="mb-4 text-sm text-neutral-600">This removes your handle, friends, shared workouts, challenges and emoji from the server. It can’t be undone. Your own workouts on this device are not affected.</p>
          {error && <ErrorNote>{error}</ErrorNote>}
          <button onClick={del} className="w-full rounded-2xl bg-red-600 py-3 text-sm font-medium text-white">Delete account</button>
        </Sheet>
      )}
    </>
  )
}
