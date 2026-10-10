import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BUILTIN_BY_ID } from './data/exercises'
import { setMovePrefs, type MovePrefs } from './lib/movePrefs'
import type { ProgramGoal, RepScheme, SetScheme } from './lib/program'
import type { CardioSetup } from './lib/cardioSetup'
import { parseISO, weekdayIndex } from './lib/dates'
import { toPlanned, type CardioDay } from './lib/cardioPlan'
import { dayPlanOf } from './lib/plan'
import { repairState, SCHEMA_VERSION } from './lib/migrate'
import { SYNC_KEYS } from './lib/sync'
import type { RestPref } from './lib/timing'
import type { WorkoutStyle } from './lib/randomizer'
import type { ExtraTimeChoice } from './lib/volumePrefs'

import { setOwnedGear } from './lib/equipment'
import { setChosenModes, withChosenMode } from './lib/exerciseModes'
import { setFavorites } from './lib/favorites'
import { placeWarmups } from './lib/warmups'
import { workSets } from './lib/progression'
import { setCardioPrefs } from './lib/cardioPrefs'
import { activePrograms, clearRange, removeProgramDays } from './lib/programs'
import { customFields, newCustomId, sameName, usageOf, type CustomExerciseInput } from './lib/customExercises'
import type {
  AppNotification, BodyweightEntry, NotifPrefs, CardioEntry, Exercise, ExerciseKind, ExerciseLog, ExerciseMode, Goal, NewGoal, PlanOverrides, PlannedExercise, Measurement, Program, Routine, Benchmark, AboutMe, Sport, TimedLog, StrengthSet, Units, WeekPlan,
} from './types'

export interface TrainingPrefs {
  styles: WorkoutStyle[]
  /** Cardio type ids (lib/cardioPrefs.ts). */
  cardio: string[]
  /** Split cardio time across the liked types instead of one per session. */
  cardioSplit: boolean
  /** Kinds of movement to lean towards (1) or away from (-1): compound, free weights, one arm / one leg… */
  moves?: MovePrefs
  /** Goals, one or more (from first run, a plan, or Settings). Set the weekly hard-set target and the default plan. */
  goals?: ProgramGoal[]
  /** Older single goal, read when `goals` isn't set (see savedGoals). */
  goal?: ProgramGoal | null
  /** Their own weekly hard-set target per big muscle, instead of the goal's. */
  setTarget?: number | null
  /** Their own weekly cardio minutes, instead of the goal's. */
  cardioMinutes?: number | null
  /** Weekly cardio distance to aim for, in miles (optional; no distance target when unset). */
  cardioMiles?: number | null
  /** Most exercises for one muscle in a generated workout before it asks how to use the time (default 5). */
  perMuscle?: number
  /** What generated workouts do when filling the time would give one muscle more than that (see lib/volumePrefs.ts). */
  extraTime?: ExtraTimeChoice
}

export type ThemeMode = 'dark' | 'light' | 'auto'
export type Accent = 'lime' | 'pink' | 'violet' | 'orange' | 'blue'

/** Bump when the walkthrough gains new content, so people who saw an older version see it once more. */
export const TOUR_VERSION = 5

export type WarmupKind = 'cardio' | 'mobility' | 'sets'

export type SocialChoice = 'unset' | 'enabled' | 'declined'

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
  timedLogs?: TimedLog[]
  measurements?: Measurement[]
  benchmarks?: Benchmark[]
  /** Exercises the person tracks their own way: bodyweight (reps only) or with weight, by exercise id. */
  exerciseModes?: Record<string, ExerciseMode>
  /** Favorite exercises (ids): starred in the picker, and picked more often by generated workouts. */
  favorites?: string[]
}

