import { useState } from 'react'
import { useSocial } from '../../social/store'
import { ALL_PERMS, NO_PERMS, type FriendRequest, type PermKey, type Perms } from '../../social/types'
import { Sheet } from '../Sheet'
import { PermissionToggles } from './PermissionToggles'
import { ReportSheet } from './ReportSheet'
import { Avatar, ErrorNote } from './ui'
import { primary, secondary } from './styles'

/** Accepting a request is also where you decide what this person may do. Everything starts off. */
export function AcceptFriendSheet({ request, onClose }: { request: FriendRequest | { id: string; from: FriendRequest['from'] }; onClose: () => void }) {
  const act = useSocial((s) => s.act)
  const [grant, setGrant] = useState<Perms>({ ...NO_PERMS })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [confirmBlock, setConfirmBlock] = useState(false)
  const { from } = request

  const respond = async (accept: boolean) => {
    setBusy(true)
    const r = await act((b) => b.respondFriendRequest(request.id, accept, accept ? grant : {}))
    setBusy(false)
    if (r.ok) onClose(); else setError(r.error)
  }
  const block = async () => {
    setBusy(true)
    const r = await act((b) => b.blockUser(from.id))
    setBusy(false)
    if (r.ok) onClose(); else setError(r.error)
  }

  if (reporting) return <ReportSheet profile={from} onClose={() => setReporting(false)} onBlocked={onClose} />

  return (
    <Sheet title="Friend request" onClose={onClose} closeLabel="Close">
      <div className="mb-4 flex items-center gap-3">
        <Avatar profile={from} size="lg" />
        <div>
          <p className="font-semibold">{from.displayName}</p>
          <p className="text-sm text-neutral-400">@{from.handle}</p>
        </div>
      </div>
      <p className="mb-2 text-sm text-neutral-600">What can {from.displayName} do? Everything is off until you turn it on, and you can change this any time.</p>
      {error && <ErrorNote>{error}</ErrorNote>}
      <PermissionToggles value={grant} onChange={(k: PermKey, on) => setGrant((g) => ({ ...g, [k]: on }))} />
      <div className="mb-4 mt-1 flex gap-4 text-xs text-neutral-500">
        <button onClick={() => setGrant({ ...ALL_PERMS })} className="underline underline-offset-2">Allow all</button>
        <button onClick={() => setGrant({ ...NO_PERMS })} className="underline underline-offset-2">Allow none</button>
      </div>
      <button disabled={busy} onClick={() => respond(true)} className={primary}>Accept</button>
      <button disabled={busy} onClick={() => respond(false)} className={`${secondary} mt-2`}>Decline</button>
      <div className="mt-4 flex justify-center gap-4 text-sm">
        {confirmBlock ? (
          <>
            <span className="text-neutral-500">Block @{from.handle}?</span>
            <button disabled={busy} onClick={block} className="font-medium text-red-600">Yes</button>
            <button onClick={() => setConfirmBlock(false)} className="text-neutral-500">No</button>
          </>
        ) : (
          <>
            <button onClick={() => setConfirmBlock(true)} className="text-red-600 underline underline-offset-2">Block</button>
            <button onClick={() => setReporting(true)} className="text-red-600 underline underline-offset-2">Report</button>
          </>
        )}
      </div>
    </Sheet>
  )
}
