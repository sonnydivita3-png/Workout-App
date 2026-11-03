interface Props {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  step?: number
  /** Show − and + buttons (by `step`), for quick changes mid-workout without the keyboard. */
  stepper?: boolean
  label?: string
  /** A logged value (a set that's done): the box takes a tint of the accent and the number goes bold. */
  done?: boolean
}

/** A number box: 44 px tall (a thumb-sized target), the number centred, a dash when empty. */
export function NumberInput({ value, onChange, placeholder, step = 1, stepper, label, done }: Props) {
  const input = (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      min={0}
      value={value ?? ''}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className={`h-11 w-full min-w-0 rounded-xl px-1 text-center text-base tabular-nums outline-none transition-colors placeholder:text-neutral-400 ${done ? 'bg-accent/15 font-semibold text-neutral-900 focus:bg-accent/25' : 'bg-neutral-100 focus:bg-neutral-200/70'}`}
    />
  )
  if (!stepper) return input
  // Stepping from an empty box starts at the suggestion shown as the placeholder.
  const base = value ?? (placeholder && !Number.isNaN(Number(placeholder)) ? Number(placeholder) : 0)
  const bump = (d: number) => onChange(Math.max(0, Math.round((base + d) * 100) / 100))
  const btn = 'h-11 w-8 shrink-0 rounded-xl text-lg leading-none text-neutral-500 active:bg-neutral-200'
  return (
    <div className="flex items-center gap-0.5">
      <button type="button" onClick={() => bump(-step)} aria-label={`Less${label ? ` ${label}` : ''}`} className={btn}>−</button>
      {input}
      <button type="button" onClick={() => bump(step)} aria-label={`More${label ? ` ${label}` : ''}`} className={btn}>+</button>
    </div>
  )
}
