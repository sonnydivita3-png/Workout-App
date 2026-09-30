import { useSyncExternalStore } from 'react'

interface InstallEvent extends Event {
  prompt: () => Promise<void>
}

// Chrome/Android fire this once, early; capture it at startup so any screen can offer "Install".
let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent; emit() })
  window.addEventListener('appinstalled', () => { deferred = null; emit() })
}

export const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)
export const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

/** The browser's install prompt, when it has offered one. */
export function useInstallPrompt(): (() => Promise<void>) | null {
  const evt = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => deferred, () => null)
  return evt ? async () => { await evt.prompt(); deferred = null; emit() } : null
}

/**
 * Ask the browser not to clear this site's storage when space runs low or the site goes unused (Safari otherwise can
 * after about a week). Installed apps usually get this automatically; it's a no-op where unsupported.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
