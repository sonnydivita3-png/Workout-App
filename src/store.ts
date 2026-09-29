import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BUILTIN_BY_ID } from './data/exercises'
import { parseISO, weekdayIndex } from './lib/dates'
import { dayPlanOf } from './lib/plan'
import type {
  AppNotification, BodyweightEntry, NotifPrefs, CardioEntry, Exercise, ExerciseKind, ExerciseLog, ExerciseMode, Goal, NewGoal, PlanOverrides, PlannedExercise, Routine, StrengthSet, Units, WeekPlan,
} from './types'

export interface Data {
  plan: WeekPlan
  overrides: PlanOverrides
  logs: ExerciseLog[]
  custom: Exercise[]
  units: Units
  name: string
  bodyweight: BodyweightEntry[]
  routines: Routine[]
  goals: Goal[]
}

interface State extends Data {
  notifications: AppNotification[]
  notifPrefs: NotifPrefs
  pushNotifications: (items: Omit<AppNotification, 'ts' | 'read'>[]) => AppNotification[]
  markAllRead: () => void
  clearNotifications: () => void
  setNotifPrefs: (p: Partial<NotifPrefs>) => void
  /** Wipe everything back to a fresh install, optionally keeping name, units and notification settings. */
  resetAll: (keepProfile: boolean) => void
  deleteBodyweight: (date: string) => void
  // Plan edits take a date: they change that date's override if it has one, else the weekly template.
  addExercise: (date: string, exerciseId: string, kind: ExerciseKind) => void
  removeExercise: (date: string, exerciseId: string) => void
  setSetCount: (date: string, exerciseId: string, sets: number) => void
  saveStrength: (date: string, exerciseId: string, sets: StrengthSet[]) => void
  saveCardio: (date: string, exerciseId: string, cardio: CardioEntry) => void
  createCustom: (name: string, kind: ExerciseKind, mode?: ExerciseMode) => Exercise
  setUnits: (u: Partial<Units>) => void
  setName: (name: string) => void
  logBodyweight: (date: string, lb: number) => void
  addPlanned: (date: string, items: PlannedExercise[]) => void
  copyDay: (from: string, to: string[]) => void
  /** Write dated plans (e.g. a generated week or month); empty arrays are rest days. */
  applyProgram: (days: PlanOverrides) => void
  /** Drop a date's override so it follows the weekly template again. */
  resetDay: (date: string) => void
  saveRoutine: (name: string, items: PlannedExercise[]) => void
  deleteRoutine: (id: string) => void
  loadRoutine: (date: string, id: string) => void
  addGoal: (goal: NewGoal) => void
  deleteGoal: (id: string) => void
  importData: (d: Data) => void
}

const emptyPlan = (): WeekPlan => Array.from({ length: 7 }, () => [])

/** Apply `fn` to a date's exercises, editing its override if present, else the weekly template. */
function editDay(s: Pick<Data, 'plan' | 'overrides'>, date: string, fn: (items: PlannedExercise[]) => PlannedExercise[]) {
  if (s.overrides[date]) return { overrides: { ...s.overrides, [date]: fn(s.overrides[date]) } }
  const day = weekdayIndex(parseISO(date))
  return { plan: s.plan.map((d, i) => (i === day ? fn(d) : d)) }
}

const appendMissing = (d: PlannedExercise[], items: PlannedExercise[]) => [
  ...d,
  ...items.filter((p) => !d.some((q) => q.exerciseId === p.exerciseId)).map((p) => ({ ...p })),
]

const upsertLog = (logs: ExerciseLog[], next: ExerciseLog) => [
  ...logs.filter((l) => !(l.date === next.date && l.exerciseId === next.exerciseId)),
  next,
]

