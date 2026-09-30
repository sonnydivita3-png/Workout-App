import { useState } from 'react'
import { groupByBlock } from '../lib/describe'
import { canCombine, combine, roundDone, ungroup } from '../lib/arrange'
import { fmtRest } from '../lib/describe'
import { restFor } from '../lib/timing'
import { circuitSegments, parseCircuit } from '../lib/wod'
import { findExercise, selectLastLog, useStore } from '../store'
import type { PlannedExercise } from '../types'
import { CardioCard } from './CardioCard'
import { IntervalTimerSheet } from './IntervalTimerSheet'
import { StrengthCard } from './StrengthCard'
import { TimedBlockCard } from './TimedBlockCard'
import { WarmupCard } from './WarmupCard'

/** The exercises planned for a day, ready to log. Used on the Plan tab and in workout mode. */
export function DayWorkout({ date, items: planned, only, onSetDone }: { date: string; items: PlannedExercise[]; only?: number; onSetDone?: (restSeconds: number) => void }) {
  const s = useStore()
  const [circuitTimer, setCircuitTimer] = useState<{ title: string; segments: ReturnType<typeof circuitSegments> } | null>(null)
  const groups = groupByBlock(planned)
  // Supersets (not circuits, which have their own timer) rest once per round, as long as the longest planned rest.
  const meta = groups.map((g) => {
    const superset = !!g.block && g.items.length > 1 && canCombine(g) && (/(^|-)ss\d/.test(g.block) || /^Superset/.test(g.label ?? ''))
    const roundRest = Math.max(0, ...g.items.map(({ item: p }) => {
      const ex = findExercise(s.custom, p.exerciseId)
      return ex?.kind === 'strength' ? p.rest ?? restFor(ex, p.reps, p.seconds) : 0
    }))
    return { superset, roundRest }
  })
  // On the Plan tab (not mid-workout), two neighbouring exercises can be joined into a superset in one tap.
  const joinable = (gi: number) => only === undefined && gi < groups.length - 1 && canCombine(groups[gi]) && canCombine(groups[gi + 1])
  const join = (gi: number) => s.setDayItems(date, combine(planned, [gi, gi + 1]))
  const joinLink = (gi: number) => joinable(gi) && (
    <button key={`join-${gi}`} onClick={() => join(gi)} className="relative mx-auto -my-1 block rounded-full bg-surface px-3 py-1 text-xs text-neutral-500 ring-1 ring-neutral-200/70">
      ⤓ Superset with next
    </button>
  )
  return (
    <>
        {groups.map((g, gi) => only !== undefined && gi !== only ? null : [g.items[0].item.warmup ? (
          <WarmupCard key={`warmup-${gi}`} items={g.items.map((x) => x.item)} onRemove={() => g.items.forEach((x) => s.removeExercise(date, x.item.exerciseId))} />
        ) : g.items[0].item.wod ? (
          <TimedBlockCard key={g.block ?? gi} items={g.items.map((x) => x.item)} date={date} onRemove={() => g.items.forEach((x) => s.removeExercise(date, x.item.exerciseId))} />
        ) : (
          <div key={gi} className={g.block ? 'space-y-2 rounded-3xl bg-neutral-200/50 p-2' : 'contents'}>
            {g.block && g.label && (
              <div className="flex items-center justify-between px-2 pt-1">
                <p className="text-xs uppercase tracking-wide text-neutral-500">{g.label}</p>
                {only === undefined && canCombine(g) && g.items.length > 1 && (
                  <button onClick={() => s.setDayItems(date, ungroup(planned, gi))} className="text-xs text-neutral-500 underline underline-offset-2">Split</button>
                )}
              </div>
            )}
            {meta[gi].superset && meta[gi].roundRest > 0 && only !== undefined && <p className="px-2 text-xs text-neutral-500">Do one set of each, back to back, then rest {fmtRest(meta[gi].roundRest)}.</p>}
            {(() => {
              const c = parseCircuit(g.label, g.items.map((x) => x.item))
              if (!c) return null
              const names = g.items.map((x) => findExercise(s.custom, x.item.exerciseId)?.name ?? 'Exercise')
              return <button onClick={() => setCircuitTimer({ title: 'HIIT circuit', segments: circuitSegments(names, c) })} className="mx-2 rounded-full bg-surface px-3 py-1 text-xs text-neutral-600 ring-1 ring-neutral-200/70">⏱ Start circuit timer</button>
            })()}
            {g.items.map(({ item: p }, mi) => {
              const ex = findExercise(s.custom, p.exerciseId)
              if (!ex) return null
              const current = s.logs.find((l) => l.date === date && l.exerciseId === ex.id)
              const last = selectLastLog(s.logs, ex.id, date)
              return ex.kind === 'strength' ? (
                <StrengthCard
                  key={ex.id}
                  exercise={ex}
                  setCount={p.sets}
                  targetReps={p.reps}
                  targetSeconds={p.seconds}
                  warmupSets={p.warmupSets}
                  rest={p.block ? undefined : p.rest}
                  restNote={meta[gi].superset ? (mi === g.items.length - 1 ? `then rest ${fmtRest(meta[gi].roundRest)}` : 'straight into the next') : undefined}
                  note={p.note}
                  current={current}
                  last={last}
                  onSetCount={(n) => s.setSetCount(date, ex.id, n)}
                  onChange={(sets) => s.saveStrength(date, ex.id, sets)}
                  onNote={(n) => s.saveNote(date, ex.id, n)}
                  onSetDone={onSetDone && ((secs, set) => {
                    // A superset rests once per round: only when every exercise in it has done this set.
                    const { superset, roundRest } = meta[gi]
                    if (!superset || set.warmup) return onSetDone(secs)
                    const members = g.items.map((x) => ({ exerciseId: x.item.exerciseId, sets: x.item.sets }))
                    onSetDone(roundDone(members, useStore.getState().logs, date, set.round) ? roundRest : 0)
                  })}
                  onRemove={() => s.removeExercise(date, ex.id)}
                />
              ) : (
                <CardioCard
                  key={ex.id}
                  exercise={ex}
                  current={current}
                  last={last}
                  targetMinutes={p.minutes}
                  targetDistance={p.distance}
                  note={p.note}
                  onChange={(c) => s.saveCardio(date, ex.id, c)}
                  onRemove={() => s.removeExercise(date, ex.id)}
                />
              )
            })}
          </div>
        ), joinLink(gi)])}
      {circuitTimer && <IntervalTimerSheet title={circuitTimer.title} segments={circuitTimer.segments} onClose={() => setCircuitTimer(null)} />}
    </>
  )
}

