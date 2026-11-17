import { useEffect, useState } from 'react'
import { CalendarView } from './components/CalendarView'
import { PlanView } from './components/PlanView'
import { SettingsSheet } from './components/SettingsSheet'
import { TodayView } from './components/TodayView'
import { UpdateBanner } from './components/UpdateBanner'
import { WeightView } from './components/WeightView'
import { useToday } from './lib/dates'
import { useStore } from './lib/store'

type Tab = 'today' | 'calendar' | 'weight' | 'plan'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: 'M5 12l4 4 10-10' },
  { id: 'calendar', label: 'Calendar', icon: 'M4 7h16M4 7v12h16V7M4 7V5h16v2M8 3v4M16 3v4' },
  { id: 'weight', label: 'Weight', icon: 'M4 19h16M6 15l4-5 3 3 5-7' },
  { id: 'plan', label: 'Plan', icon: 'M6 4h9l3 3v13H6zM9 10h6M9 14h6M9 18h4' },
]

export default function App() {
  const today = useToday()
  const [tab, setTab] = useState<Tab>('today')
  const [date, setDate] = useState(today)
  const [settings, setSettings] = useState(false)
  const theme = useStore((s) => s.theme)

  // Apply the theme (and follow the phone's setting on Auto).
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => { document.documentElement.dataset.theme = theme === 'auto' ? (mq.matches ? 'dark' : 'light') : theme }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  // A new day while the app was open: follow it if you were on today.
  const [lastToday, setLastToday] = useState(today)
  if (lastToday !== today) {
    setLastToday(today)
    if (date === lastToday) setDate(today)
  }

  const go = (t: Tab) => { setTab(t); window.scrollTo({ top: 0 }) }

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mb-2 flex justify-end">
        <button onClick={() => setSettings(true)} aria-label="Settings" className="hit rounded-full p-2 text-neutral-500">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </button>
      </div>
      <UpdateBanner />
      <main>
        {tab === 'today' && <TodayView date={date} setDate={setDate} today={today} />}
        {tab === 'calendar' && <CalendarView today={today} onOpen={(d) => { setDate(d); go('today') }} />}
        {tab === 'weight' && <WeightView today={today} />}
        {tab === 'plan' && <PlanView today={today} />}
      </main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200/70 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { if (t.id === 'today' && tab === 'today') setDate(today); go(t.id) }} aria-current={tab === t.id ? 'page' : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${tab === t.id ? 'text-accent-ink' : 'text-neutral-500'}`}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={t.icon} /></svg>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      {settings && <SettingsSheet onClose={() => setSettings(false)} />}
    </div>
  )
}
