import { useEffect } from 'react'

/** Keep the screen on while `active` (e.g. today's workout is open), so the phone doesn't lock between sets. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    type Lock = { release: () => Promise<void> }
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Lock> } }
    if (!nav.wakeLock) return
    let lock: Lock | null = null
    let live = true
    const get = () => { if (document.visibilityState === 'visible') nav.wakeLock!.request('screen').then((l) => { if (live) lock = l; else void l.release() }).catch(() => undefined) }
    get()
    // The browser drops the lock when the app is in the background; take it again on return.
    document.addEventListener('visibilitychange', get)
    return () => { live = false; document.removeEventListener('visibilitychange', get); void lock?.release().catch(() => undefined) }
  }, [active])
}