interface State extends Data {
  /** Whether the person opted in to social features, opted out, or hasn't been asked yet. */
  socialChoice: SocialChoice
  setSocialChoice: (c: SocialChoice) => void
  /** Handle from an invite link (?add=handle) waiting to be added as a friend. */
  pendingInvite: string | null
  /** Challenges I sent: the last status I've seen for each, so a friend's answer shows up once in the inbox. */
  seenChallenges: Record<string, string>
  markChallengesSeen: (seen: Record<string, string>) => void
  setPendingInvite: (h: string | null) => void
  /** First-run setup (goal, days, first plan) finished or skipped. */
  onboarded: boolean
  setOnboarded: (v: boolean) => void
  /** Equipment the person has (null = a full gym). Generated workouts and plans only use this. */
  equipment: string[] | null
  setEquipment: (e: string[] | null) => void
  /** Workout styles and cardio the person likes (from first-run setup or Settings). Empty means no preference. */
  trainingPrefs: TrainingPrefs
  setTrainingPrefs: (p: Partial<TrainingPrefs>) => void
  /** Optional sex, birth year and height, for personal calorie estimates. */
  aboutMe: AboutMe
  setAboutMe: (p: Partial<AboutMe>) => void
  /** Equipment filter last used in the exercise picker ('Any' for no filter). */
  pickerEquipment: string
  setPickerEquipment: (e: string) => void
  /** One-time tips already shown, by id. */
  tipsSeen: string[]
  seeTip: (id: string) => void
  /** Dates marked "Workout complete" (even if some planned sets weren't logged). */
  finishedDays: string[]
  finishDay: (date: string) => void
  /** Undo "Workout complete" (tapped by mistake, or there's more to do). */
  unfinishDay: (date: string) => void
  /** Replace a date's exercises (reordered, grouped into supersets...). */
  setDayItems: (date: string, items: PlannedExercise[]) => void
  /** Make a date's exercises the usual plan for that weekday (every week). */
  setUsualDay: (date: string) => void
  /** Stop repeating a weekday's usual plan; this date keeps its exercises. */
  clearUsualDay: (date: string) => void
  /** When each Home reminder (install, backup) was last dismissed, in ms. */
  nudgeSnooze: Record<string, number>
  snoozeNudge: (id: string) => void
  /** Whether the first-run walkthrough has been finished or skipped. */
  /** Look and feel. Kept even when all data is erased. */
  theme: ThemeMode
  accent: Accent
  setTheme: (t: ThemeMode) => void
  setAccent: (a: Accent) => void
  /** Randomizer choices remembered between uses. */
  genPrefs: { warmup: WarmupKind[]; rest: RestPref; /** Week/month plans: minutes of easy cardio + mobility (default 5, or 9 for both). */ warmMinutes?: number; focus?: string[]; styles?: WorkoutStyle[]; minutes?: number; drops?: boolean; kinds?: ('lift' | 'cond' | 'cardio')[]; cardioSetup?: CardioSetup; /** Week/month plan choices, remembered for next time. */ plan?: { reps?: RepScheme; sets?: SetScheme; deload?: boolean; keepLifts?: boolean } }
  setGenPrefs: (p: Partial<State['genPrefs']>) => void
  /** Show an RPE (effort) column when logging sets. */
  trackRpe: boolean
  /** Rest timer after each set in workout mode, in seconds. 0 = off, -1 = as planned for each exercise. */
  restSeconds: number
  setPrefs: (p: Partial<Pick<State, 'trackRpe' | 'restSeconds' | 'backendKind'>>) => void
  /** Which social server this device last used, to notice the switch from preview to a real one. */
  backendKind: 'demo' | 'supabase' | null
  saveNote: (date: string, exerciseId: string, note: string) => void
  tourDone: boolean
  /** Which walkthrough version was last finished or skipped. */
  tourVersion: number
  setTourDone: (done: boolean) => void
  /** Add dated exercises (e.g. from a friend's shared plan). They join what's planned unless `replace`. */
  applyDays: (days: Record<string, PlannedExercise[]>, replace: boolean) => void
  addCustomExercises: (list: Exercise[]) => void
  /** Cloud backup: on/off and where this device is up to. */
  cloud: { enabled: boolean; lastSyncedAt: string | null; lastHash: string | null; conflict: boolean; error: string | null; checkedAt: number | null }
  setCloud: (p: Partial<State['cloud']>) => void
  /** Replace workout data with a copy from the cloud (checked and repaired first). */
  replaceData: (data: unknown) => void
  measurements: Measurement[]
  saveMeasurement: (m: Omit<Measurement, 'id'>) => void
  deleteMeasurement: (id: string) => void
  /** Delete everything logged on a date (all exercises and timed results). */
  deleteDay: (date: string) => void
  /** Results of timed blocks (AMRAP / EMOM / for time). */
  timedLogs: TimedLog[]
  /** Save a timed result, replacing an earlier one for the same block that day, along with the per-exercise logs it implies. */
  saveTimed: (log: Omit<TimedLog, 'id'>, derived: ExerciseLog[]) => void
  deleteTimed: (id: string) => void
  /** Timed workouts saved to repeat, so their results can be compared. */
  benchmarks: Benchmark[]
  saveBenchmark: (name: string, items: PlannedExercise[]) => void
  deleteBenchmark: (id: string) => void
  /** Add a benchmark to a day (as its own block, so it never merges with another timed workout). */
  addBenchmark: (date: string, id: string) => void
  /** Plans added in one go (a week/month program or a run/bike plan), so they can be stopped or replaced. */
  programs: Program[]
  /** Add a random week/month program. Any earlier program still running is stopped first. */
  startProgram: (days: PlanOverrides, title: string, today: string) => void
  /**
   * Add a run/bike training plan. `stopSame` first stops any plan still running for the same sport, so a new plan
   * replaces it instead of piling on top.
   */
  startCardioProgram: (p: { sessions: CardioDay[]; sport: Sport; title: string; goalId?: string; replace: boolean; stopSame: boolean; today: string }) => void
  /** Remove a program's upcoming days (today on). Logged days stay. Returns how many days changed. */
  stopProgram: (id: string, today: string) => number
  /** Clear planned days in a range back to the weekly plan, keeping logged days. Returns how many days changed. */
  clearPlan: (from: string, to: string) => number
  notifications: AppNotification[]
  notifPrefs: NotifPrefs
  pushNotifications: (items: Omit<AppNotification, 'ts' | 'read'>[]) => AppNotification[]
  markAllRead: () => void
  clearNotifications: () => void
  setNotifPrefs: (p: Partial<NotifPrefs>) => void
  /** Wipe everything back to a fresh install, optionally keeping name, units and notification settings. */
  resetAll: (keepProfile: boolean) => void
  deleteBodyweight: (date: string) => void
  // Plan edits take a date and change that date only (see setUsualDay for the weekly template).
  addExercise: (date: string, exerciseId: string, kind: ExerciseKind) => void
  removeExercise: (date: string, exerciseId: string) => void
  setSetCount: (date: string, exerciseId: string, sets: number) => void
  saveStrength: (date: string, exerciseId: string, sets: StrengthSet[]) => void
  saveCardio: (date: string, exerciseId: string, cardio: CardioEntry) => void
  /** Delete one logged session, or every session of an exercise when no date is given. */
  deleteLogs: (exerciseId: string, date?: string) => void
  /** Add an exercise of their own. One they deleted with the same name comes back instead, so its history carries on. */
  createCustom: (input: CustomExerciseInput) => Exercise
  /** Change one of their exercises. Lifting stays lifting (and cardio cardio) once it's logged or planned. */
  updateCustom: (id: string, input: CustomExerciseInput) => Exercise | undefined
  /** Delete one of their exercises. Once it's logged or planned it's only hidden, so history and plans keep its name. */
  removeCustom: (id: string) => void
  exerciseModes: Record<string, ExerciseMode>
  /** Track an exercise with weight or as bodyweight (reps only), from now on. Going bodyweight, its 0 lb sets become bodyweight sets. */
  setExerciseMode: (exerciseId: string, mode: ExerciseMode) => void
  favorites: string[]
  /** Star or unstar an exercise. */
  toggleFavorite: (exerciseId: string) => void
  setUnits: (u: Partial<Units>) => void
  /** A cardio card's own distance unit (a rower in km, a swim in yards). */
  setDistanceUnit: (exerciseId: string, unit: NonNullable<Units['byExercise']>[string]) => void
  setName: (name: string) => void
  logBodyweight: (date: string, lb: number) => void
  addPlanned: (date: string, items: PlannedExercise[]) => void
  copyDay: (from: string, to: string[]) => void
  /** Write dated plans (e.g. a generated week or month); empty arrays are rest days. */
  applyProgram: (days: PlanOverrides) => void
  /**
   * Add a cardio plan's sessions to their dates. By default they join whatever is already planned (a run
   * replaces an existing run entry); with `replace` they take the whole day.
   */
  applyCardioPlan: (items: Record<string, PlannedExercise>, replace: boolean) => void
  /** Drop a date's override so it follows the weekly template again. */
  resetDay: (date: string) => void
  /** Mark a date as a rest day: an empty override, whatever the weekly template says. */
  setRestDay: (date: string) => void
  saveRoutine: (name: string, items: PlannedExercise[]) => void
  deleteRoutine: (id: string) => void
  loadRoutine: (date: string, id: string) => void
  addGoal: (goal: NewGoal) => string
  deleteGoal: (id: string) => void
  /** Restore from a backup file: checked and repaired, replaces all workout data. */
  importData: (d: unknown) => void
}

