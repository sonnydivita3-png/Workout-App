import { useState } from 'react'
import { HistoryView } from './components/HistoryView'
import { PlanView } from './components/PlanView'
import { SettingsView } from './components/SettingsView'
import { TabBar, type Tab } from './components/TabBar'

export default function App() {
  const [tab, setTab] = useState<Tab>('plan')
  return (
    <>
      <main className="mx-auto min-h-screen max-w-md px-4 pb-40 pt-[max(1.5rem,env(safe-area-inset-top))]">
        {tab === 'plan' && <PlanView />}
        {tab === 'history' && <HistoryView />}
        {tab === 'settings' && <SettingsView />}
      </main>
      <TabBar tab={tab} onChange={setTab} />
    </>
  )
}
