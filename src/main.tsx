import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import { requestPersistentStorage } from './lib/install'
import { installErrorLog } from './lib/feedback'
import { ErrorBoundary } from './components/ErrorBoundary'

// Reload onto new versions as soon as they're available, and re-check whenever the app is reopened.
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg?.update()
    })
  },
})
void updateSW
void requestPersistentStorage()
installErrorLog()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
