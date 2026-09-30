import { useRef, useState } from 'react'
import { canCombine, combine, moveInGroup, moveUnit, removeFromGroup, ungroup, unitsOf } from '../lib/arrange'
import { dayPlanOf } from '../lib/plan'
import { findExercise, useStore } from '../store'
import { Sheet } from './Sheet'

const arrow = 'flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 disabled:opacity-25'

/**
 * Reorder a day's exercises (drag the handle or use the arrows) and combine any of them into supersets. Changes
 * apply as you go, so the plan and an open workout update straight away.
 */
export function ArrangeSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const s = useStore()
  const items = dayPlanOf(s.plan, s.overrides, date)
  const units = unitsOf(items)
  const [picked, setPicked] = useState<number[]>([])
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null)
  const rows = useRef<(HTMLLIElement | null)[]>([])
  const name = (id: string) => findExercise(s.custom, id)?.name ?? 'Exercise'
  const apply = (next: typeof items) => { s.setDayItems(date, next); setPicked([]) }
  const toggle = (u: number) => setPicked((p) => (p.includes(u) ? p.filter((x) => x !== u) : [...p, u]))

  // Drag by the handle: find the row under the finger and move the unit there on release.
  const overIndex = (y: number) => {
    const i = rows.current.findIndex((el) => el && y < el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2)
    return i === -1 ? units.length - 1 : i
  }
  const endDrag = () => {
    if (drag && drag.over !== drag.from) {
      let next = items
      const dir = drag.over > drag.from ? 1 : -1
      for (let u = drag.from; u !== drag.over; u += dir) next = moveUnit(next, u, dir)
      apply(next)
    }
    setDrag(null)
  }

  return (
    <Sheet title="Reorder & superset" onClose={onClose} closeLabel="Done">
      <p className="mb-3 text-sm text-neutral-500">Drag ≡ or use the arrows to change the order. Tick two or more and tap <b className="font-medium">Superset</b> to do them back to back.</p>
      <ul className="space-y-2 pb-24" onPointerMove={(e) => drag && setDrag({ ...drag, over: overIndex(e.clientY) })} onPointerUp={endDrag} onPointerCancel={() => setDrag(null)}>
        {units.map((u, ui) => {
          const group = !!u.block && u.items.length > 1
          const combinable = canCombine(u)
          const label = group ? u.label ?? 'Group' : name(u.items[0].item.exerciseId)
          const moving = drag?.from === ui
          const target = drag && drag.over === ui && drag.from !== ui
          return (
            <li key={`${u.block ?? u.items[0].item.exerciseId}-${ui}`} ref={(el) => { rows.current[ui] = el }}
              className={`rounded-2xl bg-surface p-2 ring-1 ${target ? 'ring-accent' : 'ring-neutral-200/70'} ${moving ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2">
                <button
                  aria-label={`Drag ${label}`}
                  onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); setDrag({ from: ui, over: ui }) }}
                  className="flex h-9 w-7 shrink-0 cursor-grab touch-none items-center justify-center text-lg text-neutral-400"
                >≡</button>
                <label className="flex min-w-0 flex-1 items-center gap-2">
                  <input type="checkbox" disabled={!combinable} checked={picked.includes(ui)} onChange={() => toggle(ui)} aria-label={`Select ${label}`} className="h-5 w-5 shrink-0 accent-[var(--color-accent)] disabled:opacity-30" />
                  <span className={`min-w-0 line-clamp-2 ${group ? 'text-sm font-semibold' : ''}`}>{label}</span>
                </label>
                <button disabled={ui === 0} onClick={() => apply(moveUnit(items, ui, -1))} aria-label={`Move ${label} up`} className={arrow}>↑</button>
                <button disabled={ui === units.length - 1} onClick={() => apply(moveUnit(items, ui, 1))} aria-label={`Move ${label} down`} className={arrow}>↓</button>
              </div>
              {group && (
                <>
                  <ul className="mt-2 space-y-1 border-l-2 border-accent/50 pl-3">
                    {u.items.map((m, mi) => {
                      const n = name(m.item.exerciseId)
                      return (
                        <li key={m.item.exerciseId} className="flex items-center gap-2 text-sm">
                          <span className="w-5 shrink-0 text-neutral-400">{String.fromCharCode(65 + mi)}</span>
                          <span className="min-w-0 flex-1 line-clamp-2">{n}</span>
                          {combinable && <button onClick={() => apply(removeFromGroup(items, ui, mi))} aria-label={`Take ${n} out of the superset`} className="rounded-full px-2 py-1 text-xs text-neutral-500 ring-1 ring-neutral-200">Take out</button>}
                          <button disabled={mi === 0} onClick={() => apply(moveInGroup(items, ui, mi, -1))} aria-label={`Move ${n} up in the group`} className={arrow}>↑</button>
                          <button disabled={mi === u.items.length - 1} onClick={() => apply(moveInGroup(items, ui, mi, 1))} aria-label={`Move ${n} down in the group`} className={arrow}>↓</button>
                        </li>
                      )
                    })}
                  </ul>
                  {combinable && <button onClick={() => apply(ungroup(items, ui))} className="mt-2 text-sm text-neutral-500 underline underline-offset-2">Split into single exercises</button>}
                </>
              )}
            </li>
          )
        })}
      </ul>
      <div className="sticky bottom-0 -mx-4 border-t border-neutral-200 bg-surface px-4 pt-3">
        <button disabled={picked.length < 2} onClick={() => apply(combine(items, picked))} className="w-full rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent disabled:opacity-30">
          {picked.length < 2 ? 'Tick 2 or more to superset' : `Superset the ${picked.length} ticked`}
        </button>
      </div>
    </Sheet>
  )
}
