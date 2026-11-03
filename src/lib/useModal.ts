import { useEffect, useRef, type RefObject } from 'react'

// Open sheets, newest last: Escape closes only the one on top (a picker opened from the workout maker, say).
const open: { current: () => void }[] = []

/**
 * Behaviour every sheet shares: Escape closes the top one, the page behind doesn't scroll while one is open, focus
 * moves into it (unless something in it already took focus) and goes back where it was when it closes.
 */
export function useModal(panel: RefObject<HTMLElement | null>, onClose: () => void) {
  // The latest onClose, without re-running the effect (and re-stacking the sheet) on every render.
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })
  // What had focus when it opened, read on the first render: before a field inside it can take focus on mounting.
  const opener = useRef<Element | null | undefined>(undefined)
  if (opener.current === undefined) opener.current = document.activeElement
  useEffect(() => {
    const entry = { current: () => close.current() }
    open.push(entry)
    const before = opener.current instanceof HTMLElement ? opener.current : null
    const el = panel.current
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true })
    const body = document.body.style
    const overflow = body.overflow
    body.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || open.at(-1) !== entry) return
      e.preventDefault()
      entry.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      open.splice(open.indexOf(entry), 1)
      if (open.length === 0) body.overflow = overflow === 'hidden' ? '' : overflow
      // Back to the button that opened it, if it's still on the page.
      if (before?.isConnected) before.focus({ preventScroll: true })
    }
  }, [panel])
}
