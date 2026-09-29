interface Props {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  step?: number
}

export function NumberInput({ value, onChange, placeholder, step = 1 }: Props) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      min={0}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className="w-full rounded-lg bg-neutral-100 px-2 py-2 text-center tabular-nums outline-none placeholder:text-neutral-300 focus:bg-neutral-200/70"
    />
  )
}
