import { useState } from 'react'
import { applyUpdate, checkForUpdate, useAppUpdate } from '../lib/appUpdate'
import { APP_VERSION } from '../lib/feedback'

/** Settings → Help: which version this is, and a manual check (with a clean reload as the fix for a stuck copy). */
export function VersionRow() {
  const { latest, checking } = useAppUpdate()
  const [checked, setChecked] = useState(false)
  const check = async () => { await checkForUpdate(); setChecked(true) }
  return (
    <div className="rounded-2xl bg-surface px-4 py-3 shadow-sm ring-1 ring-neutral-200/70">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">
          App version <b className="font-medium tabular-nums">{APP_VERSION}</b>
          <span className="block text-xs text-neutral-400">
            {latest ? `Version ${latest} is ready.` : checked ? 'You’re on the latest version.' : 'Updates install by themselves when you open the app.'}
          </span>
        </span>
        {latest
          ? <button onClick={() => void applyUpdate(latest)} className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-on-accent">Update now</button>
          : <button disabled={checking} onClick={() => void check()} className="shrink-0 rounded-full bg-neutral-100 px-4 py-1.5 text-sm text-neutral-700">{checking ? 'Checking…' : 'Check for updates'}</button>}
      </div>
      {checked && !latest && (
        <button onClick={() => void applyUpdate()} className="mt-2 text-xs text-neutral-500 underline underline-offset-2">
          Something still looks old? Reload the app fresh (your workouts stay)
        </button>
      )}
    </div>
  )
}
