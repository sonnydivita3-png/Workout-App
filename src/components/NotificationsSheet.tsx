import { useStore } from '../store'
import type { NotificationType } from '../types'
import { Sheet } from './Sheet'

const DOT: Record<NotificationType, string> = {
  'goal-reached': 'bg-emerald-500',
  'goal-close': 'bg-amber-500',
  pr: 'bg-sky-500',
  planned: 'bg-neutral-400',
}

const ago = (ts: number) => {
  const m = Math.round((Date.now() - ts) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 60 * 24) return `${Math.round(m / 60)}h ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function NotificationsSheet({ onClose }: { onClose: () => void }) {
  const notifications = useStore((s) => s.notifications)
  const { markAllRead, clearNotifications } = useStore()
  const close = () => { markAllRead(); onClose() }

  return (
    <Sheet title="Notifications" onClose={close}>
      {notifications.length === 0 ? (
        <p className="py-8 text-center text-neutral-400">
          Nothing yet. You’ll see goal progress, personal bests, and workout reminders here.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-neutral-100">
            {notifications.map((n) => (
              <li key={n.id} className="flex gap-3 py-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-neutral-200' : DOT[n.type]}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${n.read ? 'text-neutral-600' : 'font-medium'}`}>{n.title}</span>
                  <span className="block text-sm text-neutral-500">{n.body}</span>
                </span>
                <span className="shrink-0 text-xs text-neutral-400">{ago(n.ts)}</span>
              </li>
            ))}
          </ul>
          <button onClick={clearNotifications} className="mt-3 w-full text-center text-sm text-neutral-400">Clear all</button>
        </>
      )}
    </Sheet>
  )
}
