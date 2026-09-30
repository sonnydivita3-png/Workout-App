import { GEAR_PRESETS, sameGear } from '../lib/equipment'
import { useStore } from '../store'

const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`

/**
 * Equipment for one generated workout or plan. Starts from the profile setting; a different choice applies here
 * only, with a one-tap way to make it the default.
 */
export function GearChoice({ value, onChange }: { value: string[] | null; onChange: (g: string[] | null) => void }) {
  const saved = useStore((s) => s.equipment)
  const setEquipment = useStore((s) => s.setEquipment)
  const preset = GEAR_PRESETS.find((p) => sameGear(p.gear, value))
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-sm font-medium">Where are you training?</h3>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Equipment">
        {GEAR_PRESETS.map((p) => (
          <button key={p.id} role="radio" aria-checked={preset?.id === p.id} onClick={() => onChange(p.gear)} className={chip(preset?.id === p.id)}>{p.label}</button>
        ))}
        {!preset && value && <span className={chip(true)}>My equipment ({value.length} kind{value.length === 1 ? '' : 's'})</span>}
        {!preset && !value && <span className={chip(true)}>Full gym</span>}
      </div>
      {!sameGear(value, saved) ? (
        <p className="mt-2 text-xs text-neutral-400">
          Just for this workout.{' '}
          <button onClick={() => setEquipment(value)} className="underline underline-offset-2">Make it my default</button>
          {' · '}
          <button onClick={() => onChange(saved)} className="underline underline-offset-2">Use my usual</button>
        </p>
      ) : (
        <p className="mt-2 text-xs text-neutral-400">Only exercises you can do with this are picked. Your default is in Settings → Profile, units &amp; equipment.</p>
      )}
    </div>
  )
}
