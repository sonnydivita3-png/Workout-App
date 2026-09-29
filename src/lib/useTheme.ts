import { useEffect } from 'react'
import { useStore } from '../store'

const BG = { dark: '#0d0a15', light: '#f6f4fb' }

/** Apply the chosen look to the page: light/dark (or follow the phone) plus the accent colour. */
export function useTheme() {
  const theme = useStore((s) => s.theme)
  const accent = useStore((s) => s.accent)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved = theme === 'auto' ? (mq.matches ? 'dark' : 'light') : theme
      const root = document.documentElement
      root.dataset.theme = resolved
      root.dataset.accent = accent
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BG[resolved])
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme, accent])
}
