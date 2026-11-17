import type { ItemType, PlanItem, Target } from './plan'
import { formatDuration } from './progress'

/** The colour of an activity, as on the printed calendar. */
export const typeColor = (t: ItemType) => (t === 'run' || t === 'race' ? 'text-run' : t === 'strength' ? 'text-strength' : 'text-neutral-700')
export const typeDot = (t: ItemType) => (t === 'run' || t === 'race' ? 'bg-run' : t === 'strength' ? 'bg-strength' : 'bg-neutral-400')

/** "Easy run 4 mi + strides", "Long run 5 mi · 1:00", "Strength A · 55 min", "Hike · 90 min". */
export function itemLabel(it: PlanItem): string {
  const head = [it.title, it.miles != null ? `${it.miles} mi` : '', it.detail && !it.detail.startsWith('+') ? `· ${it.detail}` : '', it.detail?.startsWith('+') ? it.detail : '']
    .filter(Boolean).join(' ')
  const time = it.minutes != null ? (it.miles != null ? formatDuration(it.minutes) : `${it.minutes} min`) : ''
  return time ? `${head} · ${time}` : head
}

/** "2,700 kcal · P200 C295 F80" */
export function targetLine(t: Target): string {
  const macros = [t.protein != null ? `P${t.protein}` : '', t.carbs != null ? `C${t.carbs}` : '', t.fat != null ? `F${t.fat}` : ''].filter(Boolean).join(' ')
  return [t.kcal != null ? `${t.kcal.toLocaleString()} kcal` : '', macros, t.note ?? ''].filter(Boolean).join(' · ')
}
