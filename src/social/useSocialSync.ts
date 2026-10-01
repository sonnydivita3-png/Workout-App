import { useEffect, useRef } from 'react'
import { BUILTIN_BY_ID } from '../data/exercises'
import { toISO } from '../lib/dates'
import { findExercise, useStore } from '../store'
import { useToasts } from '../toastStore'
import { challengeProgress } from './challengeProgress'
import { buildSnapshot } from './snapshot'
import { useSocial } from './store'

const POLL_MS = 45_000

/** Keeps social data fresh while the app is open: loads on start, polls, toasts new items, reports challenge progress. */
export function useSocialSync() {
  const enabled = useStore((s) => s.socialChoice === 'enabled')
  const seen = useRef<Set<string> | null>(null)
  const lastSent = useRef('')

  useEffect(() => {
    if (!enabled) { useSocial.getState().reset(); seen.current = null; return }
    useSocial.getState().init()
    const tick = () => { if (document.visibilityState === 'visible') useSocial.getState().refresh() }
    const t = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick) }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    return useSocial.subscribe((s, prev) => {
      if (s.status !== 'ready') return
      // Toast newly arrived items (not the first load).
      const items: { id: string; title: string; body: string }[] = [
        ...s.requests.incoming.map((r) => ({ id: `fr-${r.id}`, title: 'Friend request', body: `${r.from.displayName} wants to be friends` })),
        ...s.shares.filter((x) => !x.mine && x.status === 'pending').map((x) => ({ id: `sh-${x.id}`, title: 'New workout', body: `${x.from.displayName} sent “${x.title}”` })),
        ...s.workoutRequests.filter((x) => !x.mine && x.status === 'pending').map((x) => ({ id: `wr-${x.id}`, title: 'Workout request', body: `${x.from.displayName} wants a workout` })),
        ...s.challenges.filter((x) => !x.mine && x.status === 'pending').map((x) => ({ id: `ch-${x.id}`, title: 'Challenge', body: `${x.from.displayName}: ${x.title}` })),
        ...s.emoji.filter((x) => !x.mine && !x.read).map((x) => ({ id: `em-${x.id}`, title: `${x.emoji} from ${x.from.displayName}`, body: '' })),
      ]
      // A friend answered a challenge I sent (while the app is open; otherwise it waits in the inbox).
      if (prev.status === 'ready') {
        for (const c of s.challenges) {
          const before = prev.challenges.find((x) => x.id === c.id)
          if (!c.mine || !before || before.status === c.status) continue
          const who = c.to.displayName
          const text = c.status === 'active' ? `${who} accepted your challenge 💪` : c.status === 'declined' ? `${who} declined your challenge` : c.status === 'completed' && c.done ? `${who} finished your challenge 🏆` : null
          if (text) items.push({ id: `cs-${c.id}-${c.status}`, title: text, body: c.title })
        }
      }
      if (seen.current === null || prev.status !== 'ready') { seen.current = new Set(items.map((i) => i.id)); return }
      for (const it of items) {
        if (seen.current.has(it.id)) continue
        seen.current.add(it.id)
        useToasts.getState().push(it)
      }
    })
  }, [enabled])

  // Report progress on challenges I accepted, and publish my summary for friends who can see it.
  useEffect(() => {
    if (!enabled) return
    const sync = () => {
      const soc = useSocial.getState()
      if (soc.status !== 'ready') return
      const st = useStore.getState()
      const today = toISO(new Date())
      const lookup = (id: string) => findExercise(st.custom, id) ?? BUILTIN_BY_ID.get(id)
      for (const c of soc.challenges) {
        if (c.mine || c.status !== 'active') continue
        const p = challengeProgress(c, st.logs, today, lookup)
        if (p.done && !c.done) useToasts.getState().push({ id: `done-${c.id}`, title: 'Challenge crushed 🏆', body: c.title, celebrate: true })
        if (p.progress !== c.progress || p.done !== c.done) soc.backend.reportProgress(c.id, p.progress, p.done).then(() => soc.refresh()).catch(() => undefined)
      }
      if (soc.friends.some((f) => f.iGrant.progress)) {
        const snap = buildSnapshot({ logs: st.logs, notifications: st.notifications, today, lookup })
        const key = JSON.stringify({ ...snap, updatedAt: '' })
        if (key !== lastSent.current) { lastSent.current = key; soc.backend.publishProgress(snap).catch(() => { lastSent.current = '' }) }
      }
    }
    sync()
    const unsubS = useStore.subscribe(sync)
    const unsubC = useSocial.subscribe(sync)
    return () => { unsubS(); unsubC() }
  }, [enabled])
}
