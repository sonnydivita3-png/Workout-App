import { useStore } from '../store'
import { isIos, isStandalone, useInstallPrompt } from '../lib/install'
import type { Tab } from './TabBar'

const DAY = 86400000
const snoozed = (at: number | undefined, days: number) => !!at && Date.now() - at < days * DAY

/**
 * Workouts live on the phone, so the two things that protect them are installing the app (browsers, Safari above all,
 * may clear a website's data) and cloud backup. Home shows one gentle reminder at a time until each is done.
 */
export function SafetyNudge({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const snooze = useStore((s) => s.nudgeSnooze)
  const snoozeNudge = useStore((s) => s.snoozeNudge)
  const cloudOn = useStore((s) => s.cloud.enabled)
  const loggedDays = useStore((s) => new Set(s.logs.map((l) => l.date)).size)
  const install = useInstallPrompt()
  const ios = isIos()

  const card = 'rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-accent/40'
  const later = (id: string) => <button onClick={() => snoozeNudge(id)} className="rounded-full bg-neutral-100 px-4 py-1.5 text-sm text-neutral-600">Later</button>

  if (!isStandalone() && !snoozed(snooze.install, 14)) {
    return (
      <div className={card}>
        <p className="mb-1 text-sm font-medium">📲 Add the app to your home screen</p>
        <p className="mb-3 text-xs text-neutral-500">
          {ios
            ? 'Your workouts are saved on this phone. Safari can erase a website’s data after a week or so without use, so add it to your Home Screen: tap Share, then “Add to Home Screen”.'
            : 'Your workouts are saved on this phone. Installing keeps them safe from browser clean-ups and opens the app full screen.'}
          {!install && !ios && ' Open the browser’s ⋮ menu and choose “Install app”.'}
        </p>
        <div className="flex gap-2">
          {install && <button onClick={install} className="rounded-full bg-accent px-4 py-1.5 text-sm text-on-accent">Install</button>}
          {later('install')}
        </div>
      </div>
    )
  }

  if (!cloudOn && loggedDays >= 3 && !snoozed(snooze.backup, 30)) {
    return (
      <div className={card}>
        <p className="mb-1 text-sm font-medium">☁️ Back up your workouts</p>
        <p className="mb-3 text-xs text-neutral-500">You’ve logged {loggedDays} days. If you lose or reset your phone, a backup brings them back. It’s free and email is optional.</p>
        <div className="flex gap-2">
          <button onClick={() => onNavigate('settings')} className="rounded-full bg-accent px-4 py-1.5 text-sm text-on-accent">Set up backup</button>
          {later('backup')}
        </div>
      </div>
    )
  }
  return null
}
