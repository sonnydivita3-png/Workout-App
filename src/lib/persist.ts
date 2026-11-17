/**
 * Ask the browser not to clear this site's storage when space runs low or the site goes unused (Safari otherwise can
 * after about a week). Installed apps usually get this anyway; it's a no-op where unsupported.
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
