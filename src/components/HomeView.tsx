import { useState } from 'react'
import { fmtLong } from '../lib/dates'
import { goalDetail, goalPct, goalTitle } from '../lib/goals'
import { lastWorkout } from '../lib/plan'
import { weekStats } from '../lib/stats'
import { caloriesBetween } from '../lib/calories'
import { weekOf } from '../lib/conditioning'
import { addDays, parseISO, toISO } from '../lib/dates'
import { cardioLine, formatSeconds, showWeight, storeWeight } from '../lib/units'
import { useToday } from '../lib/useToday'
import { findExercise, useStore } from '../store'
import { SafetyNudge } from './SafetyNudge'
import { TodayCard } from './TodayCard'
import { Sheet, primaryBtn } from './Sheet'
import type { ExerciseLog, Goal, Units } from '../types'
import { GoalSheet } from './GoalSheet'
import { NotificationsSheet } from './NotificationsSheet'
import { NumberInput } from './NumberInput'
import { SETTINGS_ICON, type Tab } from './TabBar'
import { ChallengeSheet } from './social/ChallengeSheet'
import { ShareSheet } from './social/ShareSheet'
import { completedWorkout } from '../social/share'

const Card = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold">{title}</h2>
      {action}
    </div>
    {children}
  </section>
)

