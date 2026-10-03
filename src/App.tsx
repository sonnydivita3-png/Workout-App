import { UpdateBanner } from './components/UpdateBanner'
import { useEffect, useState } from 'react'
import { HistoryView } from './components/HistoryView'
import { HomeView } from './components/HomeView'
import { PlanView } from './components/PlanView'
import { SettingsView } from './components/SettingsView'
import { Tour } from './components/Tour'
import { Toasts } from './components/Toasts'
import { Onboarding } from './components/Onboarding'
import { SocialView } from './components/social/SocialView'
import { InviteBanner } from './components/social/InviteBanner'
import { clearInviteParam, readInvite } from './lib/invite'
import { LegalPage } from './components/LegalSheet'
import type { LegalDoc } from './lib/legal'

const PAGES: Record<string, LegalDoc> = { '#privacy': 'privacy', '#terms': 'terms', '#health': 'health', '#delete-account': 'delete' }
const pageFromHash = () => PAGES[window.location.hash] ?? null
import { useTheme } from './lib/useTheme'
import { useCloudSync } from './lib/useCloudSync'
import { useBackendSwitch } from './lib/useBackendSwitch'
import { useSocialSync } from './social/useSocialSync'
import { TOUR_VERSION, useStore } from './store'
import { useNotificationEngine } from './lib/useNotificationEngine'
import { TabBar, type Tab } from './components/TabBar'

export default function App() {
  const [chosenTab, setTab] = useState<Tab>('home')
  // Some links open a specific part of a tab (History → Body, Settings → Backup).
  const [sub, setSub] = useState<string | undefined>()
  const navigate = (t: Tab, part?: string) => { setSub(part); setTab(t); window.scrollTo(0, 0) }
  const hideSocial = useStore((s) => s.socialChoice === 'declined')
  // Turning friends off while on the Social tab lands on Home.
  const tab: Tab = hideSocial && chosenTab === 'social' ? 'home' : chosenTab
  // Public pages for app store listings and links: …/#privacy, #terms, #health, #delete-account.
  const [page, setPage] = useState<LegalDoc | null>(pageFromHash)
  useEffect(() => {
    const h = () => { setPage(pageFromHash()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  // New installs get the goal-based setup first; people who used the app before it existed never see it.
  const needsSetup = useStore((s) => !s.onboarded && !s.tourDone)
  const showTour = useStore((s) => !s.tourDone || s.tourVersion < TOUR_VERSION)
  // Opened from an invite link: remember who invited them until they add that person or say not now.
  useEffect(() => {
    const h = readInvite(window.location.search)
    if (h) useStore.getState().setPendingInvite(h)
    clearInviteParam()
  }, [])
  const conflict = useStore((s) => s.cloud.enabled && s.cloud.conflict)
  useNotificationEngine()
  useSocialSync()
  useTheme()
  useBackendSwitch()
  useCloudSync()
  if (page) return <LegalPage doc={page} />
  if (needsSetup) return <Onboarding />
  return (
    <>
      <main data-tour="page" className="mx-auto min-h-screen max-w-md px-4 pb-40 pt-[max(1.5rem,env(safe-area-inset-top))]">
        {conflict && tab !== 'settings' && (
          <button onClick={() => navigate('settings', 'data')} className="mb-3 w-full rounded-2xl bg-amber-50 px-4 py-2.5 text-left text-sm text-amber-800">⚠️ Your backup and this phone both changed. Tap to choose which to keep.</button>
        )}
        <UpdateBanner />
        {tab !== 'settings' && <InviteBanner />}
        {tab === 'home' && <HomeView onNavigate={navigate} />}
        {tab === 'plan' && <PlanView key={sub ?? 'default'} initialAction={sub} onSettings={() => navigate('settings')} />}
        {tab === 'history' && <HistoryView key={sub ?? 'default'} initialTab={sub} onSettings={() => navigate('settings')} />}
        {tab === 'social' && <SocialView onNavigate={navigate} />}
        {tab === 'settings' && <SettingsView key={sub ?? 'default'} initialPage={sub} onBack={() => navigate('home')} />}
      </main>
      <TabBar tab={tab} onChange={(t) => navigate(t)} />
      <Toasts onOpen={(t) => navigate(t)} />
      {showTour && <Tour tab={tab} navigate={navigate} />}
    </>
  )
}
