export type GeneratorMode = 'one' | 'program' | 'cardio'

/** The randomizer's two modes; run/bike plans have their own button and sheet. */

export function ModeSwitch({ mode, onChange }: { mode: GeneratorMode; onChange: (m: GeneratorMode) => void }) {
  const opts: [GeneratorMode, string][] = [['one', 'One workout'], ['program', 'Week / month']]
  return (
    <div className="mb-4 flex rounded-full bg-neutral-100 p-0.5 text-sm">
      {opts.map(([id, label]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 rounded-full py-1.5 text-[13px] ${id === mode ? 'bg-surface font-medium shadow-sm' : 'text-neutral-500'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
