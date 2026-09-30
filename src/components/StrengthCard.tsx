import { useState } from 'react'
import { fmtRest } from '../lib/describe'
import { compareSet, platesFor, suggestNext, weightStep, workSets } from '../lib/progression'
import { restFor, warmupRamp } from '../lib/timing'
import { formatSeconds, showWeight, storeWeight } from '../lib/units'
import { useStore } from '../store'
import type { Exercise, ExerciseLog, StrengthSet } from '../types'
import { HowToSheet } from './HowToSheet'
import { HoldTimerSheet } from './IntervalTimerSheet'
import { NumberInput } from './NumberInput'

interface Props {
  exercise: Exercise
  setCount: number
  targetReps?: number
  targetSeconds?: number
  /** Planned light ramp-up sets before the working sets. */
  warmupSets?: number
  /** Planned rest after each working set, in seconds. */
  rest?: number
  note?: string
  current?: ExerciseLog
  last?: ExerciseLog
  onSetCount: (n: number) => void
  onChange: (sets: StrengthSet[]) => void
  onNote?: (note: string) => void
  onRemove: () => void
  /** Workout mode: show a ✓ per set that fills in the suggestion and starts the rest timer (for this many seconds). */
  onSetDone?: (restSeconds: number) => void
}

const MARK = { up: { t: '▲', c: 'text-green-600', l: 'beat last time' }, same: { t: '=', c: 'text-neutral-400', l: 'matched last time' }, down: { t: '▼', c: 'text-red-600', l: 'below last time' } } as const

