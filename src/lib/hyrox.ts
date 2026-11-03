import type { PlannedExercise } from '../types'

const RUNS = new Set(['running', 'Running_Treadmill', 'Jogging_Treadmill'])

/** A Hyrox-style block (on its own, or as one part of a mixed workout). */
export const isHyroxBlock = (block?: string) => !!block && /(^|-)hyrox$/.test(block)

/**
 * A Hyrox-style block as its route: the run (one card for all of them, its note "600 m run before each of the 8
 * stations") and the stations in order, a run before each, once through.
 */
export function hyroxRoute<T extends { item: PlannedExercise }>(entries: T[]): { run?: T; runM: number | null; stations: T[] } {
  // The run card says so in its note; older or hand-made blocks just start with the run.
  const run = entries.find((e) => /run before each/i.test(e.item.note ?? '')) ?? entries.find((e, i) => i === 0 && RUNS.has(e.item.exerciseId))
  const m = /(\d[\d,]*)\s*m run/i.exec(run?.item.note ?? run?.item.blockLabel ?? '')
  return { run, runM: m ? Number(m[1].replace(/,/g, '')) : null, stations: entries.filter((e) => e !== run) }
}
