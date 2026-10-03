import { PERMISSIONS, type PermKey, type Perms } from '../../social/types'

/** What a person can allow each friend. Everything starts off. */
export function PermissionToggles({ value, onChange }: { value: Perms; onChange: (key: PermKey, on: boolean) => void }) {
  return (
    <ul className="divide-y divide-neutral-100">
      {PERMISSIONS.map((p) => (
        <li key={p.key} className="flex items-start justify-between gap-3 py-3">
          <span className="min-w-0">
            <span className="block text-sm font-medium">{p.label}</span>
            <span className="block text-xs text-neutral-400">{p.hint}</span>
          </span>
          <button
            role="switch"
            aria-checked={value[p.key]}
            aria-label={p.label}
            onClick={() => onChange(p.key, !value[p.key])}
            className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${value[p.key] ? 'bg-accent' : 'bg-neutral-200'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value[p.key] ? 'left-[1.375rem]' : 'left-0.5'}`} />
          </button>
        </li>
      ))}
    </ul>
  )
}
