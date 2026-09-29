import { useEffect, useState } from 'react'
import { toISO } from './dates'

/** Today's date as YYYY-MM-DD, refreshed when the app returns to the foreground. */
export function useToday() {
  const [today, setToday] = useState(() => toISO(new Date()))
  useEffect(() => {
    const h = () => setToday(toISO(new Date()))
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [])
  return today
}
