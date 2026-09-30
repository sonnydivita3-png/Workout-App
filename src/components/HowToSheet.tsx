import { useEffect, useState } from 'react'
import type { Exercise } from '../types'
import { Sheet } from './Sheet'

interface HowTo { i: string[]; p: string[]; s: string[]; n: number; l: string }
let cache: Promise<Record<string, HowTo>> | null = null
/** Instructions ship as a separate file, loaded the first time someone opens one. */
const load = () => (cache ??= import('../data/howto.json').then((m) => m.default as Record<string, HowTo>))

const IMG = (id: string, n: number) => `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/${encodeURIComponent(id)}/${n}.jpg`

/** How to do an exercise: pictures, steps and muscles worked, from free-exercise-db (public domain). */
export function HowToSheet({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const [info, setInfo] = useState<HowTo | null | undefined>(undefined)
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    let live = true
    load().then((all) => { if (live) setInfo(all[exercise.id] ?? null) }).catch(() => { if (live) setInfo(null) })
    return () => { live = false }
  }, [exercise.id])
  // Flip between the start and end photos, like a tiny animation.
  useEffect(() => {
    if (!info || info.n < 2) return
    const t = setInterval(() => setFrame((f) => (f + 1) % info.n), 1200)
    return () => clearInterval(t)
  }, [info])

  return (
    <Sheet title={exercise.name} onClose={onClose}>
      {exercise.fullName && <p className="-mt-2 mb-3 text-sm text-neutral-400">{exercise.fullName}</p>}
      {info === undefined && <p className="py-8 text-center text-neutral-400">Loading…</p>}
      {info === null && <p className="py-8 text-center text-neutral-400">No instructions for this one yet{exercise.custom ? ' (it’s a custom exercise)' : ''}.</p>}
      {info && (
        <>
          {info.n > 0 && (
            <div className="mb-3 overflow-hidden rounded-2xl bg-neutral-100">
              <img src={IMG(exercise.id, frame)} alt={`${exercise.name}, position ${frame + 1}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
            </div>
          )}
          <p className="mb-3 text-xs text-neutral-500">
            {[...info.p, ...info.s.map((m) => `${m} (secondary)`)].join(' · ')}{info.l ? ` · ${info.l}` : ''}
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-neutral-700">
            {info.i.map((step, n) => <li key={n}>{step}</li>)}
          </ol>
          <p className="mt-4 text-[11px] text-neutral-400">From free-exercise-db (public domain). Pictures need a connection.</p>
        </>
      )}
    </Sheet>
  )
}
