export function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </svg>
  )
}

export function Chevron({ dir = 'right', className = 'h-4 w-4' }: { dir?: 'left' | 'right' | 'down' | 'up'; className?: string }) {
  const rot = { right: 0, down: 90, left: 180, up: 270 }[dir]
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} style={{ transform: `rotate(${rot}deg)` }} aria-hidden>
      <path d="M7.5 4.5l5.5 5.5-5.5 5.5" />
    </svg>
  )
}

/** A round check button: done (filled) or not. */
export function CheckButton({ checked, onClick, label, size = 'h-9 w-9' }: { checked: boolean; onClick: () => void; label: string; size?: string }) {
  return (
    <button role="checkbox" aria-checked={checked} aria-label={label} onClick={onClick}
      className={`hit flex shrink-0 items-center justify-center rounded-full ${size} ${checked ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-transparent ring-1 ring-neutral-300'}`}>
      <CheckIcon className="h-5 w-5" />
    </button>
  )
}

export const card = 'rounded-3xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/60'
export const sectionTitle = 'mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500'
export const input = 'w-full rounded-xl bg-neutral-100 px-3 py-2 text-base text-neutral-900 outline-none placeholder:text-neutral-400'
