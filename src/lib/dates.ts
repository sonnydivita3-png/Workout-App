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

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export const parseISO = (iso: string) => new Date(iso + 'T00:00:00')

export const mondayOf = (d: Date) => addDays(d, -weekdayIndex(d))

export const fmtShort = (iso: string) =>
  parseISO(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export const fmtLong = (iso: string) =>
  parseISO(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
