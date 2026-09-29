import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CardioEntry, ExerciseLog, StrengthSet, WeekPlan } from './types'

interface State {
  plan: WeekPlan
  logs: ExerciseLog[]
  addExercise: (day: number, exerciseId: string, kind: 'strength' | 'cardio') => void
  removeExercise: (day: number, exerciseId: string) => void
  setSetCount: (day: number, exerciseId: string, sets: number) => void
  saveStrength: (date: string, exerciseId: string, sets: StrengthSet[]) => void
  saveCardio: (date: string, exerciseId: string, cardio: CardioEntry) => void
}

const emptyPlan = (): WeekPlan => Array.from({ length: 7 }, () => [])

const upsertLog = (logs: ExerciseLog[], next: ExerciseLog) => [
  ...logs.filter((l) => !(l.date === next.date && l.exerciseId === next.exerciseId)),
  next,
]

export const useStore = create<State>()(
  persist(
    (set) => ({
      plan: emptyPlan(),
      logs: [],
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
    }),
    { name: 'workout-app-v1' },
  ),
)

/** Most recent log for an exercise strictly before `date` — powers the "last time" hint. */
export const selectLastLog = (logs: ExerciseLog[], exerciseId: string, date: string) =>
  logs
    .filter((l) => l.exerciseId === exerciseId && l.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
