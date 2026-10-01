import { useState } from 'react'
import { useSocial } from '../../social/store'
import { useStore } from '../../store'
import { Sheet } from '../Sheet'
import { AddEmailSheet } from './AddEmailSheet'
import { SocialSetup } from './SocialSetup'
import { AvatarPicker } from './AvatarPicker'
import { Avatar, ErrorNote } from './ui'
import { ConnectionStatus } from './ConnectionStatus'

const row = 'flex items-center justify-between rounded-2xl bg-surface px-4 py-3 shadow-sm ring-1 ring-neutral-200/70'
const btn = 'w-full rounded-2xl bg-surface px-4 py-3 text-left text-sm shadow-sm ring-1 ring-neutral-200/70'

/** Settings block: turn social on later, see your handle or sign out. Deleting the account lives in AccountSection. */
export function SocialSettings() {
  const { socialChoice, setSocialChoice } = useStore()
  const { profile, user, backend, status, signOut, reset, updateProfile } = useSocial()
  const [addEmail, setAddEmail] = useState(false)
  const anonymous = !!user?.anonymous
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [setup, setSetup] = useState(false)
  const [confirm, setConfirm] = useState<'off' | 'signout' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const enabled = socialChoice === 'enabled'

  // Turning off keeps you signed in, so turning it back on later picks up the same account and friends.
  const turnOff = () => { setSocialChoice('declined'); reset(); setConfirm(null) }

  return (
    <>
      <h2 className="pt-4 text-sm font-semibold text-neutral-700">Social</h2>
      <ConnectionStatus />
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
          {profile && (
            <div className={row}>
              <span>Email</span>
              <span className="text-neutral-500">{user?.email ?? 'None (this phone only)'}</span>
            </div>
          )}
          {profile && anonymous && (
            <button onClick={() => setAddEmail(true)} className={btn}>
              Add an email to recover your account
              <span className="block text-xs text-neutral-400">Without one, you’d lose your account and friends if you clear the app or change phones.</span>
            </button>
          )}
          {profile && <button onClick={() => { setDraft(profile.avatar); setError(null); setEditing(true) }} className={btn}>Change avatar</button>}
          {profile && <div className={row}><span>Display name</span><span className="text-neutral-500">{profile.displayName}</span></div>}
          {!profile && <button onClick={() => setSetup(true)} className={btn}>Sign in or finish setup</button>}
          {profile && <button onClick={() => (anonymous ? setConfirm('signout') : void signOut())} className={btn}>Sign out</button>}
          <button onClick={() => setConfirm('off')} className={btn}>Turn off social features</button>
        </>
      )}
      {setup && <SocialSetup variant="sheet" onDone={() => setSetup(false)} onCancel={() => setSetup(false)} />}
      {addEmail && <AddEmailSheet onClose={() => setAddEmail(false)} />}
      {confirm === 'signout' && (
        <Sheet title="Sign out?" onClose={() => setConfirm(null)} closeLabel="Cancel">
          <p className="mb-4 text-sm text-neutral-600">Your account has no email, so signing out means you can’t get back into it, and you’d lose your handle and friends. Add an email first if you want to keep it.</p>
          <button onClick={() => { setConfirm(null); setAddEmail(true) }} className="mb-2 w-full rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent">Add an email first</button>
          <button onClick={() => { setConfirm(null); void signOut() }} className="w-full rounded-2xl bg-red-600 py-3 text-sm font-medium text-white">Sign out and lose the account</button>
        </Sheet>
      )}
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
          <p className="mb-4 text-sm text-neutral-600">Social tabs and notifications go away. Your account and friends stay on the server and you stay signed in, so turning it back on later picks up right where you left off. Your workouts are not affected.</p>
          <button onClick={turnOff} className="w-full rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent">Turn off</button>
        </Sheet>
      )}
    </>
  )
}
