import { useState } from 'react'
import { fmtLong, fmtShort, weekdayIndex, parseISO } from '../lib/dates'
import { bestLift, hasData, weekStats } from '../lib/stats'
import { formatPace, showDistance, showWeight, storeWeight } from '../lib/units'
import { useToday } from '../lib/useToday'
import { findExercise, selectLastLog, useStore } from '../store'
import type { ExerciseLog, Goal, Units } from '../types'
import { GoalSheet } from './GoalSheet'
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
  const sets = (l.sets ?? []).filter((s) => s.weight && s.reps)
  if (sets.length === 0) return '—'
  const top = sets.reduce((a, s) => (s.weight! > a.weight! ? s : a))
  return `${sets.length} sets · top ${showWeight(top.weight, u)} × ${top.reps}`
}

export function HomeView({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const s = useStore()
  const today = useToday()
  const [hour] = useState(() => new Date().getHours())
  const [goalSheet, setGoalSheet] = useState(false)
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
      <header className="mb-4">
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
                      {ex.kind === 'strength' ? `${p.sets} sets` : 'cardio'}
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

function BodyweightCard({ today }: { today: string }) {
  const { bodyweight, units, logBodyweight } = useStore()
  const [draft, setDraft] = useState<number | null>(null)
  const latest = bodyweight.at(-1)
  const prev = bodyweight.at(-2)
  const delta = latest && prev ? showWeight(latest.lb - prev.lb, units)! : null
  const points = bodyweight.slice(-60).map((b) => ({ date: b.date, y: showWeight(b.lb, units)! }))
  const format = (v: number) => `${(Math.round(v * 10) / 10).toString()} ${units.weight}`

  return (
    <Card title="Body weight">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tabular-nums">{latest ? format(showWeight(latest.lb, units)!) : '—'}</div>
          {latest && (
            <div className="text-xs text-neutral-400">
              {fmtShort(latest.date)}
              {delta != null && ` · ${delta > 0 ? '+' : ''}${Math.round(delta * 10) / 10} since ${fmtShort(prev!.date)}`}
            </div>
          )}
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (draft) { logBodyweight(today, storeWeight(draft, units)!); setDraft(null) }
          }}
        >
          <div className="w-20"><NumberInput value={draft} step={0.1} placeholder={units.weight} onChange={setDraft} /></div>
          <button disabled={!draft} className="rounded-xl bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-30">Log</button>
        </form>
      </div>
      {points.length > 1 && <LineChart points={points} format={format} label="Body weight" />}
    </Card>
  )
}

function GoalRow({ goal }: { goal: Goal }) {
  const { logs, custom, units, bodyweight, deleteGoal } = useStore()
  const today = useToday()
  let title = ''
  let detail = ''
  let pct = 0

  if (goal.type === 'workouts') {
    const n = weekStats(logs, today).workouts
    title = `${goal.perWeek} workouts a week`
    detail = `${n} / ${goal.perWeek} this week`
    pct = n / goal.perWeek
  } else if (goal.type === 'bodyweight') {
    const now = bodyweight.at(-1)?.lb ?? null
    const start = goal.start ?? bodyweight[0]?.lb ?? null
    title = `Body weight → ${showWeight(goal.target, units)} ${units.weight}`
    detail = now == null ? 'Log your weight to start' : `Now ${showWeight(now, units)} ${units.weight}`
    if (now != null && start != null) pct = start === goal.target ? 1 : (start - now) / (start - goal.target)
  } else {
    const best = bestLift(logs, goal.exerciseId)
    title = `${findExercise(custom, goal.exerciseId)?.name ?? 'Lift'} → ${showWeight(goal.target, units)} ${units.weight}`
    detail = best ? `Best ${showWeight(best, units)} ${units.weight}` : 'Not logged yet'
    pct = best / goal.target
  }
  pct = Math.max(0, Math.min(1, pct))
  const done = pct >= 1

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
