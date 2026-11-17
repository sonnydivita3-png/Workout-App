import { addDaysIso, type Plan, type PlanDay, type Week } from './plan'
import { logKey, type DayLog } from './store'

export type DayState = 'rest' | 'done' | 'partial' | 'skipped' | 'missed' | 'open'

/** How a day went: every item done, some, all skipped, nothing logged (missed once it's past), or a rest day. */
export function dayState(day: PlanDay | undefined, log: DayLog | undefined, today: string): DayState {
  if (!day || day.items.length === 0) return 'rest'
  const st = day.items.map((_, i) => log?.items?.[i]?.status)
  if (st.every((s) => s === 'done')) return 'done'
  if (st.every((s) => s === 'skipped')) return 'skipped'
  if (st.some((s) => s === 'done')) return 'partial'
  if (st.some((s) => s)) return day.date < today ? 'partial' : 'open'
  return day.date < today ? 'missed' : 'open'
}

/** Miles run in a week: what was logged, or the planned miles of a run marked done without numbers. */
export function weekMiles(plan: Plan, week: Week, logs: Record<string, DayLog>): { planned: number; done: number } {
  let planned = 0
  let done = 0
  for (let i = 0; i < 7; i++) {
    const date = addDaysIso(week.start, i)
    const day = plan.days.find((d) => d.date === date)
    if (!day) continue
    const log = logs[logKey(plan.id, date)]
    day.items.forEach((it, j) => {
      if (it.type !== 'run' && it.type !== 'race') return
      planned += it.miles ?? 0
      const l = log?.items?.[j]
      if (l?.status === 'done') done += l.miles ?? it.miles ?? 0
    })
  }
  return { planned: round1(week.miles ?? planned), done: round1(done) }
}

/** Average of a week's weigh-ins (Mon–Sun), or null with none. */
export function weekAverage(weights: Record<string, number>, weekStart: string): number | null {
  const v: number[] = []
  for (let i = 0; i < 7; i++) {
    const w = weights[addDaysIso(weekStart, i)]
    if (w != null) v.push(w)
  }
  return v.length ? round1(v.reduce((a, b) => a + b, 0) / v.length) : null
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** "72" → 72 minutes; "1:12" → 72; "1:12:30" → 72.5. Null if it isn't a time. */
export function parseDuration(text: string): number | null {
  const t = text.trim()
  if (!t) return null
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t)
  const m = /^(\d+):([0-5]\d)(?::([0-5]\d))?$/.exec(t)
  if (!m) return null
  return m[3] != null ? Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 60 : Number(m[1]) * 60 + Number(m[2])
}

/** 72 → "1:12"; 45 → "45 min". */
export function formatDuration(min: number): string {
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min - h * 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

/** Pace per mile, "11:42 /mi". */
export function pace(miles?: number, minutes?: number): string | null {
  if (!miles || !minutes) return null
  const p = minutes / miles
  const m = Math.floor(p)
  const s = Math.round((p - m) * 60)
  return s === 60 ? `${m + 1}:00 /mi` : `${m}:${String(s).padStart(2, '0')} /mi`
}
