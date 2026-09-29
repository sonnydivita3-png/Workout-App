import { useMemo, useState } from 'react'
import { BUILTIN_BY_ID } from '../../data/exercises'
import { buildPayload, datesFor, defaultTitle, describePayload } from '../../social/share'
import { useSocial } from '../../social/store'
import { EMOJI, type Scope, type SharedPayload } from '../../social/types'
import { findExercise, useStore } from '../../store'
import { Sheet } from '../Sheet'
import { chip, input, label, primary } from './styles'
import { Avatar, ErrorNote } from './ui'

const SCOPES: { id: Scope; label: string; blurb: string }[] = [
  { id: 'day', label: 'This day', blurb: 'Just this one workout.' },
  { id: 'week', label: 'This week', blurb: 'Monday to Sunday.' },
  { id: 'month', label: '4 weeks', blurb: 'This week and the next three.' },
]

interface Props {
  /** Any date in the week/day being shared. */
  date: string
  friendId?: string
  scope?: Scope
  /** When answering a "make me a workout" request. */
  requestId?: string
  /** A ready-made workout, e.g. one you just completed. */
  payloadOverride?: SharedPayload
  titleOverride?: string
  onClose: () => void
}

export function ShareSheet({ date, friendId, scope: initialScope, requestId, payloadOverride, titleOverride, onClose }: Props) {
  const { plan, overrides, custom } = useStore()
  const { friends, act } = useSocial()
  const [scope, setScope] = useState<Scope>(initialScope ?? 'day')
  const [to, setTo] = useState<string | null>(friendId ?? null)
  const [emoji, setEmoji] = useState<string | undefined>()
  const [title, setTitle] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const payload = useMemo(
    () => payloadOverride ?? buildPayload({ scope, dates: datesFor(scope, date), plan, overrides, custom }),
    [payloadOverride, scope, date, plan, overrides, custom],
  )
  const nameOf = (id: string) => findExercise(custom, id)?.name ?? BUILTIN_BY_ID.get(id)?.name
  const autoTitle = titleOverride ?? defaultTitle(payload, nameOf)
  const shownTitle = title ?? autoTitle
  const empty = payload.days.every((d) => d.items.length === 0)
  const recipients = friends.filter((f) => !friendId || f.profile.id === friendId)
  const chosen = friends.find((f) => f.profile.id === to)
  const canSend = !!chosen && chosen.theyGrant.workouts && !empty && shownTitle.trim().length > 0

  const send = async () => {
    if (!chosen) return
    setBusy(true); setError(null)
    const r = await act(async (b) => {
      const id = await b.sendShare({ toId: chosen.profile.id, scope: payload.scope, title: shownTitle.trim().slice(0, 80), emoji, payload })
      if (requestId) await b.respondWorkoutRequest(requestId, 'fulfill', id)
    })
    setBusy(false)
    if (r.ok) setSent(true); else setError(r.error)
  }

  if (sent) {
    return (
      <Sheet title="Sent" onClose={onClose} closeLabel="Done">
        <p className="py-6 text-center text-neutral-600">{emoji ?? '💪'} {chosen?.profile.displayName} can add “{shownTitle}” to their calendar.</p>
        <button onClick={onClose} className={primary}>Done</button>
      </Sheet>
    )
  }

  return (
    <Sheet title={requestId ? 'Make a workout for a friend' : 'Share a workout'} onClose={onClose} closeLabel="Cancel">
      {!payloadOverride && !requestId && (
        <>
          <p className={label}>What to share</p>
          <div className="mb-1 flex flex-wrap gap-2">
            {SCOPES.map((s) => <button key={s.id} onClick={() => { setScope(s.id); setTitle(null) }} className={chip(s.id === scope)}>{s.label}</button>)}
          </div>
          <p className="mb-4 text-xs text-neutral-400">{SCOPES.find((s) => s.id === scope)!.blurb}</p>
        </>
      )}
      {requestId && !payloadOverride && (
        <div className="mb-4">
          <p className={label}>Send as</p>
          <div className="flex flex-wrap gap-2">
            {SCOPES.map((s) => <button key={s.id} onClick={() => { setScope(s.id); setTitle(null) }} className={chip(s.id === scope)}>{s.label}</button>)}
          </div>
        </div>
      )}

      {empty ? (
        <p className="mb-4 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
          Nothing is planned {scope === 'day' ? 'on this day' : 'in this period'} yet. Plan some exercises first, or use Randomize to build a workout, then share it.
        </p>
      ) : (
        <p className="mb-4 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-600">{describePayload(payload)}</p>
      )}

      <p className={label}>Send to</p>
      <div className="mb-4 space-y-1.5">
        {recipients.length === 0 && <p className="text-sm text-neutral-400">You don’t have any friends yet.</p>}
        {recipients.map((f) => {
          const ok = f.theyGrant.workouts
          return (
            <button key={f.profile.id} disabled={!ok} onClick={() => setTo(f.profile.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${to === f.profile.id ? 'bg-accent text-on-accent' : 'bg-neutral-50'} disabled:opacity-50`}>
              <Avatar profile={f.profile} size="sm" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{f.profile.displayName}</span><span className={`block text-xs ${to === f.profile.id ? 'text-neutral-300' : 'text-neutral-400'}`}>@{f.profile.handle}</span></span>
              {!ok && <span className="text-xs text-neutral-400">hasn’t allowed workouts</span>}
            </button>
          )
        })}
      </div>

      <label className={`${label} block`}>Title</label>
      <input value={shownTitle} maxLength={80} onChange={(e) => setTitle(e.target.value)} className={`${input} mb-4`} />

      <p className={label}>Add an emoji (optional)</p>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {EMOJI.map((e) => <button key={e} onClick={() => setEmoji(emoji === e ? undefined : e)} className={`h-9 w-9 rounded-full text-lg ${emoji === e ? 'bg-accent' : 'bg-neutral-100'}`}>{e}</button>)}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      <button disabled={!canSend || busy} onClick={send} className={primary}>{busy ? 'Sending…' : 'Send'}</button>
      <p className="mt-2 text-center text-xs text-neutral-400">They choose whether to add it. Nothing changes on their calendar until they do.</p>
    </Sheet>
  )
}

