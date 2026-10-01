import { APP_VERSION } from '../../lib/feedback'
import { useSocial } from '../../social/store'

/**
 * Which server this copy of the app talks to, and its version. Friends can only find each other when both phones say
 * "Live server"; an old cached copy can still be in preview mode, where accounts never leave the phone.
 */
export function ConnectionStatus() {
  const { backend, status } = useSocial()
  const live = backend.kind === 'supabase'
  return (
    <p className="text-xs text-neutral-400" aria-label="Connection status">
      {live ? (status === 'error' ? '⚠️ Live server, can’t reach it right now' : '🟢 Live server') : '🟡 Preview only: accounts stay on this phone'}
      {' · '}version {APP_VERSION}
    </p>
  )
}
