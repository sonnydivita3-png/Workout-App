import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { Sheet } from './Sheet'

interface InstallEvent extends Event {
  prompt: () => Promise<void>
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-full bg-neutral-100 p-0.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-full px-4 py-1 text-sm ${o === value ? 'bg-white shadow-sm' : 'text-neutral-500'}`}
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
      className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-neutral-900' : 'bg-neutral-200'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`} />
    </button>
  )
}

const Row = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200/70">
    <span>{title}</span>
    {children}
  </div>
)

export function SettingsView() {
  const { resetAll, notifPrefs, setNotifPrefs, units, setUnits, plan, logs, custom, name, setName, bodyweight, routines, goals, importData } = useStore()
  const [installEvt, setInstallEvt] = useState<InstallEvent | null>(null)
  const [msg, setMsg] = useState('')
  const [erasing, setErasing] = useState(false)
  const [keepProfile, setKeepProfile] = useState(true)
  const [confirmText, setConfirmText] = useState('')
  const [backedUp, setBackedUp] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstallEvt(e as InstallEvent) }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

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

  const standalone = window.matchMedia('(display-mode: standalone)').matches
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ app: 'workout', plan, logs, custom, units, name, bodyweight, routines, goals }, null, 2)], { type: 'application/json' })
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
      importData({
        plan: d.plan, logs: d.logs, custom: d.custom ?? [], units: d.units ?? units,
        name: d.name ?? '', bodyweight: d.bodyweight ?? [], routines: d.routines ?? [], goals: d.goals ?? [],
      })
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
        Everything lives on this device only. Export a backup now and then — clearing browser data erases it.
      </p>
      <div className="flex gap-2">
        <button onClick={exportData} className="flex-1 rounded-2xl bg-neutral-900 py-3 text-sm font-medium text-white">Export backup</button>
        <button onClick={() => file.current?.click()} className="flex-1 rounded-2xl bg-white py-3 text-sm font-medium shadow-sm ring-1 ring-neutral-200/70">Import backup</button>
        <input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
      </div>
      {msg && <p className="text-sm text-neutral-500">{msg}</p>}

      <button
        onClick={() => setErasing(true)}
        className="w-full rounded-2xl bg-white py-3 text-sm font-medium text-red-600 shadow-sm ring-1 ring-red-200"
      >
        Erase all data and start over
      </button>

      {erasing && (
        <Sheet title="Erase all data?" onClose={closeErase} closeLabel="Cancel">
          <p className="mb-3 text-sm text-neutral-600">
            This permanently deletes your workout history, weekly plan, routines, goals, body weight entries, custom
            exercises and notifications from this device. It can’t be undone.
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

      {!standalone && (
        <>
          <h2 className="pt-4 text-xs uppercase tracking-wide text-neutral-400">Install</h2>
          {installEvt ? (
            <button onClick={() => installEvt.prompt()} className="w-full rounded-2xl bg-neutral-900 py-3 text-sm font-medium text-white">Add to home screen</button>
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