/** A fresh install's data. */
const defaults = () => ({
  plan: emptyPlan(),
  overrides: {} as PlanOverrides,
  logs: [] as ExerciseLog[],
  custom: [] as Exercise[],
  units: { weight: 'lb', distance: 'mi' } as Units,
  name: '',
  bodyweight: [] as BodyweightEntry[],
  routines: [] as Routine[],
  goals: [] as Goal[],
  notifications: [] as AppNotification[],
  notifPrefs: { system: false, goals: true, pbs: true, daily: true, reminderTime: '17:00' } as NotifPrefs,
})

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...defaults(),
      resetAll: (keepProfile) =>
        set((s) => ({
          ...defaults(),
          ...(keepProfile ? { name: s.name, units: s.units, notifPrefs: s.notifPrefs } : {}),
        })),
      pushNotifications: (items) => {
        const existing = new Map(get().notifications.map((n) => [n.id, n]))
        const created: AppNotification[] = []
        const updated = new Map<string, Omit<AppNotification, 'ts' | 'read'>>()
        for (const it of items) {
          if (existing.has(it.id)) {
            const cur = existing.get(it.id)!
            if (cur.title !== it.title || cur.body !== it.body) updated.set(it.id, it)
          } else {
            created.push({ ...it, ts: Date.now(), read: false })
          }
        }
        if (created.length || updated.size) {
          set((s) => ({
            notifications: [
              ...created,
              ...s.notifications.map((n) => (updated.has(n.id) ? { ...n, ...updated.get(n.id)! } : n)),
            ]
              .sort((a, b) => b.ts - a.ts)
              .slice(0, 50),
          }))
        }
        return created
      },
      markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => (n.read ? n : { ...n, read: true })) })),
      clearNotifications: () => set({ notifications: [] }),
      setNotifPrefs: (p) => set((s) => ({ notifPrefs: { ...s.notifPrefs, ...p } })),
      deleteBodyweight: (date) => set((s) => ({ bodyweight: s.bodyweight.filter((b) => b.date !== date) })),
      addExercise: (date, exerciseId, kind) =>
        set((s) => editDay(s, date, (d) => (d.some((p) => p.exerciseId === exerciseId) ? d : [...d, { exerciseId, sets: kind === 'strength' ? 3 : 1 }]))),
      removeExercise: (date, exerciseId) => set((s) => editDay(s, date, (d) => d.filter((p) => p.exerciseId !== exerciseId))),
      setSetCount: (date, exerciseId, sets) =>
        set((s) => editDay(s, date, (d) => d.map((p) => (p.exerciseId === exerciseId ? { ...p, sets } : p)))),
      saveStrength: (date, exerciseId, sets) =>
        set((s) => ({ logs: upsertLog(s.logs, { date, exerciseId, sets }) })),
      saveCardio: (date, exerciseId, cardio) =>
        set((s) => ({ logs: upsertLog(s.logs, { date, exerciseId, cardio }) })),
      createCustom: (name, kind, mode) => {
        const ex: Exercise = {
          id: `custom-${Date.now().toString(36)}`,
          name: name.trim(),
          kind,
          mode: kind === 'strength' ? (mode ?? 'weight') : undefined,
          group: kind === 'cardio' ? 'Cardio' : 'Other',
          equipment: 'Custom',
          custom: true,
        }
        set({ custom: [...get().custom, ex] })
        return ex
      },
      setUnits: (u) => set((s) => ({ units: { ...s.units, ...u } })),
      setName: (name) => set({ name }),
      logBodyweight: (date, lb) =>
        set((s) => ({
          bodyweight: [...s.bodyweight.filter((b) => b.date !== date), { date, lb }].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        })),
      addPlanned: (date, items) => set((s) => editDay(s, date, (d) => appendMissing(d, items))),
      copyDay: (from, to) =>
        set((s) => {
          const items = dayPlanOf(s.plan, s.overrides, from)
          let next: Pick<Data, 'plan' | 'overrides'> = { plan: s.plan, overrides: s.overrides }
          for (const date of to) if (date !== from) next = { ...next, ...editDay(next, date, () => items.map((p) => ({ ...p }))) }
          return next
        }),
      applyProgram: (days) => set((s) => ({ overrides: { ...s.overrides, ...days } })),
      resetDay: (date) =>
        set((s) => {
          const { [date]: _dropped, ...rest } = s.overrides
          void _dropped
          return { overrides: rest }
        }),
      saveRoutine: (name, items) =>
        set((s) => ({
          routines: [...s.routines, { id: `r-${Date.now().toString(36)}`, name: name.trim(), items: items.map((p) => ({ ...p })) }],
        })),
      deleteRoutine: (id) => set((s) => ({ routines: s.routines.filter((r) => r.id !== id) })),
      loadRoutine: (date, id) =>
        set((s) => {
          const r = s.routines.find((x) => x.id === id)
          return r ? editDay(s, date, (d) => appendMissing(d, r.items)) : s
        }),
      addGoal: (goal) => set((s) => ({ goals: [...s.goals, { ...goal, id: `g-${Date.now().toString(36)}` } as Goal] })),
      deleteGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
      importData: (d) =>
        set({
          plan: d.plan, overrides: d.overrides ?? {}, logs: d.logs, custom: d.custom ?? [], units: d.units,
          name: d.name ?? '', bodyweight: d.bodyweight ?? [], routines: d.routines ?? [], goals: d.goals ?? [],
        }),
    }),
    { name: 'workout-app-v1', version: 1 },
  ),
)

/** Resolve an exercise id against the built-in library and the user's custom exercises. */
export function findExercise(custom: Exercise[], id: string): Exercise | undefined {
  return BUILTIN_BY_ID.get(id) ?? custom.find((e) => e.id === id)
}

/** Most recent log for an exercise strictly before `date` — powers the "last time" hint. */
export const selectLastLog = (logs: ExerciseLog[], exerciseId: string, date: string) =>
  logs
    .filter((l) => l.exerciseId === exerciseId && l.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
