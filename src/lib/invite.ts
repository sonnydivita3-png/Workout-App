import { HANDLE_RE, normalizeHandle } from '../social/types'

const APP_NAME = 'EZ Workout Tracker'

/** Link to the app. With a handle, opening it offers to add that person as a friend. */
export function inviteUrl(handle?: string, from = window.location.href, base = import.meta.env.BASE_URL): string {
  // BASE_URL is absolute on the deployed site and './' locally; both resolve against the current page.
  const url = new URL(base, from)
  url.search = ''
  url.hash = ''
  if (handle) url.searchParams.set('add', handle)
  return url.toString()
}

export function inviteText(handle?: string): string {
  return handle
    ? `Train with me on ${APP_NAME}: plan workouts, track progress and beat your last time. It's free. Add me: @${handle}`
    : `I'm using ${APP_NAME} to plan workouts and beat my last time. It's free, try it:`
}

/** The handle in an invite link (?add=handle), if it's a valid one. */
export function readInvite(search: string): string | null {
  const raw = new URLSearchParams(search).get('add')
  if (!raw) return null
  const h = normalizeHandle(raw)
  return HANDLE_RE.test(h) ? h : null
}

/** Take the invite out of the address bar so a reload or bookmark doesn't bring it back. */
export function clearInviteParam() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('add')) return
  url.searchParams.delete('add')
  window.history.replaceState(window.history.state, '', url.toString())
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed'

/** Open the phone's share sheet, or copy the invite when there isn't one. */
export async function shareInvite(handle?: string): Promise<ShareResult> {
  const url = inviteUrl(handle)
  const text = inviteText(handle)
  if (navigator.share) {
    try {
      await navigator.share({ title: APP_NAME, text, url })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // Some browsers refuse (not allowed here, too long); fall back to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}
