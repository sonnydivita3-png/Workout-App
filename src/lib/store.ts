import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import bundled from '../plans/ice-age-50k.json'
import { checkPlan, type Plan } from './plan'

export type Status = 'done' | 'skipped'
export interface SetLog { lb?: number; reps?: number }
export interface ExerciseLog { done?: boolean; sets?: SetLog[] }
export interface ItemLog {
  status?: Status
  miles?: number
  minutes?: number
  /** By exercise position in the workout version. */
  ex?: Record<number, ExerciseLog>
}
export interface DayLog {
  items?: Record<number, ItemLog>
  spine?: boolean
  note?: string
  /** Workout done was tapped: the day shows as a short summary until reopened. */
  finished?: boolean
}
export type Theme = 'dark' | 'light' | 'auto'

export interface State {
  /** The plan being followed (null: the bundled Ice Age 50K plan). */
  plan: Plan | null
  /** Keyed by `${plan id}|${date}`, so a new plan starts with a clean log and an old one keeps its own. */
  logs: Record<string, DayLog>
  /** Morning weigh-ins, lb, by date. */
  weights: Record<string, number>
  theme: Theme
  setPlan: (plan: Plan | null) => void
  updateDay: (planId: string, date: string, fn: (d: DayLog) => DayLog) => void
  setWeight: (date: string, lb: number | null) => void
  setTheme: (t: Theme) => void
  restore: (data: Pick<State, 'plan' | 'logs' | 'weights'>) => void
}

export const STORE_KEY = 'durata-v2'

/**
 * Saved data from earlier versions of the Ice Age plan's calendar, kept on the days where those sessions are now.
 * - Version 2 moved Thursday's session to Friday and swapped Saturday and Sunday: a log for Thu Nov 19 moved to Fri
 *   Nov 20.
 * - Version 3 went back to the original calendar (run and Strength B Thursday, long run Saturday): Fri Nov 20's log
 *   moves back to Thu Nov 19, and Sat Nov 21 and Sun Nov 22 swap back.
 */
export function migrateSaved(saved: Partial<State>, from: number): Partial<State> {
  if (from < 2 && saved.logs) {
    const thu = 'ice-age-50k-2027|2026-11-19'
    const fri = 'ice-age-50k-2027|2026-11-20'
    if (saved.logs[thu] && !saved.logs[fri]) {
      const { [thu]: moved, ...rest } = saved.logs
      saved = { ...saved, logs: { ...rest, [fri]: moved } }
    }
  }
  if (from < 3 && saved.logs) {
    const k = (d: string) => `ice-age-50k-2027|2026-11-${d}`
    const logs = { ...saved.logs }
    const move = (a: string, b: string) => {
      if (!logs[k(a)] || logs[k(b)]) return
      logs[k(b)] = logs[k(a)]
      delete logs[k(a)]
    }
    move('20', '19')
    const sat = logs[k('21')]
    const sun = logs[k('22')]
    delete logs[k('21')]
    delete logs[k('22')]
    if (sun) logs[k('21')] = sun
    if (sat) logs[k('22')] = sat
    saved = { ...saved, logs }
  }
  return saved
}
export const logKey = (planId: string, date: string) => `${planId}|${date}`

const BUNDLED = (() => {
  const r = checkPlan(bundled)
  if ('errors' in r) throw new Error(`Bundled plan is invalid: ${r.errors.join('; ')}`)
  return r.plan
})()

export const useStore = create<State>()(
  persist(
    (set) => ({
      plan: null,
      logs: {},
      weights: {},
      theme: 'dark',
      setPlan: (plan) => set({ plan }),
      updateDay: (planId, date, fn) => set((s) => {
        const k = logKey(planId, date)
        return { logs: { ...s.logs, [k]: fn(s.logs[k] ?? {}) } }
      }),
      setWeight: (date, lb) => set((s) => {
        const weights = { ...s.weights }
        if (lb == null) delete weights[date]
        else weights[date] = lb
        return { weights }
      }),
      setTheme: (theme) => set({ theme }),
      restore: ({ plan, logs, weights }) => set({ plan, logs, weights }),
    }),
    {
      name: STORE_KEY,
      version: 3,
      migrate: (saved, from) => migrateSaved(saved as Partial<State>, from) as State,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ plan: s.plan, logs: s.logs, weights: s.weights, theme: s.theme }),
    },
  ),
)

/** The plan in use. */
export const usePlan = (): Plan => useStore((s) => s.plan) ?? BUNDLED
export const bundledPlan = () => BUNDLED

/** Change one item's log on a day. */
export function updateItem(planId: string, date: string, index: number, fn: (l: ItemLog) => ItemLog) {
  useStore.getState().updateDay(planId, date, (d) => ({ ...d, items: { ...d.items, [index]: fn(d.items?.[index] ?? {}) } }))
}

/**
 * Workout done (`as` 'done'): whatever wasn't ticked or skipped counts as done, and the day folds into a summary.
 * Missed workout (`as` 'skipped'): whatever wasn't ticked counts as skipped (anything already done stays done).
 */
export function finishDay(planId: string, date: string, count: number, as: Status = 'done') {
  useStore.getState().updateDay(planId, date, (d) => {
    const items = { ...d.items }
    for (let i = 0; i < count; i++) if (!items[i]?.status) items[i] = { ...items[i], status: as }
    return { ...d, items, finished: true }
  })
}
