import { ConditioningSection } from './ConditioningSection'
import { useMemo, useState } from 'react'
import { BUILTIN_BY_ID } from '../../data/exercises'
import { addDays, fmtLong, parseISO, toISO } from '../../lib/dates'
import { MUSCLE_GROUPS, weeklySets } from '../../lib/muscles'
import { dropSetsOf, workSets } from '../../lib/progression'
import { workoutTitle } from '../../lib/plan'
import { hasData } from '../../lib/stats'
import type { Exercise } from '../../types'
import { workoutSummary } from '../../lib/summary'
import { formatPace, formatSeconds, showDistance, showWeight } from '../../lib/units'
import { useToday } from '../../lib/useToday'
import { formatResult } from '../../lib/wod'
import { findExercise, useStore } from '../../store'
import { Sheet } from '../Sheet'

const WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** History by workout: a month calendar, sets per muscle this week, and each day compared with the time before. */
export function WorkoutsTab() {
  const { logs, custom, timedLogs, units } = useStore()
  const today = useToday()
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [openDay, setOpenDay] = useState<string | null>(null)
  const lookup = (id: string) => findExercise(custom, id) ?? BUILTIN_BY_ID.get(id)

  const days = useMemo(() => {
    const by = new Map<string, string[]>()
    for (const l of logs) if (hasData(l)) by.set(l.date, [...(by.get(l.date) ?? []), l.exerciseId])
    for (const t of timedLogs) if (!by.has(t.date)) by.set(t.date, t.movements)
    return by
  }, [logs, timedLogs])
  const dates = [...days.keys()].sort().reverse()
  const sets = weeklySets(logs, today, lookup)
  const maxSets = Math.max(10, ...Object.values(sets.thisWeek), ...Object.values(sets.lastWeek))

  // Month grid starting on Monday.
  const first = parseISO(`${month}-01`)
  const lead = (first.getDay() + 6) % 7
  const inMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: inMonth }, (_, i) => toISO(addDays(first, i)))]
  const shift = (n: number) => { const d = new Date(first.getFullYear(), first.getMonth() + n, 1); setMonth(toISO(d).slice(0, 7)) }
  const monthCount = dates.filter((d) => d.startsWith(month)).length

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70">
        <div className="mb-2 flex items-center justify-between">
          <button onClick={() => shift(-1)} aria-label="Previous month" className="h-8 w-8 rounded-full text-neutral-500">‹</button>
          <p className="text-sm font-semibold">{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} · {monthCount} workout{monthCount === 1 ? '' : 's'}</p>
          <button onClick={() => shift(1)} aria-label="Next month" className="h-8 w-8 rounded-full text-neutral-500">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-400">
          {WD.map((d, i) => <span key={i}>{d}</span>)}
          {cells.map((d, i) => d === null ? <span key={i} /> : (
            <button
              key={d}
              disabled={!days.has(d)}
              onClick={() => setOpenDay(d)}
              aria-label={`${fmtLong(d)}${days.has(d) ? ', workout logged' : ''}`}
              className={`aspect-square rounded-lg text-sm ${days.has(d) ? 'bg-accent font-semibold text-on-accent' : d === today ? 'ring-1 ring-neutral-300' : 'text-neutral-400'}`}
            >
              {parseISO(d).getDate()}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70">
        <p className="mb-1 text-sm font-semibold text-neutral-700">Hard sets per muscle · this week vs last</p>
        <p className="mb-3 text-xs text-neutral-400">Many coaches aim for about 10–20 working sets per muscle each week.</p>
        <ul className="space-y-1.5">
          {MUSCLE_GROUPS.map((g) => {
            const now = sets.thisWeek[g]
            const then = sets.lastWeek[g]
            return (
              <li key={g} className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-2 text-xs">
                <span className="text-neutral-600">{g}</span>
                <span className="relative h-3 rounded-full bg-neutral-100">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-neutral-300" style={{ width: `${(then / maxSets) * 100}%` }} />
                  <span className="absolute inset-y-0.5 left-0 rounded-full bg-accent" style={{ width: `${(now / maxSets) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums">{now}<span className="text-neutral-400"> / {then}</span></span>
              </li>
            )
          })}
        </ul>
      </section>

      <ConditioningSection />

      {dates.length === 0 ? <p className="py-10 text-center text-neutral-400">Nothing logged yet. Your workouts show up here.</p> : (
        <ul className="space-y-2">
          {dates.slice(0, 60).map((d) => {
            const s = workoutSummary(d, days.get(d)!.map((exerciseId) => ({ exerciseId, sets: 1 })), logs, lookup)
            return (
              <li key={d}>
                <button onClick={() => setOpenDay(d)} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-surface p-4 text-left shadow-sm ring-1 ring-neutral-200/70">
                  <span className="min-w-0">
                    <span className="block font-medium">{fmtLong(d)}</span>
                    <span className="block text-xs text-neutral-400">{(() => {
                      const exs = [...new Set(days.get(d))].map(lookup).filter((e): e is Exercise => !!e)
                      return `${workoutTitle(exs)} · ${exs.length} exercise${exs.length === 1 ? '' : 's'}`
                    })()}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs">
                    {s.beat > 0 && <span className="block font-medium text-green-600">▲ {s.beat} improved</span>}
                    {s.prs > 0 && <span className="block text-neutral-500">🏅 {s.prs} PR{s.prs === 1 ? '' : 's'}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {openDay && <DaySheet date={openDay} onClose={() => setOpenDay(null)} lookupUnits={units} />}
    </div>
  )
}

function DaySheet({ date, onClose, lookupUnits: units }: { date: string; onClose: () => void; lookupUnits: ReturnType<typeof useStore.getState>['units'] }) {
  const { logs, custom, timedLogs, deleteDay } = useStore()
  const lookup = (id: string) => findExercise(custom, id) ?? BUILTIN_BY_ID.get(id)
  const dayLogs = logs.filter((l) => l.date === date && hasData(l))
  const timed = timedLogs.filter((t) => t.date === date)
  const s = workoutSummary(date, dayLogs.map((l) => ({ exerciseId: l.exerciseId, sets: 1 })), logs, lookup)
  const status = new Map(s.results.map((r) => [r.exerciseId, r]))
  const badge = { up: ['▲ better', 'text-green-600'], same: ['= matched', 'text-neutral-400'], down: ['▼ lower', 'text-red-600'], new: ['first time', 'text-neutral-400'], skipped: ['', ''] } as const

  return (
    <Sheet title={fmtLong(date)} onClose={onClose}>
      {s.compared > 0 && <p className="mb-3 text-sm text-neutral-600">Beat the time before on <b>{s.beat}</b> of {s.compared} exercise{s.compared === 1 ? '' : 's'}{s.prs ? ` · ${s.prs} new best${s.prs === 1 ? '' : 's'}` : ''}.</p>}
      {timed.map((t) => <p key={t.id} className="mb-2 rounded-xl bg-neutral-50 px-3 py-2 text-sm"><b>{t.title}</b> · {formatResult(t)}</p>)}
      <ul className="divide-y divide-neutral-100">
        {dayLogs.map((l) => {
          const ex = lookup(l.exerciseId)
          const r = status.get(l.exerciseId)
          const detail = l.cardio
            ? `${showDistance(l.cardio.distance, units) ?? '–'} ${units.distance} · ${l.cardio.minutes ?? '–'} min · ${formatPace(l.cardio.distance, l.cardio.minutes, units) ?? '–'}`
            : [...workSets(l), ...dropSetsOf(l)].map((x) => `${x.drop ? 'drop ' : ''}${x.seconds ? formatSeconds(x.seconds) : x.weight ? `${showWeight(x.weight, units)}×${x.reps ?? '–'}` : `${x.reps} reps`}`).join(', ')
          return (
            <li key={l.exerciseId} className="py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{ex?.name ?? 'Exercise'}</span>
                {r && <span className={`shrink-0 text-xs ${badge[r.status][1]}`}>{r.pr ? '🏅 PR ' : ''}{badge[r.status][0]}</span>}
              </div>
              <p className="text-xs tabular-nums text-neutral-500">{detail}</p>
              {l.note && <p className="text-xs text-neutral-400">📝 {l.note}</p>}
            </li>
          )
        })}
      </ul>
      <button
        onClick={() => { if (confirm(`Delete everything logged on ${fmtLong(date)}? This can’t be undone.`)) { deleteDay(date); onClose() } }}
        className="mt-4 w-full py-2 text-sm text-red-600"
      >
        Delete this workout
      </button>
    </Sheet>
  )
}
