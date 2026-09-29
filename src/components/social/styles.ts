export const chip = (on: boolean, disabled = false) =>
  `rounded-full px-3 py-1.5 text-sm ${disabled ? 'bg-neutral-100 text-neutral-300' : on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`

export const label = 'mb-2 text-xs uppercase tracking-wide text-neutral-400'

export const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 60 * 24) return `${Math.round(m / 60)}h ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export const primary = 'w-full rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent disabled:opacity-30'
export const secondary = 'w-full rounded-2xl bg-neutral-100 py-3 text-sm font-medium text-neutral-700 disabled:opacity-40'
export const input = 'w-full rounded-xl bg-neutral-100 px-4 py-2.5 outline-none placeholder:text-neutral-400'
