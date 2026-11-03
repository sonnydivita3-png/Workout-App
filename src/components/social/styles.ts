import { chipBtn } from '../ui'

// The app's own chip, button and label styles, so the social screens match the rest.
export const chip = (on: boolean, disabled = false) => (disabled ? 'rounded-full px-3 py-1.5 text-sm bg-neutral-100 text-neutral-300' : chipBtn(on))

export const label = 'mb-2 text-sm font-medium'

export const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 60 * 24) return `${Math.round(m / 60)}h ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export const primary = 'min-h-12 w-full rounded-2xl bg-accent px-4 py-3 text-base font-semibold text-on-accent'
export const secondary = 'min-h-12 w-full rounded-2xl bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-700 disabled:opacity-40'
export const input = 'w-full rounded-xl bg-neutral-100 px-4 py-2.5 outline-none placeholder:text-neutral-400'
