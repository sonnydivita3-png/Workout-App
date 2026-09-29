import { useState } from 'react'
import { addDays, fmtLong, fmtShort, parseISO, toISO, weekdayIndex } from '../lib/dates'
import { goalPct, goalTitle } from '../lib/goals'
import { bestLift, hasData, weekStats } from '../lib/stats'
import { formatPace, formatSeconds, showDistance, showWeight, storeWeight } from '../lib/units'
import { useToday } from '../lib/useToday'
import { findExercise, selectLastLog, useStore } from '../store'
import type { ExerciseLog, Goal, Units } from '../types'
import { GoalSheet } from './GoalSheet'
import { NotificationsSheet } from './NotificationsSheet'
import { LineChart } from './LineChart'
import { NumberInput } from './NumberInput'
import type { Tab } from './TabBar'

const Card = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200/70">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-xs uppercase tracking-wide text-neutral-400">{title}</h2>
      {action}
    </div>
    {children}
  </section>
)

/** One-line summary of a logged exercise. */
function summary(l: ExerciseLog, u: Units): string {
  if (l.cardio) {
    const { distance, minutes } = l.cardio
    return [distance ? `${showDistance(distance, u)} ${u.distance}` : null, minutes ? `${minutes} min` : null, formatPace(distance, minutes, u)]
      .filter(Boolean).join(' · ')
  }
  const all = l.sets ?? []
  const sets = all.filter((s) => s.weight && s.reps)
  if (sets.length > 0) {
    const top = sets.reduce((a, s) => (s.weight! > a.weight! ? s : a))
    return `${sets.length} set${sets.length === 1 ? '' : 's'} · top ${showWeight(top.weight, u)} × ${top.reps}`
  }
  const timed = all.filter((s) => s.seconds)
  if (timed.length > 0) return `${timed.length} set${timed.length === 1 ? '' : 's'} · best ${formatSeconds(Math.max(...timed.map((s) => s.seconds!)))}`
  const reps = all.filter((s) => s.reps)
  if (reps.length > 0) return `${reps.length} set${reps.length === 1 ? '' : 's'} · best ${Math.max(...reps.map((s) => s.reps!))} reps`
  return '—'
}

