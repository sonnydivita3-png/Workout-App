import { useState } from 'react'
import { HistoryView } from './components/HistoryView'
import { HomeView } from './components/HomeView'
import { PlanView } from './components/PlanView'
import { SettingsView } from './components/SettingsView'
import { Tour } from './components/Tour'
import { Toasts } from './components/Toasts'
import { SocialSetup } from './components/social/SocialSetup'
import { SocialView } from './components/social/SocialView'
import { useTheme } from './lib/useTheme'
import { useSocialSync } from './social/useSocialSync'
import { useStore } from './store'
import { useNotificationEngine } from './lib/useNotificationEngine'
import { TabBar, type Tab } from './components/TabBar'

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const choice = useStore((s) => s.socialChoice)
  const tourDone = useStore((s) => s.tourDone)
  useNotificationEngine()
  useSocialSync()
  useTheme()
  if (choice === 'unset') {
    return (
      <div className="min-h-screen bg-surface">
        <SocialSetup variant="gate" onDone={() => undefined} />
      </div>
    )
  }
  return (
    <>
      <main className="mx-auto min-h-screen max-w-md px-4 pb-40 pt-[max(1.5rem,env(safe-area-inset-top))]">
        {tab === 'home' && <HomeView onNavigate={setTab} />}
        {tab === 'plan' && <PlanView />}
        {tab === 'history' && <HistoryView />}
        {tab === 'social' && <SocialView onNavigate={setTab} />}
        {tab === 'settings' && <SettingsView />}
      </main>
      <TabBar tab={tab} onChange={setTab} />
      <Toasts />
      {!tourDone && <Tour />}
    </>
  )
}
