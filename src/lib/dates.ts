import { useEffect, useState } from 'react'

/** Today on this phone's clock, as 2026-11-17. */
export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Today, kept current past midnight and when the app is reopened. */
export function useToday(): string {
  const [today, setToday] = useState(todayIso)
  useEffect(() => {
    const tick = () => setToday(todayIso())
    const id = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [])
  return today
}

const at = (iso: string) => new Date(`${iso}T12:00:00`)
/** "Tue, Nov 17" */
export const longDate = (iso: string) => at(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
/** "Nov 17" */
export const shortDate = (iso: string) => at(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
/** "November 2026" */
export const monthName = (iso: string) => at(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
export const dayNum = (iso: string) => Number(iso.slice(8, 10))
/** Whole days from a to b. */
export const daysBetween = (a: string, b: string) => Math.round((at(b).getTime() - at(a).getTime()) / 86_400_000)
