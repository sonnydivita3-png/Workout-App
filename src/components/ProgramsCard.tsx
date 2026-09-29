import { useState } from 'react'
import { addDays, fmtShort, parseISO, toISO } from '../lib/dates'
import { activePrograms, clearRange, stoppableEntries } from '../lib/programs'
import { useToday } from '../lib/useToday'
import { useStore } from '../store'
import type { Program } from '../types'
import { primaryBtn, Sheet } from './Sheet'

const RANGES = [
  { id: 'week', label: 'The rest of this week', days: 6 },
  { id: 'four', label: 'The next 4 weeks', days: 28 },
  { id: 'all', label: 'Everything from today on', days: 3650 },
] as const

/** Running programs on the Plan tab: stop or replace them, or clear a stretch of the calendar. */
export function ProgramsCard({ onReplace }: { onReplace: (kind: Program['kind']) => void }) {
  const { programs, overrides, logs, stopProgram, clearPlan } = useStore()
  const today = useToday()
  const [stopping, setStopping] = useState<Program | null>(null)
  const [clearing, setClearing] = useState(false)
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('week')
  const [msg, setMsg] = useState<string | null>(null)

  const active = activePrograms(programs, today)
  const upcoming = Object.keys(overrides).filter((d) => d >= today).length
  if (active.length === 0 && upcoming === 0 && !msg) return null

  const rangeTo = (id: (typeof RANGES)[number]['id']) => toISO(addDays(parseISO(today), RANGES.find((r) => r.id === id)!.days))
  const clearCount = clearRange(overrides, logs, today, rangeTo(range)).count
  const last = (p: Program) => p.entries.map((e) => e.date).sort().at(-1)!

  return (
    <section className="mt-3 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-neutral-200/70">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wide text-neutral-400">{active.length ? 'My programs' : 'Planned days'}</h2>
        {upcoming > 0 && <button onClick={() => setClearing(true)} className="text-xs text-neutral-500 underline underline-offset-2">Clear days…</button>}
      </div>
      {msg && <p role="status" className="mb-1 text-xs text-neutral-500">{msg}</p>}
      <ul className="divide-y divide-neutral-100">
        {active.map((p) => (
          <li key={p.id} className="flex items-center gap-2 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{p.title}</span>
              <span className="block text-xs text-neutral-400">through {fmtShort(last(p))}</span>
            </span>
            <button onClick={() => onReplace(p.kind)} className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">Replace</button>
            <button onClick={() => setStopping(p)} className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-red-600">Stop</button>
          </li>
        ))}
      </ul>

      {stopping && (
        <Sheet title={`Stop ${stopping.title}?`} onClose={() => setStopping(null)} closeLabel="Cancel">
          <p className="mb-4 text-sm text-neutral-600">
            This removes its {stoppableEntries(stopping, logs, today).length} upcoming day{stoppableEntries(stopping, logs, today).length === 1 ? '' : 's'} from your calendar,
            starting today. Anything you’ve already logged stays.
          </p>
          <button
            onClick={() => { const n = stopProgram(stopping.id, today); setStopping(null); setMsg(`Stopped. ${n} day${n === 1 ? '' : 's'} removed.`) }}
            className="w-full rounded-2xl bg-red-600 py-3 text-sm font-medium text-white"
          >
            Stop program
          </button>
        </Sheet>
      )}

      {clearing && (
        <Sheet title="Clear planned days" onClose={() => setClearing(false)} closeLabel="Cancel">
          <p className="mb-3 text-sm text-neutral-600">Removes generated plans and rest days you’ve set, so those days follow your weekly plan again. Days with anything logged are kept.</p>
          <div className="mb-4 space-y-1.5">
            {RANGES.map((r) => (
              <button key={r.id} onClick={() => setRange(r.id)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${range === r.id ? 'bg-accent text-on-accent' : 'bg-neutral-50'}`}>
                <span>{r.label}</span>
              </button>
            ))}
          </div>
          <button
            disabled={clearCount === 0}
            onClick={() => { const n = clearPlan(today, rangeTo(range)); setClearing(false); setMsg(`Cleared ${n} day${n === 1 ? '' : 's'}.`) }}
            className={primaryBtn}
          >
            {clearCount === 0 ? 'Nothing to clear' : `Clear ${clearCount} day${clearCount === 1 ? '' : 's'}`}
          </button>
        </Sheet>
      )}
    </section>
  )
}
