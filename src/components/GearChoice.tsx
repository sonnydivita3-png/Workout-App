import { useState } from 'react'
import { equipmentSummary, GEAR_PRESETS, sameGear } from '../lib/equipment'
import { useStore } from '../store'

const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`

/**
 * Equipment for one generated workout or plan: one line with your usual setup, and Change for somewhere else (a hotel
 * gym, a dumbbells-only day). A different choice applies here only, with a one-tap way to make it the default.
 */
export function GearChoice({ value, onChange }: { value: string[] | null; onChange: (g: string[] | null) => void }) {
  const saved = useStore((s) => s.equipment)
  const setEquipment = useStore((s) => s.setEquipment)
  const [open, setOpen] = useState(false)
  const preset = GEAR_PRESETS.find((p) => sameGear(p.gear, value))
  const differs = !sameGear(value, saved)
  if (!open) {
    return (
      <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl bg-neutral-50 px-4 py-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium">Equipment</span>
          <span className="block truncate text-xs text-neutral-500">{value === null ? 'Full gym' : equipmentSummary(value)}{differs ? ' · just for this workout' : ''}</span>
        </span>
        <button onClick={() => setOpen(true)} className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700">Change</button>
      </div>
    )
  }
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-sm font-medium">Where are you training?</h3>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Equipment">
        {GEAR_PRESETS.map((p) => (
          <button key={p.id} role="radio" aria-checked={preset?.id === p.id} onClick={() => onChange(p.gear)} className={chip(preset?.id === p.id)}>{p.label}</button>
        ))}
        {!preset && value && <span className={chip(true)}>My equipment ({value.length} kind{value.length === 1 ? '' : 's'})</span>}
      </div>
      {differs ? (
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