export function StrengthCard({ exercise, setCount, targetReps, targetSeconds, warmupSets = 0, rest, note, current, last, onSetCount, onChange, onNote, onRemove, onSetDone }: Props) {
  const units = useStore((s) => s.units)
  const trackRpe = useStore((s) => s.trackRpe)
  const mode = exercise.mode ?? 'weight'
  const [timing, setTiming] = useState<number | null>(null)
  const [howTo, setHowTo] = useState(false)
  const [plates, setPlates] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  // Planned warm-up sets come first (marked W), then the working sets.
  const sets: StrengthSet[] = Array.from({ length: warmupSets + setCount }, (_, i) => current?.sets?.[i] ?? { weight: null, reps: null, seconds: null, ...(i < warmupSets ? { warmup: true } : {}) })
  const lastWork = workSets(last)
  const allLogs = useStore((s) => s.logs)
  const history = last ? allLogs.filter((l) => l.exerciseId === exercise.id && l.date <= last.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4) : []
  const tip = suggestNext(exercise, last, { reps: targetReps, seconds: targetSeconds }, units, history)

  const update = (i: number, patch: Partial<StrengthSet>) => onChange(sets.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const filled = (s: StrengthSet) => !!(s.weight || s.reps || s.seconds)
  const fromTip = (s: StrengthSet): StrengthSet => ({
    ...s,
    weight: s.weight ?? (mode === 'weight' ? tip.weight ?? null : null),
    reps: s.reps ?? (mode === 'time' ? null : tip.reps ?? targetReps ?? null),
    ...(mode === 'time' ? { seconds: s.seconds ?? tip.seconds ?? targetSeconds ?? null } : {}),
  })
  // Warm-up ramp from the weight you're working up to (rounded to what you can load).
  const ramp = warmupRamp(warmupSets)
  const rampFor = (i: number): StrengthSet | null => {
    const r = ramp[i]
    const top = tip.weight ?? workSets(last)[0]?.weight ?? null
    if (!r || mode !== 'weight' || !top) return null
    const step = weightStep(exercise, units)
    const bar = exercise.equipment === 'Barbell' ? (units.weight === 'kg' ? 20 * 2.20462262 : 45) : 0
    return { weight: Math.max(bar, Math.round((top * r.pct) / step) * step), reps: r.reps, warmup: true }
  }
  const fillAll = () => onChange(sets.map((s, i) => (filled(s) ? s : s.warmup ? { ...s, ...(rampFor(i) ?? {}) } : fromTip(s))))
  const workRest = rest ?? restFor(exercise, targetReps, targetSeconds)
  const done = (i: number) => {
    const s = sets[i]
    if (!filled(s)) update(i, s.warmup ? { ...s, ...(rampFor(i) ?? {}) } : fromTip(s))
    onSetDone?.(s.warmup ? 60 : workRest)
  }

  // Compare working sets in order with last time's working sets (warm-ups skipped on both sides).
  let workIndex = -1
  const vsLast = sets.map((s) => {
    if (s.warmup || !filled(s)) return null
    workIndex++
    return compareSet(s, lastWork[workIndex], mode)
  })
  const beat = vsLast.filter((v) => v === 'up').length

  const target = mode === 'time' ? (targetSeconds ? `${setCount} × ${targetSeconds}s` : '') : targetReps ? `${setCount} × ${targetReps}` : ''
  const cols = [
    '2rem',
    ...(mode === 'weight' ? ['1fr'] : []),
    '1fr',
    ...(trackRpe ? ['3.25rem'] : []),
    onSetDone ? '2.25rem' : '4.5rem',
  ].join('_')
  const lastText = (p?: StrengthSet) => {
    if (!p) return '—'
    if (mode === 'time') return p.seconds ? formatSeconds(p.seconds) : '—'
    if (mode === 'reps') return p.reps ? `${p.reps} reps` : '—'
    return p.weight != null ? `${showWeight(p.weight, units)} × ${p.reps ?? '–'}` : '—'
  }
  const tipText =
    tip.kind === 'first' ? null
    : mode === 'time' ? `${tip.seconds}s`
    : mode === 'reps' ? `${tip.reps} reps`
    : `${showWeight(tip.weight ?? 0, units)} ${units.weight} × ${tip.reps}`
  const barbell = mode === 'weight' && exercise.equipment === 'Barbell'
  const plateWeight = showWeight(sets.find((s) => !s.warmup && s.weight)?.weight ?? tip.weight ?? null, units)

  return (
    <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button onClick={() => setHowTo(true)} className="text-left font-semibold underline decoration-neutral-300 decoration-dotted underline-offset-4">{exercise.name}</button>
          <p className="text-xs text-neutral-400">
            {exercise.group}
            {mode === 'time' && ' · timed'}
            {target && ` · target ${target}`}
            {warmupSets > 0 && ` · +${warmupSets} warm-up`}
            {` · rest ${fmtRest(workRest)}`}
            {note && ` · ${note}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-neutral-400">
          <div className="flex items-center gap-1 text-sm">
            <button onClick={() => onSetCount(Math.max(1, setCount - 1))} aria-label="Fewer sets" className="h-6 w-6 rounded-full bg-neutral-100">−</button>
            <span className="w-12 text-center text-neutral-600">{setCount} sets</span>
            <button onClick={() => onSetCount(setCount + 1)} aria-label="More sets" className="h-6 w-6 rounded-full bg-neutral-100">+</button>
          </div>
          <button onClick={onRemove} aria-label="Remove" className="text-lg leading-none">×</button>
        </div>
      </div>

      {tipText && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2">
          <span className="min-w-0 flex-1 text-xs text-neutral-500">
            <span className="font-semibold text-neutral-900">🎯 Try {tipText}</span> · {tip.why}
          </span>
          <button onClick={fillAll} className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-on-accent">Fill</button>
        </div>
      )}
      {tip.kind === 'first' && <p className="mb-3 text-xs text-neutral-400">{tip.why}</p>}

      <div className="space-y-2">
        <div className="grid gap-2 text-[11px] uppercase tracking-wide text-neutral-400" style={{ gridTemplateColumns: cols.replaceAll('_', ' ') }}>
          <span>Set</span>
          {mode === 'weight' && <span className="text-center">{units.weight}</span>}
          <span className="text-center">{mode === 'time' ? 'Seconds' : 'Reps'}</span>
          {trackRpe && <span className="text-center">RPE</span>}
          <span className="text-right">{onSetDone ? '' : 'Last'}</span>
        </div>
        {sets.map((s, i) => {
          const prev = last?.sets?.[i]
          const mark = vsLast[i] ? MARK[vsLast[i]!] : null
          // Warm-ups and working sets are numbered separately: W W W, then 1 2 3.
          const warmBefore = sets.slice(0, i).filter((x) => x.warmup).length
          const label = s.warmup ? `Warm-up set ${warmBefore + 1}` : `Set ${i + 1 - warmBefore}`
          return (
            <div key={i} className="grid items-center gap-2" style={{ gridTemplateColumns: cols.replaceAll('_', ' ') }}>
              <button
                onClick={() => update(i, { warmup: !s.warmup })}
                aria-label={s.warmup ? `${label}; tap to make it a working set` : `${label}; tap to mark as warm-up`}
                title="Tap to mark as warm-up"
                className={`h-8 rounded-lg text-sm ${s.warmup ? 'bg-neutral-100 font-semibold text-amber-700' : 'text-neutral-400'}`}
              >
                {s.warmup ? 'W' : i + 1 - warmBefore}
                {mark && <span className={`ml-0.5 text-[10px] ${mark.c}`} aria-label={mark.l}>{mark.t}</span>}
              </button>
              {mode === 'weight' && (
                <NumberInput
                  value={showWeight(s.weight, units)}
                  step={units.weight === 'kg' ? 1 : 2.5}
                  placeholder={showWeight(s.warmup ? rampFor(i)?.weight ?? null : tip.weight ?? prev?.weight ?? null, units)?.toString() ?? '–'}
                  onChange={(v) => update(i, { weight: storeWeight(v, units) })}
                />
              )}
              {mode === 'time' ? (
                <div className="flex items-center gap-1">
                  <NumberInput value={s.seconds ?? null} step={5} placeholder={(tip.seconds ?? prev?.seconds ?? targetSeconds)?.toString() ?? '–'} onChange={(v) => update(i, { seconds: v })} />
                  <button onClick={() => setTiming(i)} aria-label={`Time set ${i + 1}`} title="Time this hold" className="h-9 w-9 shrink-0 rounded-lg bg-neutral-100 text-base">⏱</button>
                </div>
              ) : (
                <NumberInput value={s.reps} placeholder={(s.warmup ? rampFor(i)?.reps : tip.reps ?? prev?.reps ?? targetReps)?.toString() ?? '–'} onChange={(v) => update(i, { reps: v })} />
              )}
              {trackRpe && <NumberInput value={s.rpe ?? null} placeholder="–" onChange={(v) => update(i, { rpe: v == null ? null : Math.min(10, Math.max(1, v)) })} />}
              {onSetDone ? (
                <button onClick={() => done(i)} aria-label={`${label} done`} className={`h-9 rounded-lg text-sm font-bold ${filled(s) ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-400'}`}>✓</button>
              ) : (
                <span className="text-right text-xs tabular-nums text-neutral-400">{lastText(prev)}</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
        {beat > 0 && <span className="font-medium text-green-600">▲ Beat last time on {beat} set{beat === 1 ? '' : 's'}</span>}
        {barbell && <button onClick={() => setPlates((p) => !p)} className="underline underline-offset-2">Plates</button>}
        {onNote && !editingNote && <button onClick={() => setEditingNote(true)} className="underline underline-offset-2">{current?.note ? 'Edit note' : 'Add note'}</button>}
        {last?.note && <span className="text-neutral-400">Last note: “{last.note}”</span>}
      </div>
      {current?.note && !editingNote && <p className="mt-1 text-sm text-neutral-600">📝 {current.note}</p>}
      {editingNote && onNote && (
        <input
          autoFocus
          defaultValue={current?.note ?? ''}
          maxLength={200}
          placeholder="e.g. felt strong, use the wider grip next time"
          onBlur={(e) => { onNote(e.target.value.trim()); setEditingNote(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="mt-2 w-full rounded-lg bg-neutral-100 px-3 py-2 text-sm outline-none"
        />
      )}
      {plates && barbell && (
        <p className="mt-2 rounded-xl bg-neutral-50 px-3 py-2 text-sm">
          {plateWeight ? (() => {
            const p = platesFor(plateWeight, units)
            return <>For {plateWeight} {units.weight}: {p.bar} {units.weight} bar + <b>{p.perSide.length ? p.perSide.join(', ') : 'no plates'}</b> each side{p.left ? ` (${p.left} ${units.weight} short)` : ''}</>
          })() : 'Enter a weight to see the plates.'}
        </p>
      )}

      {timing !== null && <HoldTimerSheet name={`${exercise.name} · set ${timing + 1}`} target={targetSeconds} onUse={(secs) => { update(timing, { seconds: secs }); setTiming(null) }} onClose={() => setTiming(null)} />}
      {howTo && <HowToSheet exercise={exercise} onClose={() => setHowTo(false)} />}
    </div>
  )
}
