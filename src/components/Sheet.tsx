import { useEffect, useId, useRef } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
}

/** A bottom sheet: Escape or a tap outside closes it, and focus starts inside it. */
export function Sheet({ title, onClose, children }: Props) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  // The latest onClose, so a parent re-rendering doesn't re-run the setup (and steal focus).
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current() }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; before?.focus?.() }
  }, [])
  return (
    <div className="sheet-backdrop fixed inset-0 z-20 flex items-end bg-black/45 sm:items-center sm:justify-center" onClick={onClose}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onClick={(e) => e.stopPropagation()}
        className="sheet-panel flex max-h-[88vh] w-full flex-col rounded-t-3xl bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl outline-none ring-1 ring-neutral-200/60 sm:max-w-md sm:rounded-3xl">
        <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="-mr-2 flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-neutral-500">Close</button>
        </div>
        <div className="overflow-y-auto overscroll-contain pb-2">{children}</div>
      </div>
    </div>
  )
}

export const primaryBtn = 'w-full min-h-12 rounded-2xl bg-accent px-4 py-3 text-base font-semibold text-on-accent'
export const secondaryBtn = 'min-h-12 rounded-2xl bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-700 disabled:opacity-40'
