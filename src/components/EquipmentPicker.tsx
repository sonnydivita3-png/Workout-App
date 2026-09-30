import { GEAR, GEAR_LABELS, GEAR_PRESETS, sameGear as same, type Gear } from '../lib/equipment'
import { useStore } from '../store'

/** What equipment someone has: a quick preset, or pick each kind. Bodyweight moves are always included. */
export function EquipmentPicker({ detailed = true }: { detailed?: boolean }) {
  const gear = useStore((s) => s.equipment)
  const setEquipment = useStore((s) => s.setEquipment)
  const has = (g: Gear) => !gear || gear.includes(g)
  const toggle = (g: Gear) => {
    const cur = gear ?? [...GEAR]
    const next = cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]
    setEquipment(next.length === GEAR.length ? null : next)
  }
  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Where you train">
        {GEAR_PRESETS.map((p) => {
          const on = same(p.gear, gear)
          return (
            <button key={p.id} role="radio" aria-checked={on} onClick={() => setEquipment(p.gear)} className={`rounded-2xl px-3 py-3 text-sm font-medium ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-700'}`}>
              {p.label}
            </button>
          )
        })}
      </div>
      {detailed && (
        <>
          <p className="mb-2 text-sm text-neutral-500">Or pick exactly what you have. Bodyweight moves are always included.</p>
          <ul className="divide-y divide-neutral-100 rounded-2xl bg-surface ring-1 ring-neutral-200/70">
            {GEAR.map((g) => (
              <li key={g}>
                <label className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span>{GEAR_LABELS[g]}</span>
                  <input type="checkbox" checked={has(g)} onChange={() => toggle(g)} className="h-5 w-5 accent-[var(--color-accent)]" />
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