/** One-line summary of a logged exercise. */
function summary(l: ExerciseLog, u: Units): string {
  if (l.cardio) {
    return cardioLine(l.cardio, l.exerciseId, u)
  }
  const all = (l.sets ?? []).filter((s) => !s.warmup)
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

export function HomeView({ onNavigate }: { onNavigate: (t: Tab, sub?: string) => void }) {
  const s = useStore()
  const today = useToday()
  const [hour] = useState(() => new Date().getHours())
  const [goalSheet, setGoalSheet] = useState(false)
  const [notifSheet, setNotifSheet] = useState(false)
  const unread = useStore((st) => st.notifications.filter((n) => !n.read).length)
  const [nameDraft, setNameDraft] = useState('')
  const social = useStore((st) => st.socialChoice === 'enabled')
  const [lastShare, setLastShare] = useState<'share' | 'challenge' | null>(null)
  const { units, logs, custom } = s

  const greeting = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const latest = lastWorkout(logs, s.overrides, today)
  const lastDate = latest?.date
  const lastLogs = latest?.logs ?? []

  const stats = weekStats(logs, today)
  // Cardio calories this week (Hyrox and timed workouts included), and last week up to the same weekday.
  const [monday, sunday] = weekOf(today)
  const cal = caloriesBetween(logs, s.bodyweight, monday, sunday, s.aboutMe)
  const [lastMonday] = weekOf(today, 1)
  const calLast = caloriesBetween(logs, s.bodyweight, lastMonday, toISO(addDays(parseISO(today), -7)), s.aboutMe).total
  const calSub = cal.total === 0
    ? (cal.missing > 0 ? 'estimates need your bodyweight' : calLast ? `${Math.round(calLast).toLocaleString()} by now last week` : 'from cardio')
    : cal.estimated === cal.total ? 'estimated from bodyweight'
    : cal.estimated > 0 ? `≈${Math.round(cal.estimated).toLocaleString()} estimated`
    : calLast ? `${Math.round(calLast).toLocaleString()} by now last week` : 'from your logs'
  const volDelta = stats.lastVolumeSoFar && stats.volume ? Math.round(((stats.volume - stats.lastVolumeSoFar) / stats.lastVolumeSoFar) * 100) : null
  const fmtVol = (lb: number) => {
    const v = showWeight(lb, units)!
    return v >= 10000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v).toLocaleString()
  }
  const iconBtn = 'relative flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-200/60'

  return (
    <div className="space-y-4">
      <header className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-sm font-bold uppercase tracking-[0.3em] text-accent">Durata</p>
          <p className="text-sm text-neutral-400">{fmtLong(today)}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting}{s.name ? `, ${s.name}` : ''}</h1>
          {!s.name && (
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (nameDraft.trim()) s.setName(nameDraft.trim()) }}>
              <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="What should we call you?" className="min-w-0 flex-1 rounded-xl bg-neutral-100 px-4 py-2 text-sm outline-none" />
              <button className="rounded-xl bg-accent px-4 text-sm text-on-accent">Save</button>
            </form>
          )}
        </div>
        <div className="flex shrink-0">
          <button onClick={() => onNavigate('settings')} aria-label="Settings" className={iconBtn}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={SETTINGS_ICON} /></svg>
          </button>
          <button onClick={() => setNotifSheet(true)} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className={iconBtn}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9a6 6 0 1112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9M10 20a2 2 0 004 0" />
            </svg>
            {unread > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-on-accent">{unread}</span>
            )}
          </button>
        </div>
      </header>

      <TodayCard onNavigate={onNavigate} />
      <SafetyNudge onNavigate={onNavigate} />

      <section aria-label="This week" className="grid grid-cols-2 gap-2 text-center">
        <Stat value={String(stats.workouts)} label={stats.workouts === 1 ? 'workout this week' : 'workouts this week'} sub={stats.lastWorkoutsSoFar ? `${stats.lastWorkoutsSoFar} by now last week` : undefined} />
        <Stat value={fmtVol(stats.volume)} label={`${units.weight} lifted`} sub={volDelta == null ? undefined : `${volDelta >= 0 ? '▲' : '▼'} ${Math.abs(volDelta)}% vs last week so far`} good={volDelta != null && volDelta >= 0} />
        <Stat value={`${cal.estimated > 0 ? '≈' : ''}${Math.round(cal.total).toLocaleString()}`} label="cal burned in cardio" sub={calSub} />
        <Stat value={String(stats.streak)} label={stats.streak === 1 ? 'week streak' : 'weeks streak'} sub={stats.streak > 0 ? '🔥 keep it going' : 'train this week to start one'} />
      </section>

      {lastLogs.length > 0 && (
        <Card title="Last workout" action={lastDate && <span className="text-sm text-neutral-400">{fmtLong(lastDate)}</span>}>
          <ul className="divide-y divide-neutral-100">
            {lastLogs.map((l) => (
              <li key={l.exerciseId} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 line-clamp-2">{findExercise(custom, l.exerciseId)?.name ?? 'Exercise'}</span>
                <span className="shrink-0 text-xs tabular-nums text-neutral-400">{summary(l, units)}</span>
              </li>
            ))}
          </ul>
          {social && lastDate && (
            <div className="mt-3 flex gap-2">
              <button onClick={() => setLastShare('share')} className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm text-neutral-600">Share</button>
              <button onClick={() => setLastShare('challenge')} className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm text-neutral-600">Challenge a friend</button>
            </div>
          )}
        </Card>
      )}
      {lastShare === 'share' && lastDate && (
        <ShareSheet
          date={lastDate}
          payloadOverride={completedWorkout(lastDate, logs, (id) => findExercise(custom, id), custom) ?? undefined}
          titleOverride={`My workout, ${fmtLong(lastDate)}`}
          onClose={() => setLastShare(null)}
        />
      )}
      {lastShare === 'challenge' && lastDate && <ChallengeSheet fromDate={lastDate} onClose={() => setLastShare(null)} />}

      <BodyweightRow onTrend={() => onNavigate('history', 'body')} />

      <Card title="Goals" action={<button onClick={() => setGoalSheet(true)} className="text-sm text-neutral-500">+ Add</button>}>
        {s.goals.length === 0 ? (
          <p className="text-sm text-neutral-400">Set a target, like a lift, a race or workouts per week, and watch the bar fill.</p>
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

function Stat({ value, label, sub, good }: { value: string; label: string; sub?: string; good?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface px-2 py-3 ring-1 ring-neutral-200/70">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
      {sub && <div className={`mt-1 text-xs leading-tight ${good ? 'text-green-600' : 'text-neutral-400'}`}>{sub}</div>}
    </div>
  )
}

/** Latest weigh-in on one line; logging opens a small sheet and the trend lives in Progress → Body. */
function BodyweightRow({ onTrend }: { onTrend: () => void }) {
  const { bodyweight, units, logBodyweight } = useStore()
  const today = useToday()
  const [logging, setLogging] = useState(false)
  const [draft, setDraft] = useState<number | null>(null)
  const latest = bodyweight.at(-1)
  const prev = bodyweight.at(-2)
  const change = latest && prev ? Math.round(showWeight(latest.lb - prev.lb, units)! * 10) / 10 : null
  return (
    <section className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-neutral-200/70">
      <button onClick={onTrend} className="min-w-0 text-left">
        <span className="block text-sm text-neutral-500">Body weight</span>
        <span className="block text-lg font-semibold tabular-nums">
          {latest ? `${Math.round(showWeight(latest.lb, units)! * 10) / 10} ${units.weight}` : 'Not logged yet'}
          {change != null && change !== 0 && <span className="ml-2 text-sm font-normal text-neutral-400">{change > 0 ? '▲' : '▼'} {Math.abs(change)}</span>}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        {bodyweight.length > 1 && <button onClick={onTrend} className="rounded-full px-3 py-1.5 text-sm text-neutral-500">Trend ›</button>}
        <button onClick={() => { setDraft(null); setLogging(true) }} className="rounded-full bg-neutral-100 px-4 py-1.5 text-sm font-medium text-neutral-700">Log</button>
      </div>
      {logging && (
        <Sheet title="Log body weight" onClose={() => setLogging(false)} closeLabel="Cancel">
          <p className="mb-2 text-sm text-neutral-500">Today, {fmtLong(today)}</p>
          <div className="mb-4"><NumberInput value={draft} step={0.1} placeholder={units.weight} onChange={setDraft} /></div>
          <button disabled={!draft} onClick={() => { logBodyweight(today, storeWeight(draft, units)!); setLogging(false) }} className={primaryBtn}>Save</button>
        </Sheet>
      )}
    </section>
  )
}

function GoalRow({ goal }: { goal: Goal }) {
  const { logs, custom, units, bodyweight, deleteGoal } = useStore()
  const today = useToday()
  const lookup = (id: string) => findExercise(custom, id)
  const title = goalTitle(goal, units, (id) => lookup(id)?.name)
  const pct = goalPct(goal, logs, bodyweight, today, lookup)
  const done = pct >= 1
  const detail = goalDetail(goal, { logs, bodyweight, units, today, lookup })

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
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="mt-1 text-xs text-neutral-400">{done ? 'Goal reached ✓' : detail}</div>
    </li>
  )
}
