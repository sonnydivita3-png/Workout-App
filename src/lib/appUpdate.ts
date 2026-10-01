import { create } from 'zustand'
import { APP_VERSION } from './feedback'

/**
 * Keeping phones on the latest version. The service worker updates in the background, but that can stall (an
 * installed iPhone app may hold an old copy for days). So the app also asks the server which version is current
 * (version.json, never cached) on launch, when reopened and every 30 minutes:
 * - right after launch, before anything's been done, it updates straight away;
 * - later on it shows an Update banner instead, so a workout in progress isn't interrupted.
 * Updating clears the cached app files (never workouts, which live separately) and reloads from the server.
 */
interface UpdateState {
  /** The newer version on the server, if there is one. */
  latest: string | null
  checking: boolean
  checkedAt: number | null
}
export const useAppUpdate = create<UpdateState>(() => ({ latest: null, checking: false, checkedAt: null }))

const LAUNCH_WINDOW_MS = 4000
const INTERVAL_MS = 30 * 60 * 1000
const ATTEMPT_KEY = 'ez-update-attempt'
const started = Date.now()

/** Ask the server for the current version. Returns the newer version, or null if this one is current (or offline). */
export async function checkForUpdate(): Promise<string | null> {
  useAppUpdate.setState({ checking: true })
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const { version } = (await res.json()) as { version?: string }
    const latest = version && version !== APP_VERSION ? version : null
    useAppUpdate.setState({ latest })
    return latest
  } catch {
    return null
  } finally {
    useAppUpdate.setState({ checking: false, checkedAt: Date.now() })
  }
}

/** Drop the cached app (service worker and its caches; workouts are untouched) and load the latest from the server. */
export async function applyUpdate(version = useAppUpdate.getState().latest ?? 'latest'): Promise<void> {
  try { sessionStorage.setItem(ATTEMPT_KEY, version) } catch { /* storage blocked */ }
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
  } catch { /* no service worker */ }
  try {
    const keys = (await globalThis.caches?.keys()) ?? []
    await Promise.all(keys.map((k) => caches.delete(k)))
  } catch { /* no cache storage */ }
  // A fresh address so no cached copy of the page can be reused on the way back in.
  const url = new URL(window.location.href)
  url.searchParams.set('v', version)
  window.location.replace(url.toString())
}

/** Start checking. Call once at startup. */
export function startUpdateChecks() {
  // Coming back from an update: tidy the address bar.
  const url = new URL(window.location.href)
  if (url.searchParams.has('v')) {
    url.searchParams.delete('v')
    window.history.replaceState(window.history.state, '', url.toString())
  }
  const run = async () => {
    const latest = await checkForUpdate()
    if (!latest) return
    // Just opened and nothing done yet: update now. Once per version per session, so a slow server can't loop it.
    let tried: string | null = null
    try { tried = sessionStorage.getItem(ATTEMPT_KEY) } catch { /* storage blocked */ }
    if (Date.now() - started < LAUNCH_WINDOW_MS && tried !== latest) void applyUpdate(latest)
  }
  void run()
  let last = Date.now()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - last < 60_000) return
    last = Date.now()
    void checkForUpdate()
  })
  setInterval(() => { if (document.visibilityState === 'visible') void checkForUpdate() }, INTERVAL_MS)
}
