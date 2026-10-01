import { useState } from 'react'
import { groupByBlock } from '../lib/describe'
import { canCombine, roundDone, ungroup } from '../lib/arrange'
import { fmtRest } from '../lib/describe'
import { restFor } from '../lib/timing'
import { circuitSegments, parseCircuit } from '../lib/wod'
import { findExercise, selectLastLog, useStore } from '../store'
import { replaceExercise, swapExercise } from '../lib/randomizer'
import { hasData } from '../lib/stats'
import { useToday } from '../lib/useToday'
import type { Exercise, PlannedExercise } from '../types'
import { CardioCard } from './CardioCard'
import { ExerciseHistorySheet } from './ExerciseHistorySheet'
import { ExercisePicker } from './ExercisePicker'
import { rowBtn, Sheet } from './Sheet'
import { IntervalTimerSheet } from './IntervalTimerSheet'
import { StrengthCard } from './StrengthCard'
import { TimedBlockCard } from './TimedBlockCard'
import { WarmupCard } from './WarmupCard'

/** The exercises planned for a day, ready to log (the Workouts tab). `onSetDone` hears about each ticked set. */
export function DayWorkout({ date, items: planned, onSetDone }: { date: string; items: PlannedExercise[]; onSetDone?: (restSeconds: number) => void }) {
  const s = useStore()
  const [circuitTimer, setCircuitTimer] = useState<{ title: string; segments: ReturnType<typeof circuitSegments> } | null>(null)
  // Swapping one exercise: first how (random or choose), then the picker if choosing.
  const [swap, setSwap] = useState<{ index: number; ex: Exercise; step: 'how' | 'pick' } | null>(null)
  const [history, setHistory] = useState<Exercise | null>(null)
  // A day that hasn't happened yet shows the plan; sets are ticked off on the day.
  const future = date > useToday()
  const [swapMsg, setSwapMsg] = useState<string | null>(null)
  const logged = (id: string) => s.logs.find((l) => l.date === date && l.exerciseId === id && hasData(l))
  // Sets already logged for an exercise go with it (asked first), so nothing hidden is left in your history.
  const okToDrop = (ex: Exercise, what: string) => !logged(ex.id) || confirm(`${ex.name} has sets logged for this day. ${what} anyway? Those sets are deleted.`)
  const remove = (ex: Exercise) => {
    if (!okToDrop(ex, 'Remove it')) return
    s.removeExercise(date, ex.id)
    if (logged(ex.id)) s.deleteLogs(ex.id, date)
  }
  const replace = (ex: Exercise, next: PlannedExercise[]) => {
    if (!okToDrop(ex, 'Swap it')) return false
    if (logged(ex.id)) s.deleteLogs(ex.id, date)
    s.setDayItems(date, next)
    return true
  }
  const randomSwap = () => {
    if (!swap) return
    const next = swapExercise(planned, swap.index)
    if (next === planned) { setSwapMsg(`No other ${swap.ex.group.toLowerCase()} exercise fits your equipment. Choose one instead.`); return }
    if (replace(swap.ex, next)) setSwap(null)
  }
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
  return (
    <>
        {groups.map((g, gi) => g.items[0].item.warmup ? (
          <WarmupCard key={`warmup-${gi}`} items={g.items.map((x) => x.item)} onRemove={() => g.items.forEach((x) => s.removeExercise(date, x.item.exerciseId))} />
        ) : g.items[0].item.wod ? (
          <TimedBlockCard key={g.block ?? gi} items={g.items.map((x) => x.item)} date={date} onRemove={() => g.items.forEach((x) => s.removeExercise(date, x.item.exerciseId))} />
        ) : (
          <div key={gi} className={g.block ? 'space-y-2 rounded-3xl bg-neutral-200/50 p-2' : 'contents'}>
            {g.block && g.label && (
              <div className="flex items-center justify-between px-2 pt-1">
                <p className="text-xs uppercase tracking-wide text-neutral-500">{g.label}</p>
                {canCombine(g) && g.items.length > 1 && (
                  <button onClick={() => s.setDayItems(date, ungroup(planned, gi))} className="text-xs text-neutral-500 underline underline-offset-2">Split</button>
                )}
              </div>
            )}
            {meta[gi].superset && meta[gi].roundRest > 0 && <p className="px-2 text-xs text-neutral-500">Do one set of each, back to back, then rest {fmtRest(meta[gi].roundRest)}.</p>}
            {(() => {
              const c = parseCircuit(g.label, g.items.map((x) => x.item))
              if (!c) return null
              const names = g.items.map((x) => findExercise(s.custom, x.item.exerciseId)?.name ?? 'Exercise')
              return <button onClick={() => setCircuitTimer({ title: 'HIIT circuit', segments: circuitSegments(names, c) })} className="mx-2 rounded-full bg-surface px-3 py-1 text-xs text-neutral-600 ring-1 ring-neutral-200/70">⏱ Start circuit timer</button>
            })()}
            {g.items.map(({ item: p, index }, mi) => {
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
                  onSetCount={(n) => {
                    // Fewer sets: the removed set's numbers go too, so they don't count anywhere unseen.
                    if (n < p.sets && current?.sets) s.saveStrength(date, ex.id, current.sets.slice(0, (p.warmupSets ?? 0) + n))
                    s.setSetCount(date, ex.id, n)
                  }}
                  onSwap={() => { setSwapMsg(null); setSwap({ index, ex, step: 'how' }) }}
                  onHistory={() => setHistory(ex)}
                  readOnly={future}
                  onDeleteSet={(i) => {
                    const cur = useStore.getState().logs.find((l) => l.date === date && l.exerciseId === ex.id)?.sets
                    if (cur) s.saveStrength(date, ex.id, cur.filter((_, j) => j !== i))
                    s.setSetCount(date, ex.id, p.sets - 1)
                  }}
                  onChange={(sets) => s.saveStrength(date, ex.id, sets)}
                  onNote={(n) => s.saveNote(date, ex.id, n)}
                  onSetDone={onSetDone && ((secs, set) => {
                    // A superset rests once per round: only when every exercise in it has done this set.
                    const { superset, roundRest } = meta[gi]
                    if (!superset || set.warmup) return onSetDone(secs)
                    const members = g.items.map((x) => ({ exerciseId: x.item.exerciseId, sets: x.item.sets }))
                    onSetDone(roundDone(members, useStore.getState().logs, date, set.round) ? roundRest : 0)
                  })}
                  onRemove={() => remove(ex)}
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
                  onRemove={() => remove(ex)}
                  onSwap={() => { setSwapMsg(null); setSwap({ index, ex, step: 'how' }) }}
                  readOnly={future}
                />
              )
            })}
          </div>
        ))}
      {swap?.step === 'how' && (
        <Sheet title={`Swap ${swap.ex.name}`} onClose={() => setSwap(null)} closeLabel="Cancel">
          <button onClick={randomSwap} className={rowBtn}>
            <span><span className="block text-sm font-medium">Random {swap.ex.group.toLowerCase()} exercise</span><span className="block text-xs text-neutral-400">Same body part, with your equipment. Keeps the number of sets</span></span>
            <span className="text-neutral-300">↻</span>
          </button>
          <button onClick={() => setSwap({ ...swap, step: 'pick' })} className={rowBtn}>
            <span><span className="block text-sm font-medium">Choose one</span><span className="block text-xs text-neutral-400">Browse {swap.ex.group.toLowerCase()} exercises, or search them all</span></span>
            <span className="text-neutral-300">›</span>
          </button>
          {swapMsg && <p role="status" className="px-3 pt-2 text-sm text-neutral-500">{swapMsg}</p>}
        </Sheet>
      )}
      {swap?.step === 'pick' && (
        <ExercisePicker
          title={`Swap ${swap.ex.name}`}
          initialGroup={swap.ex.group}
          taken={new Set(planned.map((p) => p.exerciseId))}
          onPick={(e) => { if (replace(swap.ex, replaceExercise(planned, swap.index, e))) setSwap(null) }}
          onClose={() => setSwap(null)}
        />
      )}
      {history && <ExerciseHistorySheet exercise={history} before={date} onClose={() => setHistory(null)} />}
      {circuitTimer && <IntervalTimerSheet title={circuitTimer.title} segments={circuitTimer.segments} onClose={() => setCircuitTimer(null)} />}
    </>
  )
}

