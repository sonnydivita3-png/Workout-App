import type { Challenge } from './types'

const endDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '')

/** An accepted challenge whose time ran out without being finished (the server never moves these on by itself). */
export const timeIsUp = (c: Challenge, now = Date.now()) => c.status === 'active' && !c.done && !!c.endsAt && now > new Date(c.endsAt).getTime()

/** Still going: accepted, not finished, and inside its time. */
export const isLive = (c: Challenge, now = Date.now()) => c.status === 'active' && !timeIsUp(c, now)

/** Where a challenge stands, in plain words, from my side. */
export function challengeStatus(c: Challenge, now = Date.now()): string {
  const name = (c.mine ? c.to : c.from).displayName
  if (timeIsUp(c, now)) return c.mine ? `⏱ Time’s up · ${name} didn’t finish` : `From ${name} · ⏱ time’s up`
  if (c.mine) {
    switch (c.status) {
      case 'pending': return `⏳ Waiting for ${name} to answer`
      case 'active': return `✅ ${name} accepted${c.endsAt ? ` · ends ${endDate(c.endsAt)}` : ''}`
      case 'completed': return c.done ? `🏆 ${name} finished it` : `${name}’s time is up`
      case 'declined': return `${name} said no thanks`
      case 'cancelled': return 'You cancelled it'
    }
  }
  switch (c.status) {
    case 'pending': return `From ${name} · waiting for you`
    case 'active': return `From ${name} · you accepted${c.endsAt ? ` · ends ${endDate(c.endsAt)}` : ''}`
    case 'completed': return c.done ? `From ${name} · 🏆 you finished it` : `From ${name} · time’s up`
    case 'declined': return `From ${name} · you said no thanks`
    case 'cancelled': return `From ${name} · cancelled`
  }
}
