import { useId, useRef } from 'react'
import { useModal } from '../lib/useModal'

interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
  closeLabel?: string
}

/** The backdrop and panel every sheet shares (the exercise picker builds its own on the same classes). */
export const sheetBackdrop = 'sheet-backdrop fixed inset-0 z-20 flex items-end bg-black/40 sm:items-center sm:justify-center'
export const sheetPanel = 'sheet-panel flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl outline-none ring-1 ring-neutral-200/60 sm:max-w-md sm:rounded-3xl sm:pt-4'
/** The grabber at the top of a bottom sheet (a phone convention: it reads as "this slid up and can go away"). */
export const SheetHandle = () => <div aria-hidden className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-neutral-300 sm:hidden" />

export function Sheet({ title, onClose, children, closeLabel = 'Close' }: Props) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  useModal(panel, onClose)
  return (
    <div className={sheetBackdrop} onClick={onClose}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={sheetPanel} onClick={(e) => e.stopPropagation()}>
        <SheetHandle />
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="-mr-2 shrink-0 rounded-full px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100">{closeLabel}</button>
        </div>
        <div className="overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  )
}

export const primaryBtn = 'w-full rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent disabled:opacity-30'
export const rowBtn = 'flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-neutral-50 disabled:opacity-40'