export function HomeView({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const s = useStore()
  const today = useToday()
  const [hour] = useState(() => new Date().getHours())
  const [goalSheet, setGoalSheet] = useState(false)
  const [notifSheet, setNotifSheet] = useState(false)
  const unread = useStore((st) => st.notifications.filter((n) => !n.read).length)
  const [nameDraft, setNameDraft] = useState('')
  const { units, logs, custom, plan } = s

  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const planned = plan[weekdayIndex(parseISO(today))]
  const todays = new Map(logs.filter((l) => l.date === today && hasData(l)).map((l) => [l.exerciseId, l]))
  const upcoming = planned.filter((p) => !todays.has(p.exerciseId))

  const lastDate = logs.filter(hasData).map((l) => l.date).sort().at(-1)
  const lastLogs = lastDate ? logs.filter((l) => l.date === lastDate && hasData(l)) : []

  const stats = weekStats(logs, today)
  const volDelta = stats.lastVolume ? Math.round(((stats.volume - stats.lastVolume) / stats.lastVolume) * 100) : null
  const fmtVol = (lb: number) => {
    const v = showWeight(lb, units)!
    return v >= 10000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v).toLocaleString()
  }

  return (
    <div className="space-y-3">
      <header className="relative mb-4">
        <button
          onClick={() => setNotifSheet(true)}
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-200/60"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9a6 6 0 1112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9M10 20a2 2 0 004 0" />
          </svg>
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-900 px-1 text-[10px] font-medium text-white">
              {unread}
            </span>
          )}
        </button>
        <p className="text-sm text-neutral-400">{fmtLong(today)}</p>
        {s.name ? (
          <h1 className="text-2xl font-semibold tracking-tight">{greeting}, {s.name}</h1>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{greeting}</h1>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => { e.preventDefault(); if (nameDraft.trim()) s.setName(nameDraft.trim()) }}
            >
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="What should we call you?"
                className="min-w-0 flex-1 rounded-xl bg-neutral-100 px-4 py-2 text-sm outline-none"
              />
              <button className="rounded-xl bg-neutral-900 px-4 text-sm text-white">Save</button>
            </form>
          </>
        )}
      </header>

      <Card
        title="Today"
        action={<button onClick={() => onNavigate('plan')} className="text-sm text-neutral-500">{planned.length ? 'Open ›' : 'Plan ›'}</button>}
      >
        {planned.length === 0 ? (
          <p className="text-neutral-400">Rest day. Nothing planned.</p>
        ) : upcoming.length === 0 ? (
          <p className="text-neutral-500">All {planned.length} done today. Nice work.</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-neutral-400">{planned.length - upcoming.length} of {planned.length} done</p>
            <ul className="divide-y divide-neutral-100">
              {upcoming.map((p) => {
                const ex = findExercise(custom, p.exerciseId)
                if (!ex) return null
                const last = selectLastLog(logs, ex.id, today)
                return (
                  <li key={ex.id} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 truncate">{ex.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-neutral-400">
                      {ex.kind === 'strength' ? (p.seconds ? `${p.sets} × ${p.seconds}s` : p.reps ? `${p.sets} × ${p.reps}` : `${p.sets} sets`) : p.minutes ? `${p.minutes} min` : 'cardio'}
                      {last && hasData(last) ? ` · last ${summary(last, units).split(' · ').at(-1)}` : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Card>

      <Card title="Last workout" action={lastDate && <span className="text-sm text-neutral-400">{fmtLong(lastDate)}</span>}>
        {lastLogs.length === 0 ? (
          <p className="text-neutral-400">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {lastLogs.map((l) => (
              <li key={l.exerciseId} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 truncate">{findExercise(custom, l.exerciseId)?.name ?? 'Exercise'}</span>
                <span className="shrink-0 text-xs tabular-nums text-neutral-400">{summary(l, units)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <BodyweightCard today={today} />

      <Card title="This week">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Tile label="Workouts" value={String(stats.workouts)} />
          <Tile
            label={`Volume (${units.weight})`}
            value={fmtVol(stats.volume)}
            sub={volDelta == null ? undefined : `${volDelta >= 0 ? '+' : ''}${volDelta}% vs last wk`}
          />
          <Tile label="Week streak" value={String(stats.streak)} />
        </div>
      </Card>

      <Card
        title="Goals"
        action={<button onClick={() => setGoalSheet(true)} className="text-sm text-neutral-500">+ Add</button>}
      >
        {s.goals.length === 0 ? (
          <p className="text-neutral-400">Set a target and watch the bar fill.</p>
        ) : (
          <ul className="space-y-4">
            {s.goals.map((g) => <GoalRow key={g.id} goal={g} />)}
          </ul>
        )}
      </Card>

      {goalSheet && <GoalSheet onClose={() => setGoalSheet(false)} />}
      {notifSheet && <NotificationsSheet onClose={() => setNotifSheet(false)} />}
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-1 py-3">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</div>
      {sub && <div className="mt-0.5 text-[10px] text-neutral-400">{sub}</div>}
    </div>
  )
}

const RANGES = [
  { id: '30', label: '30D', days: 30 },
  { id: '90', label: '90D', days: 90 },
  { id: '365', label: '1Y', days: 365 },
  { id: 'all', label: 'All', days: Infinity },
] as const

function BodyweightCard({ today }: { today: string }) {
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
    <Card title="Body weight">
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
        <button disabled={!draft} className="rounded-xl bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-30">Log</button>
      </form>

      {points.length > 0 ? (
        <>
          <div className="mb-2 flex gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`rounded-full px-3 py-1 text-xs ${r.id === range ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500'}`}
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
    </Card>
  )
}

function GoalRow({ goal }: { goal: Goal }) {
  const { logs, custom, units, bodyweight, deleteGoal } = useStore()
  const today = useToday()
  const title = goalTitle(goal, units, (id) => findExercise(custom, id)?.name)
  const pct = goalPct(goal, logs, bodyweight, today)
  const done = pct >= 1
  let detail = ''

  if (goal.type === 'workouts') {
    detail = `${weekStats(logs, today).workouts} / ${goal.perWeek} this week`
  } else if (goal.type === 'bodyweight') {
    const now = bodyweight.at(-1)?.lb ?? null
    detail = now == null ? 'Log your weight to start' : `Now ${showWeight(now, units)} ${units.weight}`
  } else {
    const best = bestLift(logs, goal.exerciseId, goal.mode)
    const shown = goal.mode === 'reps' ? `${best} reps` : goal.mode === 'time' ? formatSeconds(best) : `${showWeight(best, units)} ${units.weight}`
    detail = best ? `Best ${shown}` : 'Not logged yet'
  }

  return (
    <li>
      <div className="mb-1.5 flex items-start justify-between gap-2 text-sm">
        <span className="min-w-0">{title}</span>
        <button
          onClick={() => confirm('Remove this goal?') && deleteGoal(goal.id)}
          aria-label="Remove goal"
          className="shrink-0 text-lg leading-none text-neutral-300"
        >
          ×
        </button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full rounded-full bg-neutral-900" style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="mt-1 text-xs text-neutral-400">{done ? 'Goal reached ✓' : detail}</div>
    </li>
  )
}
