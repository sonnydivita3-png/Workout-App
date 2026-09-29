import { useState } from 'react'
import { useSocial } from '../../social/store'
import type { FriendEntry, Scope } from '../../social/types'
import { Sheet } from '../Sheet'
import { chip, input, label, primary } from './styles'
import { ErrorNote } from './ui'

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'day', label: 'A day' },
  { id: 'week', label: 'A week' },
  { id: 'month', label: '4 weeks' },
]

/** Ask a friend to put together a workout for you. They can say no. */
export function RequestWorkoutSheet({ friend, onClose }: { friend: FriendEntry; onClose: () => void }) {
  const act = useSocial((s) => s.act)
  const [scope, setScope] = useState<Scope>('day')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const send = async () => {
    setBusy(true); setError(null)
    const r = await act((b) => b.requestWorkout({ toId: friend.profile.id, scope, note: note.trim().slice(0, 140) }))
    setBusy(false)
    if (r.ok) setSent(true); else setError(r.error)
  }

  if (sent) {
    return (
      <Sheet title="Request sent" onClose={onClose} closeLabel="Done">
        <p className="py-6 text-center text-neutral-600">{friend.profile.displayName} can now make you a workout, or pass.</p>
        <button onClick={onClose} className={primary}>Done</button>
      </Sheet>
    )
  }

  return (
    <Sheet title={`Ask ${friend.profile.displayName} for a workout`} onClose={onClose} closeLabel="Cancel">
      <p className={label}>What kind</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {SCOPES.map((s) => <button key={s.id} onClick={() => setScope(s.id)} className={chip(scope === s.id)}>{s.label}</button>)}
      </div>
      <label className={`${label} block`}>Anything they should know? (optional)</label>
      <input value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} placeholder="e.g. legs, 30 minutes, no gym" className={`${input} mb-4`} />
      {error && <ErrorNote>{error}</ErrorNote>}
      <button disabled={busy} onClick={send} className={primary}>{busy ? 'Sending…' : 'Send request'}</button>
    </Sheet>
  )
}
