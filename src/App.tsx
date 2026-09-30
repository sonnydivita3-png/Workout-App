import { useEffect, useState } from 'react'
import { HistoryView } from './components/HistoryView'
import { HomeView } from './components/HomeView'
import { PlanView } from './components/PlanView'
import { SettingsView } from './components/SettingsView'
import { Tour } from './components/Tour'
import { WorkoutSession } from './components/WorkoutSession'
import { Toasts } from './components/Toasts'
import { SocialSetup } from './components/social/SocialSetup'
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
  const [tab, setTab] = useState<Tab>('home')
  // Public pages for app store listings and links: …/#privacy, #terms, #health, #delete-account.
  const [page, setPage] = useState<LegalDoc | null>(pageFromHash)
  useEffect(() => {
    const h = () => { setPage(pageFromHash()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  const choice = useStore((s) => s.socialChoice)
  const showTour = useStore((s) => !s.tourDone || s.tourVersion < TOUR_VERSION)
  const session = useStore((s) => s.session)
  const [hidden, setHidden] = useState(false)
  // A workout left open for half a day was almost certainly forgotten: close it instead of reopening it every launch.
  useEffect(() => {
    const s = useStore.getState().session
    if (s && Date.now() - s.startedAt > 12 * 3600 * 1000) useStore.getState().endSession()
  }, [])
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
        {conflict && tab !== 'settings' && (
          <button onClick={() => setTab('settings')} className="mb-3 w-full rounded-2xl bg-amber-50 px-4 py-2.5 text-left text-sm text-amber-800">⚠️ Your backup and this phone both changed. Tap to choose which to keep.</button>
        )}
        {tab !== 'settings' && <InviteBanner />}
        {tab === 'home' && <HomeView onNavigate={setTab} />}
        {tab === 'plan' && <PlanView />}
        {tab === 'history' && <HistoryView />}
        {tab === 'social' && <SocialView onNavigate={setTab} />}
        {tab === 'settings' && <SettingsView />}
      </main>
      <TabBar tab={tab} onChange={setTab} />
      {session && !hidden && <WorkoutSession onMinimize={() => setHidden(true)} />}
      {session && hidden && (
        <button onClick={() => setHidden(false)} className="fixed inset-x-4 bottom-[calc(8.25rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-md rounded-full bg-accent py-3 text-sm font-medium text-on-accent shadow-lg">
          ▶ Back to your workout
        </button>
      )}
      <Toasts />
      {showTour && <Tour />}
    </>
  )
}
