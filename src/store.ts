import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BUILTIN_BY_ID } from './data/exercises'
import type {
  AppNotification, BodyweightEntry, NotifPrefs, CardioEntry, Exercise, ExerciseKind, ExerciseLog, Goal, NewGoal, PlannedExercise, Routine, StrengthSet, Units, WeekPlan,
} from './types'

export interface Data {
  plan: WeekPlan
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
  deleteBodyweight: (date: string) => void
  addExercise: (day: number, exerciseId: string, kind: ExerciseKind) => void
  removeExercise: (day: number, exerciseId: string) => void
  setSetCount: (day: number, exerciseId: string, sets: number) => void
  saveStrength: (date: string, exerciseId: string, sets: StrengthSet[]) => void
  saveCardio: (date: string, exerciseId: string, cardio: CardioEntry) => void
  createCustom: (name: string, kind: ExerciseKind) => Exercise
  setUnits: (u: Partial<Units>) => void
  setName: (name: string) => void
  logBodyweight: (date: string, lb: number) => void
  addPlanned: (day: number, items: PlannedExercise[]) => void
  copyDay: (from: number, to: number[]) => void
  saveRoutine: (name: string, items: PlannedExercise[]) => void
  deleteRoutine: (id: string) => void
  loadRoutine: (day: number, id: string) => void
  addGoal: (goal: NewGoal) => void
  deleteGoal: (id: string) => void
  importData: (d: Data) => void
}

const emptyPlan = (): WeekPlan => Array.from({ length: 7 }, () => [])

const upsertLog = (logs: ExerciseLog[], next: ExerciseLog) => [
  ...logs.filter((l) => !(l.date === next.date && l.exerciseId === next.exerciseId)),
  next,
]

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      plan: emptyPlan(),
      logs: [],
      custom: [],
      units: { weight: 'lb', distance: 'mi' },
      name: '',
      bodyweight: [],
      routines: [],
      goals: [],
      notifications: [],
      notifPrefs: { system: false, goals: true, pbs: true, daily: true, reminderTime: '17:00' },
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
      addExercise: (day, exerciseId, kind) =>
        set((s) => ({
          plan: s.plan.map((d, i) =>
            i === day && !d.some((p) => p.exerciseId === exerciseId)
              ? [...d, { exerciseId, sets: kind === 'strength' ? 3 : 1 }]
              : d,
          ),
        })),
      removeExercise: (day, exerciseId) =>
        set((s) => ({
          plan: s.plan.map((d, i) => (i === day ? d.filter((p) => p.exerciseId !== exerciseId) : d)),
        })),
      setSetCount: (day, exerciseId, sets) =>
        set((s) => ({
          plan: s.plan.map((d, i) =>
            i === day ? d.map((p) => (p.exerciseId === exerciseId ? { ...p, sets } : p)) : d,
          ),
        })),
      saveStrength: (date, exerciseId, sets) =>
        set((s) => ({ logs: upsertLog(s.logs, { date, exerciseId, sets }) })),
      saveCardio: (date, exerciseId, cardio) =>
        set((s) => ({ logs: upsertLog(s.logs, { date, exerciseId, cardio }) })),
      createCustom: (name, kind) => {
        const ex: Exercise = {
          id: `custom-${Date.now().toString(36)}`,
          name: name.trim(),
          kind,
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
      addPlanned: (day, items) =>
        set((s) => ({
          plan: s.plan.map((d, i) =>
            i === day ? [...d, ...items.filter((p) => !d.some((q) => q.exerciseId === p.exerciseId)).map((p) => ({ ...p }))] : d,
          ),
        })),
      copyDay: (from, to) =>
        set((s) => ({
          plan: s.plan.map((d, i) => (to.includes(i) && i !== from ? s.plan[from].map((p) => ({ ...p })) : d)),
        })),
      saveRoutine: (name, items) =>
        set((s) => ({
          routines: [...s.routines, { id: `r-${Date.now().toString(36)}`, name: name.trim(), items: items.map((p) => ({ ...p })) }],
        })),
      deleteRoutine: (id) => set((s) => ({ routines: s.routines.filter((r) => r.id !== id) })),
      loadRoutine: (day, id) =>
        set((s) => {
          const r = s.routines.find((x) => x.id === id)
          if (!r) return s
          return {
            plan: s.plan.map((d, i) =>
              i === day ? [...d, ...r.items.filter((p) => !d.some((q) => q.exerciseId === p.exerciseId)).map((p) => ({ ...p }))] : d,
            ),
          }
        }),
      addGoal: (goal) => set((s) => ({ goals: [...s.goals, { ...goal, id: `g-${Date.now().toString(36)}` } as Goal] })),
      deleteGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
      importData: (d) =>
        set({
          plan: d.plan, logs: d.logs, custom: d.custom ?? [], units: d.units,
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
