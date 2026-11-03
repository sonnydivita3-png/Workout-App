import type { CardioEntry, CardioRun } from '../types'

/** The separate sessions in a cardio log (two runs on one day), or the log itself when it's one. */
export const runsOf = (c?: CardioEntry | null): CardioRun[] => (!c ? [] : c.parts && c.parts.length > 1 ? c.parts : [c])

const sum = (runs: CardioRun[], key: 'distance' | 'minutes' | 'calories') =>
  runs.some((r) => r[key] != null) ? Math.round(runs.reduce((a, r) => a + (r[key] ?? 0), 0) * 1e6) / 1e6 : null

/**
 * A log made of these runs: their totals on top (what history, charts and weekly totals read), each run kept in
 * `parts`. One run is a plain log again. A calorie total only when every run has its own number (else each run's
 * estimate fills in; see caloriesOf).
 */
export function withRuns(c: CardioEntry, runs: CardioRun[]): CardioEntry {
  const { parts: _parts, ...rest } = c
  void _parts
  if (runs.length <= 1) {
    const r = runs[0] ?? { distance: null, minutes: null }
    const one: CardioEntry = { ...rest, distance: r.distance ?? null, minutes: r.minutes ?? null }
    if (r.calories !== undefined) one.calories = r.calories; else delete one.calories
    if (r.incline !== undefined) one.incline = r.incline; else delete one.incline
    return one
  }
  const own = runs.every((r) => r.calories != null && r.calories > 0)
  const { calories: _c, incline: _i, ...base } = rest
  void _c; void _i
  return {
    ...base,
    distance: sum(runs, 'distance'),
    minutes: sum(runs, 'minutes'),
    ...(own ? { calories: sum(runs, 'calories') } : {}),
    parts: runs.map((r) => ({ distance: r.distance ?? null, minutes: r.minutes ?? null, ...(r.calories != null ? { calories: r.calories } : {}), ...(r.incline != null ? { incline: r.incline } : {}) })),
  }
}
