import { useMemo, useState } from 'react'
import { addDays, DAY_LABELS, fmtLong, mondayOf, parseISO, toISO, weekdayIndex } from '../../lib/dates'
import { describeItem } from '../../lib/describe'
import { dayPlanOf } from '../../lib/plan'
import { useToday } from '../../lib/useToday'
import { describePayload, planFromPayload, sanitizePayload, startFor } from '../../social/share'
import { useSocial } from '../../social/store'
import type { SharedWorkout } from '../../social/types'
import { findExercise, useStore } from '../../store'
import { Sheet } from '../Sheet'
import { chip, label, primary, secondary } from './styles'
import { Avatar, ErrorNote } from './ui'

/** Preview a friend's shared workout and, if you want it, add it to your calendar. */
export function AddSharedSheet({ share, onClose }: { share: SharedWorkout; onClose: () => void }) {
  const today = useToday()
  const { plan, overrides, custom, units, applyDays, addCustomExercises } = useStore()
  const act = useSocial((s) => s.act)
  const clean = useMemo(() => sanitizePayload(share.payload), [share.payload]) // received from another person: never trusted as-is
  const [start, setStart] = useState(share.scope === 'day' ? today : toISO(mondayOf(parseISO(today))))
  const [replace, setReplace] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const begin = startFor(share.scope, start)
  const preview = useMemo(() => (clean ? planFromPayload(clean, begin, custom) : null), [clean, begin, custom])
  const nameOf = (id: string) => findExercise(custom, id)?.name ?? preview?.newCustom.find((c) => c.id === id)?.name ?? id
  const exOf = (id: string) => findExercise(custom, id) ?? preview?.newCustom.find((c) => c.id === id)
  const dates = preview ? Object.keys(preview.days).sort() : []
  const clashes = dates.filter((d) => dayPlanOf(plan, overrides, d).length > 0).length

  const respond = async (added: boolean) => {
    setBusy(true); setError(null)
    if (added && preview) { applyDays(preview.days, replace); addCustomExercises(preview.newCustom) }
    const r = await act((b) => b.respondShare(share.id, added))
    setBusy(false)
    if (r.ok) onClose(); else setError(r.error)
  }

  return (
    <Sheet title={share.title} onClose={onClose} closeLabel="Close">
      <div className="mb-3 flex items-center gap-3">
        <Avatar profile={share.from} size="sm" />
        <p className="text-sm text-neutral-600">{share.emoji} From {share.from.displayName} · {clean ? describePayload(clean) : ''}</p>
      </div>
      {clean?.results && (
        <p className="mb-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          <span className="block text-sm font-semibold text-neutral-700">What {share.from.displayName} did</span>
          {clean.results.join(' · ')}
        </p>
      )}
      {!clean || !preview ? (
        <ErrorNote>This workout can’t be opened. It may have come from a newer version of the app.</ErrorNote>
      ) : (
        <>
          {share.scope !== 'day' ? (
            <>
              <p className={label}>Start on</p>
              <div className="mb-4 flex flex-wrap gap-2">
                <button onClick={() => setStart(toISO(mondayOf(parseISO(today))))} className={chip(begin === toISO(mondayOf(parseISO(today))))}>This week</button>
                <button onClick={() => setStart(toISO(addDays(mondayOf(parseISO(today)), 7)))} className={chip(begin === toISO(addDays(mondayOf(parseISO(today)), 7)))}>Next week</button>
                <input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} aria-label="Start date" className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm outline-none" />
              </div>
              <p className="-mt-2 mb-4 text-xs text-neutral-400">Weeks start on Monday: {fmtLong(begin)}.</p>
            </>
          ) : (
            <>
              <p className={label}>Do it on</p>
              <input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} aria-label="Date" className="mb-4 rounded-xl bg-neutral-100 px-3 py-2 outline-none" />
            </>
          )}

          <ul className="mb-4 max-h-64 divide-y divide-neutral-100 overflow-y-auto rounded-2xl bg-neutral-50 px-3">
            {dates.map((d) => (
              <li key={d} className="py-2">
                <p className="text-sm font-semibold text-neutral-700">{DAY_LABELS[weekdayIndex(parseISO(d))]} · {fmtLong(d)}</p>
                {preview.days[d].map((it) => {
                  const ex = exOf(it.exerciseId)
                  return <p key={it.exerciseId} className="text-sm">{nameOf(it.exerciseId)}<span className="ml-2 text-xs text-neutral-400">{ex ? describeItem(it, ex, units) : ''}</span></p>
                })}
              </li>
            ))}
          </ul>
          {preview.skipped > 0 && <p className="mb-3 text-xs text-neutral-400">{preview.skipped} exercise{preview.skipped === 1 ? '' : 's'} couldn’t be added because this version of the app doesn’t have {preview.skipped === 1 ? 'it' : 'them'}.</p>}
          {clashes > 0 && (
            <label className="mb-3 flex items-center gap-3 text-sm">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="h-4 w-4" />
              Replace what I already have on {clashes} of these day{clashes === 1 ? '' : 's'}
            </label>
          )}
          {clashes > 0 && !replace && <p className="mb-3 text-xs text-neutral-400">Otherwise these are added alongside your own exercises.</p>}
        </>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      <button disabled={busy || !preview || dates.length === 0} onClick={() => respond(true)} className={primary}>Add to my calendar</button>
      <button disabled={busy} onClick={() => respond(false)} className={`${secondary} mt-2`}>Not now</button>
    </Sheet>
  )
}
