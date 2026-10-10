import { useState } from 'react'
import { BODY_PARTS } from '../lib/bodyParts'
import { findExercise, useStore } from '../store'
import { ExercisePicker } from './ExercisePicker'

const PARTS: string[] = [...BODY_PARTS, 'Forearms']

/** Favorite exercises by body part: listed first when adding exercises, and picked more often in generated workouts. */
export function FavoritesPicker() {
  const favorites = useStore((s) => s.favorites)
  const custom = useStore((s) => s.custom)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const [part, setPart] = useState<string | null>(null)
  const byPart = new Map<string, { id: string; name: string }[]>()
  for (const id of favorites) {
    const e = findExercise(custom, id)
    if (!e) continue
    const g = PARTS.includes(e.group) ? e.group : 'Other'
    byPart.set(g, [...(byPart.get(g) ?? []), { id, name: e.name }])
  }
  const rows = [...PARTS, ...(byPart.has('Other') ? ['Other'] : [])]
  return (
    <>
      <ul className="divide-y divide-neutral-100 rounded-2xl bg-surface ring-1 ring-neutral-200/70" aria-label="Favorite exercises">
        {rows.map((g) => (
          <li key={g} className="flex items-start justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <span className="block text-sm font-medium">{g}</span>
              {byPart.get(g)?.length ? (
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {byPart.get(g)!.map((f) => (
                    <button key={f.id} onClick={() => toggleFavorite(f.id)} aria-label={`Remove ${f.name} from favorites`} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-700">
                      <span className="text-amber-700">★</span> {f.name} <span aria-hidden className="text-neutral-400">✕</span>
                    </button>
                  ))}
                </span>
              ) : (
                <span className="block text-xs text-neutral-400">None yet</span>
              )}
            </div>
            {g !== 'Other' && (
              <button onClick={() => setPart(g)} aria-label={`Add favorite ${g.toLowerCase()} exercises`} className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700">+ Add</button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-neutral-400">Favorites come first when you add exercises, and turn up in about 3 of 4 workouts made for you that train that body part. Star any exercise (☆) in the list to add it.</p>
      {part && (
        <ExercisePicker
          title={`Favorite ${part.toLowerCase()} exercises`}
          initialGroup={part}
          taken={new Set()}
          onPick={(e) => { if (e.kind === 'strength') toggleFavorite(e.id) }}
          onClose={() => setPart(null)}
        />
      )}
    </>
  )
}