const emptyPlan = (): WeekPlan => Array.from({ length: 7 }, () => [])

// 0 lb meant bodyweight all along: those sets are logged as reps only, like the rest from now on.
function zeroToBodyweight(logs: ExerciseLog[], id: string): ExerciseLog[] {
  const zero = (l: ExerciseLog) => l.exerciseId === id && !!l.sets?.some((x) => x.weight === 0)
  return logs.some(zero) ? logs.map((l) => (zero(l) ? { ...l, sets: l.sets!.map((x) => (x.weight === 0 ? { ...x, weight: null } : x)) } : l)) : logs
}

/** Their own exercise is tracked the way its form says from now on (over an earlier choice from the ⋯ menu). */
function trackAs(s: Pick<Data, 'exerciseModes' | 'logs'>, id: string, mode: ExerciseMode | undefined): Pick<Data, 'exerciseModes' | 'logs'> {
  const exerciseModes = { ...s.exerciseModes }
  delete exerciseModes[id]
  return { exerciseModes, logs: mode === 'reps' ? zeroToBodyweight(s.logs, id) : s.logs }
}

/** Apply `fn` to a date's exercises, editing its override if present, else the weekly template. */
function editDay(s: Pick<Data, 'plan' | 'overrides' | 'custom'>, date: string, fn: (items: PlannedExercise[]) => PlannedExercise[]) {
  // Edits apply to this date only; "Repeat every <weekday>" (setUsualDay) is how a day becomes part of the usual week.
  const template = s.plan[weekdayIndex(parseISO(date))]
  // Warm-up sets stay with the first two lifts, whatever is added, removed, swapped or reordered.
  const next = placeWarmups(fn(s.overrides[date] ?? template), (id) => findExercise(s.custom, id))
  if (next.length === 0 && template.length === 0) {
    // Nothing left and nothing usually planned: just an empty day, not a rest day.
    const { [date]: _gone, ...rest } = s.overrides
    return { overrides: rest }
  }
  return { overrides: { ...s.overrides, [date]: next } }
}

