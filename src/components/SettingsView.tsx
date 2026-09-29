import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'

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

const Row = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200/70">
    <span>{title}</span>
    {children}
  </div>
)

export function SettingsView() {
  const { units, setUnits, plan, logs, custom, name, setName, bodyweight, routines, goals, importData } = useStore()
  const [installEvt, setInstallEvt] = useState<InstallEvent | null>(null)
  const [msg, setMsg] = useState('')
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstallEvt(e as InstallEvent) }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  const standalone = window.matchMedia('(display-mode: standalone)').matches
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ app: 'workout', plan, logs, custom, units, name, bodyweight, routines, goals }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ez-workout-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

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
