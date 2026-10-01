import { applyUpdate, useAppUpdate } from '../lib/appUpdate'

/** A newer version is out: one tap to get it. Shown instead of updating mid-workout. */
export function UpdateBanner() {
  const latest = useAppUpdate((s) => s.latest)
  if (!latest) return null
  return (
    <div role="status" className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 shadow-sm ring-1 ring-accent/40">
      <p className="text-sm"><span aria-hidden>✨ </span>A new version of the app is ready.</p>
      <button onClick={() => void applyUpdate(latest)} className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-on-accent">Update</button>
    </div>
  )
}
