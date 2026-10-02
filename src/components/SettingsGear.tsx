import { SETTINGS_ICON } from './TabBar'

/** The settings gear, top right on every tab (Home has its own next to notifications). */
export function SettingsGear({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Settings" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-200/60">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={SETTINGS_ICON} /></svg>
    </button>
  )
}
