import type { Challenge } from './types'

const endDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '')

/** Where a challenge stands, in plain words, from my side. */
export function challengeStatus(c: Challenge): string {
  const name = (c.mine ? c.to : c.from).displayName
  if (c.mine) {
    switch (c.status) {
      case 'pending': return `⏳ Waiting for ${name} to accept`
      case 'active': return `✅ ${name} accepted${c.endsAt ? ` · ends ${endDate(c.endsAt)}` : ''}`
      case 'completed': return c.done ? `🏆 ${name} finished it` : `${name}’s time is up`
      case 'declined': return `${name} declined`
      case 'cancelled': return 'You cancelled it'
    }
  }
  switch (c.status) {
    case 'pending': return `From ${name} · waiting for you`
    case 'active': return `From ${name} · you accepted${c.endsAt ? ` · ends ${endDate(c.endsAt)}` : ''}`
    case 'completed': return c.done ? `From ${name} · 🏆 you finished it` : `From ${name} · time’s up`
    case 'declined': return `From ${name} · you declined`
    case 'cancelled': return `From ${name} · cancelled`
  }
}
