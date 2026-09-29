import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