const appendMissing = (d: PlannedExercise[], items: PlannedExercise[]) => [
  ...d,
  ...items.filter((p) => !d.some((q) => q.exerciseId === p.exerciseId)).map((p) => ({ ...p })),
]

/** Editing sets shouldn't wipe the note on that exercise. */
const keepNote = (logs: ExerciseLog[], date: string, exerciseId: string) => {
  const note = logs.find((l) => l.date === date && l.exerciseId === exerciseId)?.note
  return note ? { note } : {}
}

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
  programs: [] as Program[],
  timedLogs: [] as TimedLog[],
  benchmarks: [] as Benchmark[],
  measurements: [] as Measurement[],
  exerciseModes: {} as Record<string, ExerciseMode>,
  favorites: [] as string[],
  cloud: { enabled: false, lastSyncedAt: null, lastHash: null, conflict: false, error: null, checkedAt: null } as State['cloud'],
  theme: 'dark' as ThemeMode,
  accent: 'lime' as Accent,
  socialChoice: 'unset' as SocialChoice,
  pendingInvite: null as string | null,
  seenChallenges: {} as Record<string, string>,
  onboarded: false,
  tipsSeen: [] as string[],
  pickerEquipment: 'Any',
  finishedDays: [] as string[],
  equipment: null as string[] | null,
  trainingPrefs: { styles: [], cardio: [], cardioSplit: false } as TrainingPrefs,
  aboutMe: { sex: null, birthYear: null, heightIn: null } as AboutMe,
  nudgeSnooze: {} as Record<string, number>,
  tourDone: false,
  tourVersion: 0,
  trackRpe: false,
  genPrefs: { warmup: [], rest: 'normal' } as State['genPrefs'],
  // Rest timer after a ticked set: off unless turned on (timers are for timed workouts).
  restSeconds: 0,
  backendKind: null as 'demo' | 'supabase' | null,
})

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...defaults(),
      resetAll: (keepProfile) =>
        set((s) => ({
          ...defaults(),
          theme: s.theme,
          accent: s.accent,
          // Erasing turns cloud backup off, so the cloud copy stays as a safety net rather than being wiped too.
          ...(keepProfile ? { name: s.name, units: s.units, notifPrefs: s.notifPrefs, socialChoice: s.socialChoice, tourDone: s.tourDone, tourVersion: s.tourVersion, onboarded: s.onboarded, tipsSeen: s.tipsSeen, equipment: s.equipment, trainingPrefs: s.trainingPrefs, aboutMe: s.aboutMe, exerciseModes: s.exerciseModes, favorites: s.favorites } : {}),
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
        set((s) => {
          // Done before: as many sets as last time.
          const before = workSets(selectLastLog(s.logs, exerciseId, date)).length
          const sets = kind !== 'strength' ? 1 : before ? Math.min(before, 10) : 3
          return editDay(s, date, (d) => (d.some((p) => p.exerciseId === exerciseId) ? d : [...d, { exerciseId, sets }]))
        }),
      removeExercise: (date, exerciseId) => set((s) => editDay(s, date, (d) => d.filter((p) => p.exerciseId !== exerciseId))),
      setSetCount: (date, exerciseId, sets) =>
        set((s) => editDay(s, date, (d) => d.map((p) => (p.exerciseId === exerciseId ? { ...p, sets } : p)))),
      saveStrength: (date, exerciseId, sets) =>
        set((s) => ({ logs: upsertLog(s.logs, { ...keepNote(s.logs, date, exerciseId), date, exerciseId, sets }) })),
      saveCardio: (date, exerciseId, cardio) =>
        set((s) => ({ logs: upsertLog(s.logs, { ...keepNote(s.logs, date, exerciseId), date, exerciseId, cardio }) })),
      saveTimed: (log, derived) =>
        set((s) => {
          const prev = s.timedLogs.find((t) => t.date === log.date && t.block === log.block)
          let logs = s.logs
          // Drop what the earlier result implied, then add the new one (an empty result clears them). A Hyrox finish
          // time implies nothing: its runs and stations are logged on their own cards.
          if (prev && !prev.hyrox) logs = logs.filter((l) => !(l.date === prev.date && prev.movements.includes(l.exerciseId)))
          for (const d of derived) logs = upsertLog(logs, d)
          const next: TimedLog = { ...log, id: prev?.id ?? `tl-${Date.now().toString(36)}` }
          return { logs, timedLogs: [...s.timedLogs.filter((t) => t.id !== next.id), next] }
        }),
      deleteTimed: (id) =>
        set((s) => {
          const t = s.timedLogs.find((x) => x.id === id)
          if (!t) return s
          return { timedLogs: s.timedLogs.filter((x) => x.id !== id), logs: t.hyrox ? s.logs : s.logs.filter((l) => !(l.date === t.date && t.movements.includes(l.exerciseId))) }
        }),
      setCloud: (p) => set((s) => ({ cloud: { ...s.cloud, ...p } })),
      replaceData: (data) =>
        set((s) => {
          const fixed = repairState({ ...s, ...(data && typeof data === 'object' ? data : {}) }, defaults()) as Record<string, unknown>
          return Object.fromEntries(SYNC_KEYS.map((k) => [k, fixed[k]])) as Partial<State>
        }),
      saveMeasurement: (m) =>
        set((s) => {
          const prev = s.measurements.find((x) => x.date === m.date)
          const next: Measurement = { ...prev, ...m, id: prev?.id ?? `m-${Date.now().toString(36)}` }
          return { measurements: [...s.measurements.filter((x) => x.id !== next.id), next].sort((a, b) => a.date.localeCompare(b.date)) }
        }),
      deleteMeasurement: (id) => set((s) => ({ measurements: s.measurements.filter((m) => m.id !== id) })),
      deleteDay: (date) => set((s) => ({ logs: s.logs.filter((l) => l.date !== date), timedLogs: s.timedLogs.filter((t) => t.date !== date) })),
      deleteLogs: (exerciseId, date) =>
        set((s) => ({ logs: s.logs.filter((l) => !(l.exerciseId === exerciseId && (date === undefined || l.date === date))) })),
      createCustom: (input) => {
        const s = get()
        const fields = customFields(input)
        const back = s.custom.find((e) => e.retired && e.kind === fields.kind && sameName(e.name, fields.name))
        const ex: Exercise = { ...(back ?? { id: newCustomId(s.custom) }), ...fields, custom: true, retired: undefined }
        set({ custom: back ? s.custom.map((e) => (e.id === ex.id ? ex : e)) : [...s.custom, ex], ...trackAs(s, ex.id, ex.mode) })
        return ex
      },
      updateCustom: (id, input) => {
        const s = get()
        const old = s.custom.find((e) => e.id === id)
        const fields = customFields(input)
        // Logged sets and planned items are for one kind of exercise, so it can't turn into the other.
        if (!old || (fields.kind !== old.kind && usageOf(s as unknown as Record<string, unknown>, id).used)) return old
        const ex: Exercise = { ...old, ...fields }
        set({ custom: s.custom.map((e) => (e.id === id ? ex : e)), ...trackAs(s, id, ex.mode) })
        return ex
      },
      removeCustom: (id) =>
        set((s) => {
          const { used } = usageOf(s as unknown as Record<string, unknown>, id)
          const exerciseModes = { ...s.exerciseModes }
          if (!used) delete exerciseModes[id]
          return {
            custom: used ? s.custom.map((e) => (e.id === id ? { ...e, retired: true } : e)) : s.custom.filter((e) => e.id !== id),
            favorites: s.favorites.filter((f) => f !== id),
            exerciseModes,
          }
        }),
      setExerciseMode: (id, mode) =>
        set((s) => ({
          exerciseModes: { ...s.exerciseModes, [id]: mode },
          ...(s.custom.some((e) => e.id === id && e.mode !== mode) ? { custom: s.custom.map((e) => (e.id === id ? { ...e, mode } : e)) } : {}),
          ...(mode === 'reps' ? { logs: zeroToBodyweight(s.logs, id) } : {}),
        })),
      toggleFavorite: (id) => set((s) => ({ favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id] })),
      setUnits: (u) => set((s) => ({ units: { ...s.units, ...u } })),
      setDistanceUnit: (id, unit) => set((s) => ({ units: { ...s.units, byExercise: { ...s.units.byExercise, [id]: unit } } })),
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
          let next: Pick<Data, 'plan' | 'overrides' | 'custom'> = { plan: s.plan, overrides: s.overrides, custom: s.custom }
          for (const date of to) if (date !== from) next = { ...next, ...editDay(next, date, () => items.map((p) => ({ ...p }))) }
          return { plan: next.plan, overrides: next.overrides }
        }),
      applyProgram: (days) => set((s) => ({ overrides: { ...s.overrides, ...days } })),
      setSocialChoice: (socialChoice) => set({ socialChoice }),
      setPendingInvite: (pendingInvite) => set({ pendingInvite }),
      markChallengesSeen: (seen) => set((s) => ({ seenChallenges: { ...s.seenChallenges, ...seen } })),
      setOnboarded: (onboarded) => set({ onboarded }),
      setPickerEquipment: (pickerEquipment) => set({ pickerEquipment }),
      // Once someone says what they have, the exercise picker starts on "My equipment" too.
      setAboutMe: (p) => set((s) => ({ aboutMe: { ...s.aboutMe, ...p } })),
      setTrainingPrefs: (p) => set((s) => ({ trainingPrefs: { ...s.trainingPrefs, ...p } })),
      setEquipment: (equipment) =>
        set((s) => ({ equipment, pickerEquipment: equipment && s.pickerEquipment === 'Any' ? 'Mine' : !equipment && s.pickerEquipment === 'Mine' ? 'Any' : s.pickerEquipment })),
      seeTip: (id) => set((s) => (s.tipsSeen.includes(id) ? s : { tipsSeen: [...s.tipsSeen, id] })),
      finishDay: (date) => set((s) => (s.finishedDays.includes(date) ? s : { finishedDays: [...s.finishedDays, date].slice(-400) })),
      unfinishDay: (date) => set((s) => ({ finishedDays: s.finishedDays.filter((d) => d !== date) })),
      setDayItems: (date, items) => set((s) => editDay(s, date, () => items)),
      clearUsualDay: (date) =>
        set((s) => {
          const day = weekdayIndex(parseISO(date))
          const items = dayPlanOf(s.plan, s.overrides, date).map((p) => ({ ...p }))
          return { plan: s.plan.map((d, i) => (i === day ? [] : d)), overrides: { ...s.overrides, [date]: items } }
        }),
      setUsualDay: (date) =>
        set((s) => {
          const items = dayPlanOf(s.plan, s.overrides, date).map((p) => ({ ...p }))
          const day = weekdayIndex(parseISO(date))
          const { [date]: _gone, ...rest } = s.overrides
          return { plan: s.plan.map((d, i) => (i === day ? items : d)), overrides: rest }
        }),
      snoozeNudge: (id) => set((s) => ({ nudgeSnooze: { ...s.nudgeSnooze, [id]: Date.now() } })),
      setTourDone: (tourDone) => set(tourDone ? { tourDone, tourVersion: TOUR_VERSION } : { tourDone }),
      setPrefs: (p) => set(p),
      setGenPrefs: (p) => set((s) => ({ genPrefs: { ...s.genPrefs, ...p } })),
      saveNote: (date, exerciseId, note) =>
        set((s) => {
          const cur = s.logs.find((l) => l.date === date && l.exerciseId === exerciseId)
          if (!cur && !note) return s
          const next = { ...(cur ?? { date, exerciseId, sets: [] }), note: note || undefined }
          return { logs: upsertLog(s.logs, next) }
        }),
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      addCustomExercises: (list) =>
        set((s) => ({ custom: [...s.custom, ...list.filter((e) => !s.custom.some((c) => c.id === e.id))] })),
      applyDays: (days, replace) =>
        set((s) => {
          const next = { ...s.overrides }
          for (const [date, items] of Object.entries(days)) {
            const existing = dayPlanOf(s.plan, s.overrides, date)
            next[date] = replace ? items.map((p) => ({ ...p })) : appendMissing(existing, items)
          }
          return { overrides: next }
        }),
      applyCardioPlan: (items, replace) =>
        set((s) => {
          const next = { ...s.overrides }
          for (const [date, item] of Object.entries(items)) {
            const existing = dayPlanOf(s.plan, s.overrides, date)
            next[date] = replace ? [item] : [...existing.filter((p) => p.exerciseId !== item.exerciseId), item]
          }
          return { overrides: next }
        }),
      startProgram: (days, title, today) =>
        set((s) => {
          let overrides = s.overrides
          const stopped = new Set<string>()
          for (const p of activePrograms(s.programs, today).filter((x) => x.kind === 'program')) {
            overrides = removeProgramDays(p, overrides, s.logs, today).overrides
            stopped.add(p.id)
          }
          const program: Program = { id: `pr-${Date.now().toString(36)}`, kind: 'program', title, createdAt: new Date().toISOString(), entries: Object.keys(days).map((date) => ({ date })) }
          return { overrides: { ...overrides, ...days }, programs: [...s.programs.filter((p) => !stopped.has(p.id)), program] }
        }),
      startCardioProgram: ({ sessions, sport, title, goalId, replace, stopSame, today }) =>
        set((s) => {
          let overrides = s.overrides
          const stopped = new Set<string>()
          if (stopSame) {
            for (const p of activePrograms(s.programs, today).filter((x) => x.kind === 'cardio' && x.sport === sport)) {
              overrides = removeProgramDays(p, overrides, s.logs, today).overrides
              stopped.add(p.id)
            }
          }
          const items = Object.fromEntries(sessions.map((d) => [d.date, toPlanned(d, sport)!]))
          for (const [date, item] of Object.entries(items)) {
            const existing = dayPlanOf(s.plan, overrides, date)
            overrides = { ...overrides, [date]: replace ? [item] : [...existing.filter((p) => p.exerciseId !== item.exerciseId), item] }
          }
          const exerciseId = sport === 'run' ? 'running' : 'cycling'
          const program: Program = { id: `pr-${Date.now().toString(36)}`, kind: 'cardio', title, sport, goalId, createdAt: new Date().toISOString(), entries: sessions.map((d) => ({ date: d.date, exerciseId })) }
          return { overrides, programs: [...s.programs.filter((p) => !stopped.has(p.id)), program] }
        }),
      stopProgram: (id, today) => {
        const s = get()
        const p = s.programs.find((x) => x.id === id)
        if (!p) return 0
        const r = removeProgramDays(p, s.overrides, s.logs, today)
        set({ overrides: r.overrides, programs: s.programs.filter((x) => x.id !== id) })
        return r.count
      },
      clearPlan: (from, to) => {
        const s = get()
        const r = clearRange(s.overrides, s.logs, from, to)
        set({ overrides: r.overrides })
        return r.count
      },
      setRestDay: (date) => set((s) => ({ overrides: { ...s.overrides, [date]: [] } })),
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
      saveBenchmark: (name, items) =>
        set((s) => ({ benchmarks: [...s.benchmarks, { id: `b-${Date.now().toString(36)}`, name: name.trim(), items: items.map((p) => ({ ...p })) }] })),
      deleteBenchmark: (id) => set((s) => ({ benchmarks: s.benchmarks.filter((b) => b.id !== id) })),
      addBenchmark: (date, id) =>
        set((s) => {
          const b = s.benchmarks.find((x) => x.id === id)
          if (!b) return s
          const block = `bm-${id}`
          return editDay(s, date, (d) => (d.some((p) => p.block === block) ? d : [...d.filter((p) => !b.items.some((x) => x.exerciseId === p.exerciseId)), ...b.items.map((p) => ({ ...p, block }))]))
        }),
      deleteRoutine: (id) => set((s) => ({ routines: s.routines.filter((r) => r.id !== id) })),
      loadRoutine: (date, id) =>
        set((s) => {
          const r = s.routines.find((x) => x.id === id)
          return r ? editDay(s, date, (d) => appendMissing(d, r.items)) : s
        }),
      addGoal: (goal) => {
        const id = `g-${Date.now().toString(36)}`
        set((s) => ({ goals: [...s.goals, { ...goal, id } as Goal] }))
        return id
      },
      deleteGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
      importData: (d) =>
        set(() => {
          const fixed = repairState(d, defaults()) as Record<string, unknown>
          return Object.fromEntries(SYNC_KEYS.map((k) => [k, fixed[k]])) as Partial<State>
        }),
    }),
    {
      name: 'workout-app-v1',
      version: SCHEMA_VERSION,
      // Every load (old versions, damaged data, restored backups) goes through the same repair step.
      migrate: (saved, version) => {
        const fixed = repairState(saved, defaults()) as unknown as State
        // Version 3 dropped workout mode's clock; the rest timer it started after every set is now opt-in.
        if (version < 3) fixed.restSeconds = 0
        return fixed
      },
      merge: (saved, current) => ({ ...current, ...repairState(saved, defaults()) }),
    },
  ),
)

