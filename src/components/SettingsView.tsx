import { useRef, useState } from 'react'
import { syncPayload } from '../lib/sync'
import { useStore, type Accent } from '../store'
import { Sheet } from './Sheet'
import { SocialSettings } from './social/SocialSettings'
import { CloudBackup } from './CloudBackup'
import { AccountSection } from './AccountSection'
import { InviteButton } from './InviteButton'
import { useSocial } from '../social/store'
import { LegalSheet } from './LegalSheet'
import { LEGAL_TITLES, type LegalDoc } from '../lib/legal'
import { isIos, isStandalone, useInstallPrompt } from '../lib/install'
import { APP_VERSION, feedbackLink } from '../lib/feedback'

const ACCENTS: [Accent, string][] = [['lime', '#c8ff3e'], ['pink', '#ff5cae'], ['violet', '#a78bfa'], ['orange', '#ff9f45'], ['blue', '#5eb1ff']]

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-full bg-neutral-100 p-0.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-full px-4 py-1 text-sm capitalize ${o === value ? 'bg-surface shadow-sm' : 'text-neutral-500'}`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-accent' : 'bg-neutral-200'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`} />
    </button>
  )
}

const Row = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70">
    <span>{title}</span>
    {children}
  </div>
)

type Page = 'profile' | 'workouts' | 'look' | 'notifications' | 'data' | 'social' | 'help'
// Line icons (24px grid), matching the tab bar.
const PAGES: { id: Page; title: string; icon: string }[] = [
  { id: 'profile', title: 'Profile & units', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6' },
  { id: 'workouts', title: 'Workouts', icon: 'M6 4v16M18 4v16M3 8v8M21 8v8M6 12h12' },
  { id: 'look', title: 'Appearance', icon: 'M12 3a9 9 0 100 18c1 0 1.5-.7 1.5-1.5 0-1.2-1-1.5-1-2.5s.8-1.5 2-1.5H17a4 4 0 004-4c0-4.4-4-8.5-9-8.5zM7.5 12a1 1 0 100-2 1 1 0 000 2zM10 8a1 1 0 100-2 1 1 0 000 2zM15 8a1 1 0 100-2 1 1 0 000 2z' },
  { id: 'notifications', title: 'Notifications', icon: 'M6 9a6 6 0 1112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9M10 20a2 2 0 004 0' },
  { id: 'data', title: 'Backup & data', icon: 'M7 18a5 5 0 01-.5-10A6 6 0 0118 9a4.5 4.5 0 01-.5 9H7zM12 11v6M9.5 13.5L12 11l2.5 2.5' },
  { id: 'social', title: 'Friends & account', icon: 'M16 11a3 3 0 100-6 3 3 0 000 6zM8 12a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 3-5 6-5s6 2 6 5M14 15c3 0 8 1 8 5' },
  { id: 'help', title: 'Help & feedback', icon: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9.5a2.5 2.5 0 114 2c-1 .6-1.5 1.2-1.5 2.5M12 17h.01' },
]
const REST_LABEL = (r: number) => (r === -1 ? 'as planned' : r ? `${r} s` : 'off')

/** Settings, grouped into a few short pages instead of one long list. */
export function SettingsView({ initialPage, onBack }: { initialPage?: string; onBack?: () => void }) {
  const { resetAll, notifPrefs, setNotifPrefs, units, setUnits, name, setName, importData, setTourDone, trackRpe, restSeconds, setPrefs, theme, setTheme, accent, setAccent, cloud, socialChoice } = useStore()
  const [page, setPage] = useState<Page | null>(PAGES.some((p) => p.id === initialPage) ? (initialPage as Page) : null)
  const [advanced, setAdvanced] = useState(false)
  const myHandle = useSocial((s) => s.profile?.handle)
  const install = useInstallPrompt()
  const [msg, setMsg] = useState('')
  const [erasing, setErasing] = useState(false)
  const [keepProfile, setKeepProfile] = useState(true)
  const [confirmText, setConfirmText] = useState('')
  const [legal, setLegal] = useState<LegalDoc | null>(null)
  const [backedUp, setBackedUp] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const [perm, setPerm] = useState<'granted' | 'denied' | 'default' | 'unsupported'>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  const enableSystem = async (on: boolean) => {
    if (!on) return setNotifPrefs({ system: false })
    if (typeof Notification === 'undefined') return
    const result = perm === 'granted' ? 'granted' : await Notification.requestPermission()
    setPerm(result)
    setNotifPrefs({ system: result === 'granted' })
  }

  const standalone = isStandalone()
  const ios = isIos()

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ app: 'workout', ...syncPayload(useStore.getState() as unknown as Record<string, unknown>) }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ez-workout-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setBackedUp(true)
  }

  const closeErase = () => { setErasing(false); setConfirmText(''); setBackedUp(false) }

  const onImport = async (f: File) => {
    try {
      const d = JSON.parse(await f.text())
      if (!Array.isArray(d.plan) || d.plan.length !== 7 || !Array.isArray(d.logs)) throw new Error()
      if (!confirm('Replace all current data with this backup?')) return
      importData(d)
      setMsg('Backup restored.')
    } catch {
      setMsg('That file isn’t a valid backup.')
    }
  }

  const summary: Record<Page, string> = {
    profile: `${name || 'No name yet'} · ${units.weight}, ${units.distance}`,
    workouts: `Rest timer ${REST_LABEL(restSeconds)} · effort ${trackRpe ? 'on' : 'off'}`,
    look: `${theme[0].toUpperCase()}${theme.slice(1)} · ${accent}`,
    notifications: [notifPrefs.goals && 'goals', notifPrefs.pbs && 'bests', notifPrefs.daily && 'daily reminder'].filter(Boolean).join(', ') || 'Off',
    data: cloud.enabled ? 'Cloud backup on' : 'Cloud backup off',
    social: socialChoice === 'enabled' ? 'Friends on' : 'Friends off',
    help: 'Guide, invite a friend, feedback, privacy',
  }
  const title = page ? PAGES.find((p) => p.id === page)!.title : 'Settings'

  if (!page) {
    return (
      <section>
        <header className="mb-4 flex items-center gap-2">
          {onBack && <button onClick={onBack} aria-label="Back" className="-ml-2 h-10 w-10 rounded-full text-xl text-neutral-500">‹</button>}
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        </header>
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl bg-surface ring-1 ring-neutral-200/70">
          {PAGES.map((p) => (
            <li key={p.id}>
              <button onClick={() => { setPage(p.id); window.scrollTo(0, 0) }} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-neutral-500" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={p.icon} /></svg>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{p.title}</span>
                  <span className="block truncate text-sm text-neutral-400">{summary[p.id]}</span>
                </span>
                <span className="text-neutral-300">›</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-xs text-neutral-400">EZ Workout Tracker · version {APP_VERSION}</p>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <header className="mb-4 flex items-center gap-2">
        <button onClick={() => setPage(null)} aria-label="Back to settings" className="-ml-2 h-10 w-10 rounded-full text-xl text-neutral-500">‹</button>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </header>
      {page === 'profile' && (<>
      <Row title="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-40 rounded-lg bg-neutral-100 px-3 py-1.5 text-right outline-none"
        />
      </Row>
      <Row title="Weight">
        <Segmented value={units.weight} options={['lb', 'kg']} onChange={(weight) => setUnits({ weight })} />
      </Row>
      <Row title="Distance">
        <Segmented value={units.distance} options={['mi', 'km']} onChange={(distance) => setUnits({ distance })} />
      </Row>
      </>)}

      {page === 'workouts' && (<>
      <Row title="Track effort (RPE)"><Toggle on={trackRpe} onChange={(v) => setPrefs({ trackRpe: v })} label="Track effort (RPE)" /></Row>
      <Row title="Rest timer in workouts">
        <select value={restSeconds} onChange={(e) => setPrefs({ restSeconds: Number(e.target.value) })} className="rounded-lg bg-neutral-100 px-2 py-1.5 text-sm">
          {[0, -1, 60, 90, 120, 180].map((r) => <option key={r} value={r}>{r === -1 ? 'As planned' : r ? `${r} s` : 'Off'}</option>)}
        </select>
      </Row>
      <p className="px-1 text-sm text-neutral-500">The rest timer starts when you tick a set in a workout. “As planned” uses each exercise’s planned rest (longer for heavy sets). RPE is how hard a set felt (10 = nothing left); sets at 10 won’t trigger an “add weight” suggestion.</p>
      </>)}

      {page === 'look' && (<>
      <Row title="Theme">
        <Segmented value={theme} options={['dark', 'light', 'auto']} onChange={setTheme} />
      </Row>
      <Row title="Vibe">
        <div className="flex gap-2" role="radiogroup" aria-label="Accent colour">
          {ACCENTS.map(([id, color]) => (
            <button
              key={id}
              role="radio"
              aria-checked={accent === id}
              aria-label={id}
              onClick={() => setAccent(id)}
              style={{ backgroundColor: color }}
              className={`h-7 w-7 rounded-full ${accent === id ? 'ring-2 ring-neutral-900 ring-offset-2 ring-offset-surface' : ''}`}
            />
          ))}
        </div>
      </Row>
      </>)}

      {page === 'notifications' && (<>
      <Row title="Goals"><Toggle on={notifPrefs.goals} onChange={(goals) => setNotifPrefs({ goals })} label="Goal notifications" /></Row>
      <Row title="Personal bests"><Toggle on={notifPrefs.pbs} onChange={(pbs) => setNotifPrefs({ pbs })} label="Personal best notifications" /></Row>
      <Row title="Daily workout reminder"><Toggle on={notifPrefs.daily} onChange={(daily) => setNotifPrefs({ daily })} label="Daily reminder" /></Row>
      {notifPrefs.daily && (
        <Row title="Remind me at">
          <input
            type="time"
            value={notifPrefs.reminderTime}
            onChange={(e) => e.target.value && setNotifPrefs({ reminderTime: e.target.value })}
            className="rounded-lg bg-neutral-100 px-3 py-1.5 outline-none"
          />
        </Row>
      )}
      <Row title="Phone / system alerts">
        <Toggle on={notifPrefs.system && perm === 'granted'} onChange={enableSystem} label="System alerts" />
      </Row>
      {perm === 'denied' && (
        <p className="text-sm text-neutral-500">Notifications are blocked for this app. Turn them on in your browser or phone settings, then come back.</p>
      )}
      {perm === 'unsupported' && <p className="text-sm text-neutral-500">This browser doesn’t support system notifications. You’ll still see them in the app.</p>}
      <p className="text-xs text-neutral-400">
        Notifications are checked while the app is open (including in the background). A web app can’t wake a fully closed phone
        without a push server, so a reminder that comes due while the app is closed shows up the next time you open it.
        {ios && !standalone && ' On iPhone, system alerts only work after you add the app to your Home Screen.'}
      </p>
      </>)}

      {page === 'data' && (<>
      <CloudBackup />
      <button onClick={() => setAdvanced(!advanced)} aria-expanded={advanced} className="mt-2 w-full rounded-2xl bg-surface px-4 py-3 text-left text-sm shadow-sm ring-1 ring-neutral-200/70">
        Backup file (advanced) <span className="float-right text-neutral-400">{advanced ? '⌃' : '⌄'}</span>
        <span className="block text-xs text-neutral-400">Save or restore a copy as a file, e.g. to move without cloud backup</span>
      </button>
      {advanced && (<>
      <div className="flex gap-2">
        <button onClick={exportData} className="flex-1 rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent">Export backup</button>
        <button onClick={() => file.current?.click()} className="flex-1 rounded-2xl bg-surface py-3 text-sm font-medium shadow-sm ring-1 ring-neutral-200/70">Import backup</button>
        <input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
      </div>
      </>)}
      {msg && <p className="text-sm text-neutral-500">{msg}</p>}

      <button
        onClick={() => setErasing(true)}
        className="w-full rounded-2xl bg-surface py-3 text-sm font-medium text-red-600 shadow-sm ring-1 ring-red-200"
      >
        Erase all data and start over
      </button>

      {erasing && (
        <Sheet title="Erase all data?" onClose={closeErase} closeLabel="Cancel">
          <p className="mb-3 text-sm text-neutral-600">
            This permanently deletes your workout history, weekly plan, routines, goals, body weight entries, custom
            exercises and notifications from this device. It can’t be undone. Cloud backup is turned off, and your last cloud
            backup is left as it is.
          </p>
          <button
            onClick={exportData}
            className="mb-4 w-full rounded-2xl bg-neutral-100 py-3 text-sm font-medium"
          >
            {backedUp ? 'Backup downloaded ✓' : 'Export a backup first'}
          </button>
          <label className="mb-4 flex items-center gap-3 text-sm">
            <input type="checkbox" checked={keepProfile} onChange={(e) => setKeepProfile(e.target.checked)} className="h-4 w-4" />
            Keep my name, units and notification settings
          </label>
          <label className="mb-4 block text-sm text-neutral-500">
            Type ERASE to confirm
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              className="mt-1 w-full rounded-xl bg-neutral-100 px-4 py-2.5 text-neutral-900 outline-none"
            />
          </label>
          <button
            disabled={confirmText.trim().toUpperCase() !== 'ERASE'}
            onClick={() => { resetAll(keepProfile); closeErase(); setMsg('All data erased. You’re starting fresh.') }}
            className="w-full rounded-2xl bg-red-600 py-3 text-sm font-medium text-white disabled:opacity-30"
          >
            Erase everything
          </button>
        </Sheet>
      )}

      </>)}

      {page === 'social' && (<>
      <SocialSettings />
      <AccountSection />
      </>)}

      {page === 'help' && (<>
      {(['privacy', 'terms', 'health'] as const).map((d) => (
        <button key={d} onClick={() => setLegal(d)} className="w-full rounded-2xl bg-surface px-4 py-3 text-left text-sm shadow-sm ring-1 ring-neutral-200/70">
          {LEGAL_TITLES[d]}
        </button>
      ))}
      {legal && <LegalSheet doc={legal} onClose={() => setLegal(null)} />}
      <button onClick={() => setTourDone(false)} className="w-full rounded-2xl bg-surface px-4 py-3 text-left text-sm shadow-sm ring-1 ring-neutral-200/70">App guide</button>
      <InviteButton handle={myHandle} className="w-full rounded-2xl bg-surface px-4 py-3 text-left text-sm shadow-sm ring-1 ring-neutral-200/70">
        Invite a friend to the app
        <span className="block text-xs text-neutral-400">{myHandle ? 'Sends a link that lets them add you as a friend' : 'Sends a link to the app'}</span>
      </InviteButton>
      <a href={feedbackLink('feedback')} target="_blank" rel="noreferrer" className="block w-full rounded-2xl bg-surface px-4 py-3 text-left text-sm shadow-sm ring-1 ring-neutral-200/70">
        Send feedback or an idea
      </a>
      <a href={feedbackLink('bug')} target="_blank" rel="noreferrer" className="block w-full rounded-2xl bg-surface px-4 py-3 text-left text-sm shadow-sm ring-1 ring-neutral-200/70">
        Report a bug
        <span className="block text-xs text-neutral-400">Includes the app version and any recent errors, nothing else</span>
      </a>

      {!standalone && (
        <>
          <h2 className="pt-4 text-sm font-semibold text-neutral-700">Install</h2>
          {install ? (
            <button onClick={install} className="w-full rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent">Add to home screen</button>
          ) : (
            <p className="text-sm text-neutral-500">
              {ios
                ? 'In Safari, tap the Share button, then “Add to Home Screen”.'
                : 'In Chrome, open the ⋮ menu and choose “Install app” (or “Add to Home screen”).'}
            </p>
          )}
        </>
      )}
      </>)}
    </section>
  )
}
