import { useEffect } from 'react'
import { getBackend } from '../social'
import { useStore } from '../store'
import { useToasts } from '../toastStore'

/**
 * When the app moves from preview mode (simulated friends, backup kept in the browser) to a real server, the preview
 * account doesn't exist there. Ask the person to set social up again and switch backup off until they sign in, instead
 * of showing errors. Their workouts on the phone are untouched.
 */
export function useBackendSwitch() {
  useEffect(() => {
    const kind = getBackend().kind
    const s = useStore.getState()
    let demoData = false
    try { demoData = !!localStorage.getItem('ez-social-demo-v1') } catch { /* storage blocked */ }
    const wasDemo = s.backendKind === 'demo' || (s.backendKind === null && demoData)
    if (wasDemo && kind === 'supabase') {
      const hadSocial = s.socialChoice === 'enabled'
      const hadBackup = s.cloud.enabled
      if (hadSocial) s.setSocialChoice('unset')
      s.setCloud({ enabled: false, lastSyncedAt: null, lastHash: null, conflict: false, error: null })
      if (hadSocial || hadBackup) {
        useToasts.getState().push({ id: 'went-live', title: 'Friends and backup are live 🎉', body: 'The preview is over. Set them up again to use real accounts. Your workouts are all still here.' })
      }
    }
    if (s.backendKind !== kind) s.setPrefs({ backendKind: kind })
  }, [])
}
