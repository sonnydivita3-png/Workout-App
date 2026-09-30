import { useEffect } from 'react'
import { getBackend } from '../social'
import { describeError } from '../social/store'
import { useStore } from '../store'
import { decideSync, fingerprint, SYNC_KEYS, syncPayload } from './sync'
import { useToasts } from '../toastStore'

const DELAY = 4000
let running: Promise<void> | null = null

const isEmpty = (d: Record<string, unknown>) =>
  !(d.logs as unknown[]).length && !(d.goals as unknown[]).length && !(d.routines as unknown[]).length && !Object.keys(d.overrides as object).length &&
  !(d.plan as unknown[][]).some((x) => x.length) && !(d.bodyweight as unknown[]).length

/** Back up or restore now. Safe to call often; runs one at a time. */
export function syncNow(force?: 'keep-local' | 'use-cloud'): Promise<void> {
  if (running) return running
  running = (async () => {
    const st = useStore.getState()
    const backend = getBackend()
    try {
      const user = await backend.currentUser()
      if (!user) { st.setCloud({ error: 'Sign in to back up.', checkedAt: Date.now() }); return }
      const local = syncPayload(st as unknown as Record<string, unknown>)
      const localHash = fingerprint(local)
      const remote = await backend.pullData()
      const action = force === 'keep-local' ? 'push' : force === 'use-cloud' ? (remote ? 'pull' : 'none') : decideSync({ localHash, localEmpty: isEmpty(local), remote, meta: st.cloud })
      if (action === 'push') {
        const updatedAt = await backend.pushData(local)
        st.setCloud({ lastSyncedAt: updatedAt, lastHash: localHash, conflict: false, error: null, checkedAt: Date.now() })
      } else if (action === 'pull' && remote) {
        st.replaceData(remote.data)
        useToasts.getState().push({ id: `restored-${remote.updatedAt}`, title: 'Synced from your backup ☁️', body: `Updated with the copy saved ${new Date(remote.updatedAt).toLocaleString()}.` })
        const after = fingerprint(syncPayload(useStore.getState() as unknown as Record<string, unknown>))
        st.setCloud({ lastSyncedAt: remote.updatedAt, lastHash: after, conflict: false, error: null, checkedAt: Date.now() })
      } else if (action === 'conflict') {
        st.setCloud({ conflict: true, error: null, checkedAt: Date.now() })
      } else {
        st.setCloud({ error: null, checkedAt: Date.now() })
      }
    } catch (e) {
      st.setCloud({ error: describeError(e), checkedAt: Date.now() })
    } finally {
      running = null
    }
  })()
  return running
}

/** While cloud backup is on: sync on open, when the app comes back to the front, and a few seconds after changes. */
export function useCloudSync() {
  const enabled = useStore((s) => s.cloud.enabled)
  useEffect(() => {
    if (!enabled) return
    void syncNow()
    let timer: ReturnType<typeof setTimeout> | undefined
    // State updates are immutable, so a changed field is a new object: no need to hash on every keystroke.
    const unsub = useStore.subscribe((s, prev) => {
      if (!SYNC_KEYS.some((k) => s[k] !== prev[k])) return
      clearTimeout(timer)
      timer = setTimeout(() => { if (!useStore.getState().cloud.conflict) void syncNow() }, DELAY)
    })
    const onShow = () => { if (document.visibilityState === 'visible') void syncNow() }
    document.addEventListener('visibilitychange', onShow)
    return () => { unsub(); clearTimeout(timer); document.removeEventListener('visibilitychange', onShow) }
  }, [enabled])
}
