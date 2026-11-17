import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import { requestPersistentStorage } from './lib/persist'
import { ErrorBoundary } from './components/ErrorBoundary'
import { startUpdateChecks } from './lib/appUpdate'

// Reload onto new versions as soon as they're available, and re-check whenever the app is reopened.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void reg?.update()
    })
  },
})
startUpdateChecks()
void requestPersistentStorage()
// The old app's data (workouts, social) is no longer used.
try { localStorage.removeItem('workout-app-v1') } catch { /* storage blocked */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
