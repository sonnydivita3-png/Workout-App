import { useEffect, useState } from 'react'
import { findExercise, useStore } from '../store'
import { useToasts } from '../toastStore'
import type { AppNotification } from '../types'
import { computeNotifications, msUntilReminder } from './notify'
import { useToday } from './useToday'

export const canSystemNotify = () => typeof Notification !== 'undefined' && Notification.permission === 'granted'

async function showSystem(n: AppNotification) {
  const opts = { body: n.body, tag: n.id, icon: `${import.meta.env.BASE_URL}pwa-192.png`, badge: `${import.meta.env.BASE_URL}pwa-192.png` }
  try {
    const reg = await navigator.serviceWorker?.ready
    if (reg) return void (await reg.showNotification(n.title, opts))
    new Notification(n.title, opts)
  } catch {
    /* notifications are best-effort */
  }
}

function deliver(created: AppNotification[]) {
  const { notifPrefs } = useStore.getState()
  for (const n of created) {
    if (document.visibilityState === 'visible') useToasts.getState().push({ id: n.id, title: n.title, body: n.body, celebrate: n.type === 'pr' || n.type === 'goal-reached' })
    else if (notifPrefs.system && canSystemNotify()) void showSystem(n)
  }
}

/**
 * Watches logs, goals and the plan, and raises notifications (in-app feed, banners,
 * and optional system alerts). Runs only while the app is open — see Settings copy.
 */
export function useNotificationEngine() {
  const today = useToday()
  const logs = useStore((s) => s.logs)
  const goals = useStore((s) => s.goals)
  const bodyweight = useStore((s) => s.bodyweight)
  const plan = useStore((s) => s.plan)
  const overrides = useStore((s) => s.overrides)
  const prefs = useStore((s) => s.notifPrefs)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => {
      const s = useStore.getState()
      const now = new Date()
      const items = computeNotifications({
        logs: s.logs, goals: s.goals, bodyweight: s.bodyweight, plan: s.plan, overrides: s.overrides, units: s.units, prefs: s.notifPrefs,
        today, nowMinutes: now.getHours() * 60 + now.getMinutes(),
        exerciseName: (id) => findExercise(s.custom, id),
      })
      deliver(s.pushNotifications(items))
    }, 1200) // let typing settle before judging a number
    return () => clearTimeout(t)
  }, [logs, goals, bodyweight, plan, overrides, prefs, today, tick])

  // Fire the daily reminder if the app is open when the time arrives.
  useEffect(() => {
    const ms = msUntilReminder(prefs, new Date())
    if (ms == null) return
    const t = setTimeout(() => setTick((n) => n + 1), ms + 500)
    return () => clearTimeout(t)
  }, [prefs, today, tick])

  // Re-check whenever the app comes back to the foreground.
  useEffect(() => {
    const h = () => document.visibilityState === 'visible' && setTick((n) => n + 1)
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [])
}
