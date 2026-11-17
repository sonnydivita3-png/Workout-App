import { useState } from 'react'
import formatGuide from '../../docs/plan-format.md?raw'
import { checkUpdateNow } from '../lib/appUpdate'
import { makeBackup, readBackup } from '../lib/backup'
import { longDate, todayIso } from '../lib/dates'
import { checkPlan } from '../lib/plan'
import { bundledPlan, usePlan, useStore, type Theme } from '../lib/store'
import { APP_VERSION } from '../lib/version'
import { Sheet } from './Sheet'
import { sectionTitle } from './ui'

type Msg = { ok: boolean; text: string } | null

async function readJsonFile(file: File): Promise<unknown> {
  if (file.size > 5_000_000) throw new Error('That file is too big to be a plan or backup.')
  try { return JSON.parse(await file.text()) } catch { throw new Error('That file isn’t valid JSON.') }
}

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const row = 'flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-1 py-2 text-left text-sm font-medium'
const fileRow = `${row} cursor-pointer`

/** The plan in use, importing a new one, backups and the look. */
export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const plan = usePlan()
  const custom = useStore((s) => s.plan)
  const { logs, weights, theme, setPlan, setTheme, restore } = useStore()
  const [msg, setMsg] = useState<Msg>(null)
  const logged = Object.keys(logs).filter((k) => k.startsWith(`${plan.id}|`)).length

  const importPlan = async (file?: File) => {
    if (!file) return
    try {
      const r = checkPlan(await readJsonFile(file))
      if ('errors' in r) return setMsg({ ok: false, text: `This plan file has problems:\n• ${r.errors.join('\n• ')}` })
      const same = r.plan.id === plan.id
      if (!confirm(same ? `Update “${r.plan.name}”? What you’ve logged stays.` : `Switch to “${r.plan.name}” (${longDate(r.plan.start)} to ${longDate(r.plan.end)})? Your log for “${plan.name}” is kept and comes back if you switch back.`)) return
      setPlan(r.plan)
      setMsg({ ok: true, text: `Now following “${r.plan.name}”: ${r.plan.days.length} days.` })
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    }
  }

  const importBackup = async (file?: File) => {
    if (!file) return
    try {
      const r = readBackup(await readJsonFile(file))
      if ('error' in r) return setMsg({ ok: false, text: r.error })
      const n = Object.keys(r.backup.logs).length
      if (!confirm(`Replace everything on this phone with this backup${r.backup.exportedAt ? ` from ${longDate(r.backup.exportedAt.slice(0, 10))}` : ''}? (${n} logged days, ${Object.keys(r.backup.weights).length} weigh-ins)`)) return
      restore(r.backup)
      setMsg({ ok: true, text: 'Backup restored.' })
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    }
  }

  const copyGuide = async () => {
    try {
      await navigator.clipboard.writeText(formatGuide)
      setMsg({ ok: true, text: 'Copied. Paste it to Claude with your new plan and ask for a Durata plan file.' })
    } catch {
      download('durata-plan-format.md', formatGuide)
    }
  }

  return (
    <Sheet title="Settings" onClose={onClose}>
      <div className="space-y-5">
        <section>
          <p className={sectionTitle}>Plan</p>
          <p className="font-semibold">{plan.name}</p>
          <p className="text-sm text-neutral-500">{longDate(plan.start)} to {longDate(plan.end)} · {plan.days.length} days · {logged} logged</p>
          <div className="mt-2 divide-y divide-neutral-200/70">
            <label className={fileRow}>Import a plan file<span className="text-neutral-400">.json</span>
              <input type="file" accept="application/json,.json" className="sr-only" aria-label="Import a plan file" onChange={(e) => { void importPlan(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            <button onClick={() => void copyGuide()} className={row}>Copy the plan format for Claude<span className="text-neutral-400">Copy</span></button>
            {custom && custom.id !== bundledPlan().id && (
              <button onClick={() => { if (confirm(`Go back to “${bundledPlan().name}”?`)) setPlan(null) }} className={row}>Back to {bundledPlan().name}</button>
            )}
          </div>
        </section>

        {msg && <p role="status" className={`whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}

        <section>
          <p className={sectionTitle}>Backup</p>
          <p className="mb-1 text-sm text-neutral-500">Everything is saved on this phone only. Export a backup now and then (to Files or Drive).</p>
          <div className="divide-y divide-neutral-200/70">
            <button onClick={() => download(`durata-backup-${todayIso()}.json`, makeBackup(custom, logs, weights))} className={row}>Export a backup<span className="text-neutral-400">.json</span></button>
            <label className={fileRow}>Restore a backup<span className="text-neutral-400">.json</span>
              <input type="file" accept="application/json,.json" className="sr-only" aria-label="Restore a backup" onChange={(e) => { void importBackup(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          </div>
        </section>

        <section>
          <p className={sectionTitle}>Look</p>
          <div role="radiogroup" aria-label="Theme" className="flex gap-1.5">
            {(['dark', 'light', 'auto'] as Theme[]).map((t) => (
              <button key={t} role="radio" aria-checked={theme === t} onClick={() => setTheme(t)}
                className={`flex-1 rounded-full px-3 py-2 text-sm font-medium capitalize ${theme === t ? 'bg-neutral-900 text-surface' : 'bg-neutral-100 text-neutral-600'}`}>{t}</button>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-between text-xs text-neutral-500">
          <span>Version {APP_VERSION}</span>
          <button onClick={() => void checkUpdateNow().then((t) => setMsg({ ok: true, text: t }))} className="hit rounded-full px-2 py-1 font-medium">Check for updates</button>
        </section>
      </div>
    </Sheet>
  )
}
