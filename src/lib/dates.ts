export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Monday-based weekday index (0-6). */
export const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7

export function weekDates(anchor: Date): Date[] {
  const monday = new Date(anchor)
  monday.setDate(anchor.getDate() - weekdayIndex(anchor))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}
