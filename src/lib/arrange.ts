import type { PlannedExercise } from '../types'
import { groupByBlock } from './describe'

/**
 * Rearranging a day: its exercises form "units" (a single exercise, or a group sharing a block such as a superset,
 * circuit, timed block or warm-up). Units move as a whole; exercises inside a group can be reordered, and any
 * number of units can be combined into one superset.
 */
export type Unit = ReturnType<typeof groupByBlock>[number]

export const unitsOf = (items: PlannedExercise[]): Unit[] => groupByBlock(items)
const flatten = (units: Unit[]) => units.flatMap((u) => u.items.map((x) => x.item))

/** Warm-ups and timed blocks have their own format, so they can move but not be combined. */
export const canCombine = (u: Unit) => !u.items.some((x) => x.item.warmup || x.item.wod)

export const supersetLabel = (n: number) => (n <= 2 ? 'Superset' : `Superset · ${n} exercises (giant set)`)
const isSuperset = (u: Unit) => !!u.block && canCombine(u) && (/^ss/.test(u.block) || /^Superset/.test(u.label ?? ''))

/** Give a superset the right name for its size (other groups, like circuits, keep theirs). */
const relabel = (u: Unit): Unit =>
  isSuperset(u) ? { ...u, label: supersetLabel(u.items.length), items: u.items.map((x) => ({ ...x, item: { ...x.item, blockLabel: supersetLabel(u.items.length) } })) } : u

const single = (item: PlannedExercise): PlannedExercise => {
  const { block: _b, blockLabel: _l, est: _e, ...rest } = item
  void _b; void _l; void _e
  return rest
}

export function moveUnit(items: PlannedExercise[], u: number, dir: -1 | 1): PlannedExercise[] {
  const units = unitsOf(items)
  const to = u + dir
  if (to < 0 || to >= units.length) return items
  ;[units[u], units[to]] = [units[to], units[u]]
  return flatten(units)
}

export function moveInGroup(items: PlannedExercise[], u: number, m: number, dir: -1 | 1): PlannedExercise[] {
  const units = unitsOf(items)
  const members = [...units[u].items]
  const to = m + dir
  if (to < 0 || to >= members.length) return items
  ;[members[m], members[to]] = [members[to], members[m]]
  units[u] = { ...units[u], items: members }
  return flatten(units)
}

/** Combine units (single exercises or existing groups) into one superset, placed where the first of them was. */
export function combine(items: PlannedExercise[], selected: number[]): PlannedExercise[] {
  const units = unitsOf(items)
  const picked = [...new Set(selected)].sort((a, b) => a - b).filter((i) => units[i] && canCombine(units[i]))
  const members = picked.flatMap((i) => units[i].items.map((x) => x.item))
  if (picked.length < 2 || members.length < 2) return items
  const used = new Set(items.map((p) => p.block).filter(Boolean))
  let n = 1
  while (used.has(`ss${n}`)) n++
  const label = supersetLabel(members.length)
  // est was worked out for the old grouping; the time model recalculates without it.
  const merged = members.map((p) => ({ ...single(p), block: `ss${n}`, blockLabel: label }))
  const out: PlannedExercise[] = []
  units.forEach((unit, i) => {
    if (i === picked[0]) out.push(...merged)
    else if (!picked.includes(i)) out.push(...unit.items.map((x) => x.item))
  })
  return out
}

/** Split a group back into single exercises, in the same order. */
export function ungroup(items: PlannedExercise[], u: number): PlannedExercise[] {
  const units = unitsOf(items)
  if (!units[u]?.block || !canCombine(units[u])) return items
  return units.flatMap((unit, i) => unit.items.map((x) => (i === u ? single(x.item) : x.item)))
}

/** Take one exercise out of a group; it goes right after the group. A group left with one exercise dissolves. */
export function removeFromGroup(items: PlannedExercise[], u: number, m: number): PlannedExercise[] {
  const units = unitsOf(items)
  const unit = units[u]
  if (!unit?.block || !canCombine(unit)) return items
  const out = unit.items.filter((_, j) => j !== m)
  const rest: Unit = relabel({ ...unit, items: out })
  const pulled = single(unit.items[m].item)
  return units.flatMap((x, i) => {
    if (i !== u) return x.items.map((y) => y.item)
    const kept = rest.items.length === 1 ? [single(rest.items[0].item)] : rest.items.map((y) => y.item)
    return [...kept, pulled]
  })
}