// The workout generators read the person's equipment from here (see lib/equipment.ts).
setOwnedGear(useStore.getState().equipment)
useStore.subscribe((s, prev) => { if (s.equipment !== prev.equipment) setOwnedGear(s.equipment) })
// ...how they track each exercise, where they've said (see lib/exerciseModes.ts)...
setChosenModes(useStore.getState().exerciseModes)
useStore.subscribe((s, prev) => { if (s.exerciseModes !== prev.exerciseModes) setChosenModes(s.exerciseModes) })
// ...their favorite exercises (see lib/favorites.ts)...
setFavorites(useStore.getState().favorites)
useStore.subscribe((s, prev) => { if (s.favorites !== prev.favorites) setFavorites(s.favorites) })
// ...and the cardio they like (see lib/cardioPrefs.ts).
setCardioPrefs(useStore.getState().trainingPrefs.cardio, useStore.getState().trainingPrefs.cardioSplit)
setMovePrefs(useStore.getState().trainingPrefs.moves)
useStore.subscribe((s, prev) => {
  if (s.trainingPrefs === prev.trainingPrefs) return
  setCardioPrefs(s.trainingPrefs.cardio, s.trainingPrefs.cardioSplit)
  setMovePrefs(s.trainingPrefs.moves)
})

/** Resolve an exercise id against the built-in library and the user's custom exercises, tracked the way they chose. */
export function findExercise(custom: Exercise[], id: string): Exercise | undefined {
  const e = BUILTIN_BY_ID.get(id) ?? custom.find((x) => x.id === id)
  return e && withChosenMode(e)
}

/** Most recent log for an exercise strictly before `date` — powers the "last time" hint. */
export const selectLastLog = (logs: ExerciseLog[], exerciseId: string, date: string) =>
  logs
    .filter((l) => l.exerciseId === exerciseId && l.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
