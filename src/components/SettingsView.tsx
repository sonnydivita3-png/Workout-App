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

export function SettingsView() {
  const { resetAll, notifPrefs, setNotifPrefs, units, setUnits, name, setName, importData, setTourDone, trackRpe, restSeconds, setPrefs, plainCopy, theme, setTheme, accent, setAccent } = useStore()
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

  return (
    <section className="space-y-3">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Settings</h1>
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

      <h2 className="pt-4 text-xs uppercase tracking-wide text-neutral-400">Logging</h2>
      <Row title="Track effort (RPE)"><Toggle on={trackRpe} onChange={(v) => setPrefs({ trackRpe: v })} label="Track effort (RPE)" /></Row>
      <Row title="Rest timer in workouts">
        <select value={restSeconds} onChange={(e) => setPrefs({ restSeconds: Number(e.target.value) })} className="rounded-lg bg-neutral-100 px-2 py-1.5 text-sm">
          {[0, -1, 60, 90, 120, 180].map((r) => <option key={r} value={r}>{r === -1 ? 'As planned' : r ? `${r} s` : 'Off'}</option>)}
        </select>
      </Row>
      <p className="px-1 text-xs text-neutral-400">RPE is how hard a set felt (10 = nothing left). Sets at RPE 10 won’t trigger a “add weight” suggestion. Tap a set number to mark it as a warm-up.</p>

      <h2 className="pt-4 text-xs uppercase tracking-wide text-neutral-400">Look</h2>
      <Row title="Plain wording"><Toggle on={plainCopy} onChange={(v) => setPrefs({ plainCopy: v })} label="Plain wording" /></Row>
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

      <h2 className="pt-4 text-xs uppercase tracking-wide text-neutral-400">Notifications</h2>
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

      <h2 className="pt-4 text-xs uppercase tracking-wide text-neutral-400">Your data</h2>
      <p className="text-sm text-neutral-500">
        Without cloud backup, everything lives on this device only. Export a file now and then — clearing browser data erases it.
      </p>
      <div className="flex gap-2">
        <button onClick={exportData} className="flex-1 rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent">Export backup</button>
        <button onClick={() => file.current?.click()} className="flex-1 rounded-2xl bg-surface py-3 text-sm font-medium shadow-sm ring-1 ring-neutral-200/70">Import backup</button>
        <input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
      </div>
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

      <CloudBackup />

      <SocialSettings />

      <AccountSection />

      <h2 className="pt-4 text-xs uppercase tracking-wide text-neutral-400">Help</h2>
      {(['privacy', 'terms', 'health'] as const).map((d) => (
        <button key={d} onClick={() => setLegal(d)} className="w-full rounded-2xl bg-surface px-4 py-3 text-left text-sm shadow-sm ring-1 ring-neutral-200/70">
          {LEGAL_TITLES[d]}
        </button>
      ))}
      {legal && <LegalSheet doc={legal} onClose={() => setLegal(null)} />}
      <button onClick={() => setTourDone(false)} className="w-full rounded-2xl bg-surface px-4 py-3 text-left text-sm shadow-sm ring-1 ring-neutral-200/70">Replay the app walkthrough</button>
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
      <p className="text-center text-xs text-neutral-400">Version {APP_VERSION}</p>

      {!standalone && (
        <>
          <h2 className="pt-4 text-xs uppercase tracking-wide text-neutral-400">Install</h2>
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
    </section>
  )
}
