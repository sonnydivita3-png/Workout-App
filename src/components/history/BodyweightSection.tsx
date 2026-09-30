import { useState } from 'react'
import { addDays, fmtShort, parseISO, toISO } from '../../lib/dates'
import { showWeight, storeWeight } from '../../lib/units'
import { useToday } from '../../lib/useToday'
import { useStore } from '../../store'
import { LineChart } from '../LineChart'
import { NumberInput } from '../NumberInput'

const RANGES = [
  { id: '30', label: '30D', days: 30 },
  { id: '90', label: '90D', days: 90 },
  { id: '365', label: '1Y', days: 365 },
  { id: 'all', label: 'All', days: Infinity },
] as const

/** Body weight: log a weigh-in, see the trend against a goal, and edit past entries. */
export function BodyweightSection() {
  const today = useToday()
  const { bodyweight, goals, units, logBodyweight, deleteBodyweight } = useStore()
  const [draft, setDraft] = useState<number | null>(null)
  const [date, setDate] = useState(today)
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('90')
  const [showEntries, setShowEntries] = useState(false)

  const days = RANGES.find((r) => r.id === range)!.days
  const cutoff = days === Infinity ? '' : toISO(addDays(parseISO(today), -days))
  const inRange = bodyweight.filter((b) => b.date >= cutoff)
  const points = inRange.map((b) => ({ date: b.date, y: showWeight(b.lb, units)! }))
  const format = (v: number) => `${Math.round(v * 10) / 10} ${units.weight}`

  const latest = bodyweight.at(-1)
  const first = inRange[0]
  const change = latest && first && inRange.length > 1 ? showWeight(latest.lb - first.lb, units)! : null
  const goal = goals.find((g) => g.type === 'bodyweight')
  const target = goal?.type === 'bodyweight' ? showWeight(goal.target, units)! : null

  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70">
      <h2 className="mb-3 text-sm font-semibold">Body weight</h2>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tabular-nums">{latest ? format(showWeight(latest.lb, units)!) : '—'}</div>
          <div className="text-xs text-neutral-400">
            {latest ? fmtShort(latest.date) : 'Log your first weigh-in'}
            {change != null && ` · ${change > 0 ? '+' : ''}${Math.round(change * 10) / 10} ${units.weight} since ${fmtShort(first.date)}`}
          </div>
        </div>
      </div>

      <form
        className="mb-4 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (draft && date) { logBodyweight(date, storeWeight(draft, units)!); setDraft(null); setDate(today) }
        }}
      >
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value || today)}
          aria-label="Weigh-in date"
          className="min-w-0 flex-1 rounded-lg bg-neutral-100 px-2 py-2 text-sm outline-none"
        />
        <div className="w-20"><NumberInput value={draft} step={0.1} placeholder={units.weight} onChange={setDraft} /></div>
        <button disabled={!draft} className="rounded-xl bg-accent px-4 py-2 text-sm text-on-accent disabled:opacity-30">Log</button>
      </form>

      {points.length > 0 ? (
        <>
          <div className="mb-2 flex gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`rounded-full px-3 py-1 text-xs ${r.id === range ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-500'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <LineChart
            points={points}
            format={format}
            label="Body weight"
            refLine={target != null ? { y: target, label: `Goal ${target}` } : undefined}
          />
          {points.length === 1 && <p className="mt-1 text-xs text-neutral-400">Log another weigh-in to see your trend.</p>}
        </>
      ) : (
        bodyweight.length > 0 && <p className="text-sm text-neutral-400">No weigh-ins in this range.</p>
      )}

      {bodyweight.length > 0 && (
        <div className="mt-3 border-t border-neutral-100 pt-2">
          <button onClick={() => setShowEntries(!showEntries)} className="text-xs text-neutral-400">
            {showEntries ? 'Hide entries' : `All entries (${bodyweight.length})`}
          </button>
          {showEntries && (
            <ul className="mt-1 max-h-48 divide-y divide-neutral-100 overflow-y-auto text-sm">
              {[...bodyweight].reverse().map((b) => (
                <li key={b.date} className="flex items-center justify-between py-1.5">
                  <span className="text-neutral-500">{fmtShort(b.date)}</span>
                  <span className="flex items-center gap-3 tabular-nums">
                    {format(showWeight(b.lb, units)!)}
                    <button onClick={() => deleteBodyweight(b.date)} aria-label={`Delete ${b.date}`} className="text-lg leading-none text-neutral-300">×</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
