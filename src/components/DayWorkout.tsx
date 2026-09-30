import { useState } from 'react'
import { groupByBlock } from '../lib/describe'
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
  return (
    <>
        {groups.map((g, gi) => only !== undefined && gi !== only ? null : g.items[0].item.warmup ? (
          <WarmupCard key={`warmup-${gi}`} items={g.items.map((x) => x.item)} onRemove={() => g.items.forEach((x) => s.removeExercise(date, x.item.exerciseId))} />
        ) : g.items[0].item.wod ? (
          <TimedBlockCard key={g.block ?? gi} items={g.items.map((x) => x.item)} date={date} onRemove={() => g.items.forEach((x) => s.removeExercise(date, x.item.exerciseId))} />
        ) : (
          <div key={gi} className={g.block ? 'space-y-2 rounded-3xl bg-neutral-200/50 p-2' : 'contents'}>
            {g.block && g.label && <p className="px-2 pt-1 text-xs uppercase tracking-wide text-neutral-500">{g.label}</p>}
            {(() => {
              const c = parseCircuit(g.label, g.items.map((x) => x.item))
              if (!c) return null
              const names = g.items.map((x) => findExercise(s.custom, x.item.exerciseId)?.name ?? 'Exercise')
              return <button onClick={() => setCircuitTimer({ title: 'HIIT circuit', segments: circuitSegments(names, c) })} className="mx-2 rounded-full bg-surface px-3 py-1 text-xs text-neutral-600 ring-1 ring-neutral-200/70">⏱ Start circuit timer</button>
            })()}
            {g.items.map(({ item: p }) => {
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
                  note={p.note}
                  current={current}
                  last={last}
                  onSetCount={(n) => s.setSetCount(date, ex.id, n)}
                  onChange={(sets) => s.saveStrength(date, ex.id, sets)}
                  onNote={(n) => s.saveNote(date, ex.id, n)}
                  onSetDone={onSetDone}
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
        ))}
      {circuitTimer && <IntervalTimerSheet title={circuitTimer.title} segments={circuitTimer.segments} onClose={() => setCircuitTimer(null)} />}
    </>
  )
}

