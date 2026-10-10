import type { Exercise } from '../types'

// The person's favorite exercises, set from the profile (store.ts) like their equipment, so every generator can read it.
let favs = new Set<string>()

export function setFavorites(ids: string[] | undefined) {
  favs = new Set(Array.isArray(ids) ? ids : [])
}

export const isFavorite = (e: Exercise | string) => favs.has(typeof e === 'string' ? e : e.id)
export const hasFavorites = () => favs.size > 0
export const favoriteIds = (): ReadonlySet<string> => favs
