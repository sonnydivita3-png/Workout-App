interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
  closeLabel?: string
}

export function Sheet({ title, onClose, children, closeLabel = 'Close' }: Props) {
  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/30 sm:items-center sm:justify-center" onClick={onClose}>
      <div
        data-tour="sheet"
        className="flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} data-tour="sheet-close" className="text-sm text-neutral-500">{closeLabel}</button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

export const primaryBtn = 'w-full rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent disabled:opacity-30'
export const rowBtn = 'flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-neutral-50 disabled:opacity-40'
