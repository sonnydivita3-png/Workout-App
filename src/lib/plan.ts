/**
 * A training plan, as a file: every dated day with its activities, plus the workouts, targets and notes those days
 * refer to. The format is documented in docs/plan-format.md (also shown in Settings, for Claude to write new plans in).
 */
export type ItemType = 'run' | 'strength' | 'bike' | 'hike' | 'mobility' | 'race' | 'other'
export const ITEM_TYPES: ItemType[] = ['run', 'strength', 'bike', 'hike', 'mobility', 'race', 'other']

export interface PlanItem {
  type: ItemType
  title: string
  miles?: number
  /** Planned time in minutes (a long run's 1:12 is 72). */
  minutes?: number
  /** Extra detail: "+ strides", "6×60 s", "light". */
  detail?: string
  fuel?: string
  /** For strength: the key of a workout in `workouts`. */
  workout?: string
}

export interface PlanDay {
  date: string
  label?: string
  /** A key of `targets`. */
  target?: string
  items: PlanItem[]
}

export interface Target {
  label?: string
  kcal?: number
  protein?: number
  carbs?: number | string
  fat?: number
  note?: string
}

export interface Exercise {
  name: string
  prescription: string
  /** How many sets to log. */
  sets: number
}

export interface WorkoutVersion {
  label: string
  start: string
  end: string
  note?: string
  exercises: Exercise[]
}

export interface Workout {
  name: string
  focus?: string
  notes?: string[]
  versions: WorkoutVersion[]
}

export interface Week {
  number: number
  /** The Monday it starts. */
  start: string
  miles?: number
  long?: string
  goalLb?: number
  down?: boolean
}

export interface Phase {
  name: string
  start: string
  end: string
  summary?: string
}

export interface Note {
  title: string
  start?: string
  end?: string
  bullets: string[]
}

