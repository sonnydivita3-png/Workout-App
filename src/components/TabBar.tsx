import { pendingCount, useSocial } from '../social/store'
import { useStore } from '../store'

export type Tab = 'home' | 'plan' | 'history' | 'social' | 'settings'

const TABS: { id: Tab; label: string; d: string }[] = [
  { id: 'home', label: 'Home', d: 'M3 11l9-8 9 8M5 10v10h14V10' },
  { id: 'plan', label: 'Workouts', d: 'M6 4v16M18 4v16M3 8v8M21 8v8M6 12h12' },
  { id: 'history', label: 'Progress', d: 'M4 19V9M10 19V5M16 19v-7M22 19H2' },
  { id: 'social', label: 'Social', d: 'M16 11a3 3 0 100-6 3 3 0 000 6zM8 12a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 3-5 6-5s6 2 6 5M14 15c3 0 8 1 8 5' },
]
// Settings opens from the gear on Home, which keeps the bar to the places used every day (gear outline: Feather, MIT).
export const SETTINGS_ICON = 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const seen = useStore((s) => s.seenChallenges)
  const badge = useSocial((s) => pendingCount(s, seen))
  // Someone who turned friends off doesn't need a tab for them (they can turn it on in Settings).
  const hideSocial = useStore((s) => s.socialChoice === 'declined')
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {TABS.filter((t) => !(t.id === 'social' && hideSocial)).map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            aria-current={t.id === tab ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${t.id === tab ? 'font-medium text-neutral-900' : 'text-neutral-400'}`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d={t.d} />
            </svg>
            <span className="relative">
              {t.label}
              {t.id === 'social' && badge > 0 && <span aria-label={`${badge} waiting`} className="absolute -right-3 -top-4 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] leading-4 text-white">{badge}</span>}
            </span>
          </button>
        ))}
      </div>
    </nav>
  )
}
