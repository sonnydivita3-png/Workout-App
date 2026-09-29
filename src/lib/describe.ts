import type { Exercise, PlannedExercise } from '../types'

/** One-line target for a planned exercise, e.g. "3 × 12", "3 × 45s", "20 min", "4 rounds · 40s on / 20s off". */
export function describeItem(p: PlannedExercise, ex: Exercise): string {
  const parts: string[] = []
  if (ex.kind === 'cardio') {
    if (p.minutes) parts.push(`${p.minutes} min`)
  } else if (p.seconds) parts.push(`${p.sets} × ${p.seconds}s`)
  else if (p.reps) parts.push(`${p.sets} × ${p.reps}`)
  else if (p.sets > 1) parts.push(`${p.sets} ${p.block ? 'rounds' : 'sets'}`)
  if (p.note) parts.push(p.note)
  return parts.join(' · ')
}

/** Consecutive items that share a `block`, so structured workouts can show a header per block. */
export function groupByBlock(items: PlannedExercise[]): { block?: string; label?: string; items: { item: PlannedExercise; index: number }[] }[] {
  const out: ReturnType<typeof groupByBlock> = []
  items.forEach((item, index) => {
    const last = out.at(-1)
    if (item.block && last && last.block === item.block) last.items.push({ item, index })
    else out.push({ block: item.block, label: item.blockLabel, items: [{ item, index }] })
  })
  return out
}
