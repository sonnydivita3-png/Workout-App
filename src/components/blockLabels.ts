const isSuperset = (l?: string): l is string => !!l && /^Superset\b/.test(l)

/**
 * Block headings as shown on a day or in a list: once there's more than one superset, they're numbered in the order
 * they come ("Superset 1", "Superset 2"), whatever number each was made with. A workout is made with its supersets
 * numbered from 1, so two workouts on one day would otherwise both say "Superset 1". Display only: the saved labels
 * (and what's worked out from them, like a circuit's timing) stay as they are.
 */
export function shownLabels(labels: (string | undefined)[]): (string | undefined)[] {
  if (labels.filter(isSuperset).length < 2) return labels
  let n = 0
  return labels.map((l) => (isSuperset(l) ? l.replace(/^Superset(?: \d+)?/, () => `Superset ${++n}`) : l))
}
