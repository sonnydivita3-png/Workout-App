export type Tab = 'home' | 'plan' | 'history' | 'settings'

const TABS: { id: Tab; label: string; d: string }[] = [
  { id: 'home', label: 'Home', d: 'M3 11l9-8 9 8M5 10v10h14V10' },
  { id: 'plan', label: 'Plan', d: 'M6 4v16M18 4v16M3 8v8M21 8v8M6 12h12' },
  { id: 'history', label: 'History', d: 'M4 19V9M10 19V5M16 19v-7M22 19H2' },
  { id: 'settings', label: 'Settings', d: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6' },
]

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${t.id === tab ? 'text-neutral-900' : 'text-neutral-400'}`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d={t.d} />
            </svg>
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