export interface Plan {
  format: 'durata-plan'
  version: 1
  id: string
  name: string
  description?: string
  start: string
  end: string
  race?: { date: string; name: string; detail?: string }
  phases: Phase[]
  weeks: Week[]
  targets: Record<string, Target>
  workouts: Record<string, Workout>
  routine?: { name: string; minutes?: number; when?: string; steps: string[] }
  effort?: { term: string; meaning: string }[]
  notes?: Note[]
  days: PlanDay[]
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const isDate = (v: unknown): v is string => typeof v === 'string' && DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const isStrList = (v: unknown) => Array.isArray(v) && v.every(isStr)

/**
 * Check a plan file. Returns the plan, or the problems found (each with where it is), so a file from Claude that's a
 * little off says exactly what to fix instead of half-loading.
 */
export function checkPlan(raw: unknown): { plan: Plan } | { errors: string[] } {
  const errors: string[] = []
  const err = (at: string, msg: string) => { if (errors.length < 30) errors.push(`${at}: ${msg}`) }
  if (!isObj(raw)) return { errors: ['The file is not a plan (expected a JSON object).'] }
  const p = raw
  if (p.format !== 'durata-plan') err('format', 'must be "durata-plan"')
  if (p.version !== 1) err('version', 'must be 1')
  if (!isStr(p.id)) err('id', 'is missing')
  if (!isStr(p.name)) err('name', 'is missing')
  if (!isDate(p.start)) err('start', 'must be a date like 2026-11-16')
  if (!isDate(p.end)) err('end', 'must be a date like 2027-05-09')
  const targets = isObj(p.targets) ? p.targets : (err('targets', 'must be an object (it can be empty: {})'), {})
  for (const [k, t] of Object.entries(targets)) {
    if (!isObj(t)) { err(`targets.${k}`, 'must be an object'); continue }
    for (const f of ['kcal', 'protein', 'fat'] as const) if (t[f] != null && !isNum(t[f])) err(`targets.${k}.${f}`, 'must be a number')
    if (t.carbs != null && !isNum(t.carbs) && !isStr(t.carbs)) err(`targets.${k}.carbs`, 'must be a number or text like "720–810"')
  }
  const workouts = isObj(p.workouts) ? p.workouts : (err('workouts', 'must be an object (it can be empty: {})'), {})
  for (const [k, w] of Object.entries(workouts)) {
    const at = `workouts.${k}`
    if (!isObj(w)) { err(at, 'must be an object'); continue }
    if (!isStr(w.name)) err(`${at}.name`, 'is missing')
    if (w.notes != null && !isStrList(w.notes)) err(`${at}.notes`, 'must be a list of text')
    if (!Array.isArray(w.versions) || !w.versions.length) { err(`${at}.versions`, 'needs at least one version'); continue }
    w.versions.forEach((v, i) => {
      const vat = `${at}.versions[${i}]`
      if (!isObj(v)) return err(vat, 'must be an object')
      if (!isStr(v.label)) err(`${vat}.label`, 'is missing')
      if (!isDate(v.start) || !isDate(v.end)) err(vat, 'needs start and end dates')
      if (!Array.isArray(v.exercises) || !v.exercises.length) return err(`${vat}.exercises`, 'needs at least one exercise')
      v.exercises.forEach((e, j) => {
        if (!isObj(e) || !isStr(e.name) || !isStr(e.prescription)) err(`${vat}.exercises[${j}]`, 'needs a name and a prescription')
        else if (!Number.isInteger(e.sets) || (e.sets as number) < 1 || (e.sets as number) > 20) err(`${vat}.exercises[${j}].sets`, 'must be a whole number from 1 to 20')
      })
    })
  }
  if (!Array.isArray(p.phases)) err('phases', 'must be a list (it can be empty)')
  else p.phases.forEach((ph, i) => { if (!isObj(ph) || !isStr(ph.name) || !isDate(ph.start) || !isDate(ph.end)) err(`phases[${i}]`, 'needs a name, start and end') })
  if (!Array.isArray(p.weeks)) err('weeks', 'must be a list (it can be empty)')
  else p.weeks.forEach((w, i) => {
    if (!isObj(w) || !Number.isInteger(w.number) || !isDate(w.start)) return err(`weeks[${i}]`, 'needs a number and a start date')
    for (const f of ['miles', 'goalLb'] as const) if (w[f] != null && !isNum(w[f])) err(`weeks[${i}].${f}`, 'must be a number')
  })
  if (p.notes != null) {
    if (!Array.isArray(p.notes)) err('notes', 'must be a list')
    else p.notes.forEach((n, i) => { if (!isObj(n) || !isStr(n.title) || !isStrList(n.bullets)) err(`notes[${i}]`, 'needs a title and a list of bullets') })
  }
  if (p.routine != null && (!isObj(p.routine) || !isStr(p.routine.name) || !isStrList(p.routine.steps))) err('routine', 'needs a name and a list of steps')
  if (p.effort != null && (!Array.isArray(p.effort) || !p.effort.every((e) => isObj(e) && isStr(e.term) && isStr(e.meaning)))) err('effort', 'must be a list of { term, meaning }')
  if (!Array.isArray(p.days) || !p.days.length) err('days', 'needs at least one day')
  else {
    const seen = new Set<string>()
    p.days.forEach((d, i) => {
      const at = `days[${i}]`
      if (!isObj(d) || !isDate(d.date)) return err(at, 'needs a date like 2026-11-16')
      const dat = `day ${d.date}`
      if (seen.has(d.date)) err(dat, 'is listed twice')
      seen.add(d.date)
      if (d.target != null && !(isStr(d.target) && d.target in targets)) err(`${dat}.target`, `"${String(d.target)}" isn't in targets`)
      if (!Array.isArray(d.items)) return err(`${dat}.items`, 'must be a list (empty for a rest day)')
      d.items.forEach((it, j) => {
        const iat = `${dat}.items[${j}]`
        if (!isObj(it)) return err(iat, 'must be an object')
        if (!ITEM_TYPES.includes(it.type as ItemType)) err(`${iat}.type`, `must be one of ${ITEM_TYPES.join(', ')}`)
        if (!isStr(it.title)) err(`${iat}.title`, 'is missing')
        for (const f of ['miles', 'minutes'] as const) if (it[f] != null && !isNum(it[f])) err(`${iat}.${f}`, 'must be a number')
        if (it.workout != null && !(isStr(it.workout) && it.workout in workouts)) err(`${iat}.workout`, `"${String(it.workout)}" isn't in workouts`)
      })
    })
  }
  if (errors.length) return { errors }
  const plan = raw as unknown as Plan
  return { plan: { ...plan, days: [...plan.days].sort((a, b) => a.date.localeCompare(b.date)) } }
}

const inRange = (date: string, start?: string, end?: string) => (!start || date >= start) && (!end || date <= end)

export const dayOf = (plan: Plan, date: string): PlanDay | undefined => plan.days.find((d) => d.date === date)
export const phaseOf = (plan: Plan, date: string) => plan.phases.find((p) => inRange(date, p.start, p.end))
export const weekOf = (plan: Plan, date: string) => [...plan.weeks].reverse().find((w) => w.start <= date && date <= addDaysIso(w.start, 6))
export const targetOf = (plan: Plan, day?: PlanDay): Target | undefined => (day?.target ? plan.targets[day.target] : undefined)
/** The version of a workout that applies on a date (the last one started, when none covers it). */
export function workoutOn(plan: Plan, key: string, date: string): { workout: Workout; version: WorkoutVersion } | undefined {
  const workout = plan.workouts[key]
  if (!workout) return undefined
  const version = workout.versions.find((v) => inRange(date, v.start, v.end)) ?? [...workout.versions].reverse().find((v) => v.start <= date) ?? workout.versions[0]
  return { workout, version }
}
/** Notes that apply on a date: the whole-plan ones, and those whose dates cover it. */
export const notesOn = (plan: Plan, date: string) => (plan.notes ?? []).filter((n) => inRange(date, n.start, n.end))

export function addDaysIso(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
