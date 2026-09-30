import { useState } from 'react'
import { useSocial } from '../../social/store'
import { REPORT_REASONS, type Profile, type ReportReason } from '../../social/types'
import { useToasts } from '../../toastStore'
import { Sheet } from '../Sheet'
import { ErrorNote } from './ui'
import { input, primary } from './styles'

/** Report someone to the app owner, and optionally block them at the same time. */
export function ReportSheet({ profile, onClose, onBlocked }: { profile: Profile; onClose: () => void; onBlocked?: () => void }) {
  const act = useSocial((s) => s.act)
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [note, setNote] = useState('')
  const [block, setBlock] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    if (!reason) return
    setBusy(true); setError(null)
    const r = await act((b) => b.reportUser(profile.id, reason, note))
    if (!r.ok) { setBusy(false); setError(r.error); return }
    if (block) {
      const rb = await act((b) => b.blockUser(profile.id))
      if (!rb.ok) { setBusy(false); setError(rb.error); return }
    }
    setBusy(false)
    useToasts.getState().push({ id: 'reported', title: 'Report sent. Thank you', body: block ? `@${profile.handle} is blocked and can’t contact you.` : 'We’ll take a look.' })
    if (block) onBlocked?.()
    onClose()
  }

  return (
    <Sheet title={`Report @${profile.handle}`} onClose={onClose} closeLabel="Cancel">
      <p className="mb-3 text-sm text-neutral-600">Reports go to the app’s owner, not to {profile.displayName}.</p>
      <div className="mb-3 space-y-2" role="radiogroup" aria-label="Reason">
        {REPORT_REASONS.map(([k, text]) => (
          <button key={k} role="radio" aria-checked={reason === k} onClick={() => setReason(k)}
            className={`w-full rounded-xl px-4 py-2.5 text-left text-sm ${reason === k ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-700'}`}>
            {text}
          </button>
        ))}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} placeholder="Anything else? (optional)" className={`${input} mb-3 resize-none`} />
      <label className="mb-4 flex items-center gap-2 text-sm text-neutral-600">
        <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
        Also block @{profile.handle}
      </label>
      {error && <ErrorNote>{error}</ErrorNote>}
      <button disabled={!reason || busy} onClick={send} className={primary}>{busy ? 'Sending…' : 'Send report'}</button>
    </Sheet>
  )
}
