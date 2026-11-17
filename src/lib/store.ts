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
      version: 1,
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
