import { useRef, useState } from 'react'
import { fmtRest } from '../lib/describe'
import { compareSet, estimateStart, formatSet, platesFor, suggestNext, weightStep, workSets } from '../lib/progression'
import { restFor, warmupRamp } from '../lib/timing'
import { hasNumbers, isTicked, setRows, workingRows } from '../lib/setRows'
import { showWeight, storeWeight } from '../lib/units'
import { findExercise, useStore } from '../store'
import type { Exercise, ExerciseLog, StrengthSet } from '../types'
import { HoldTimerSheet } from './IntervalTimerSheet'
import { NumberInput } from './NumberInput'
import { rowBtn, Sheet } from './Sheet'

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
  /** A set was ticked ✓ (starts the rest timer, if it's on, for this many seconds). */
  onSetDone?: (restSeconds: number, set: { round: number; warmup: boolean }) => void
  /** Replaces "rest 1:30" in the subtitle, e.g. for an exercise in a superset. */
  restNote?: string
  /** Swap for another exercise (same body part, random or chosen). */
  onSwap?: () => void
  /** Recent sessions of this exercise. */
  onHistory?: () => void
  /** Delete one particular set (its numbers too). */
  onDeleteSet?: (index: number) => void
  /** A day that hasn't happened yet: show the plan, log it on the day. */
  readOnly?: boolean
  /** Planned drop sets after the working sets. */
  dropSets?: number
  onDropSets?: (n: number) => void
  /** Delete one drop set (its numbers too). */
  onDeleteDrop?: (index: number) => void
  /** The day being logged (a long break since last time changes the target). */
  date?: string
  /** They chose to keep the planned number of sets over last time's. */
  keepSets?: boolean
  /** Keep the planned number of sets (when asked about last time's). No question without it. */
  onKeepSets?: () => void
}

const MARK = { up: { t: '▲', c: 'text-green-600', l: 'beat last time' }, same: { t: '=', c: 'text-neutral-400', l: 'matched last time' }, down: { t: '▼', c: 'text-red-600', l: 'below last time' } } as const

/**
 * One exercise to log: a target from last time, then a row per set. ✓ logs a set (filling in the target if nothing
 * was typed). Everything else (note, plates, fewer sets, remove) is under ⋯ so the card stays simple.
 */
export function StrengthCard({ exercise, setCount, targetReps, targetSeconds, warmupSets = 0, rest, note, current, last, onSetCount, onChange, onNote, onRemove, onSetDone, restNote, onSwap, onHistory, onDeleteSet, readOnly, dropSets = 0, onDropSets, onDeleteDrop, date, keepSets, onKeepSets }: Props) {
  const units = useStore((s) => s.units)
  const trackRpe = useStore((s) => s.trackRpe)
  const mode = exercise.mode ?? 'weight'
  // How they said they track this one (bodyweight or with weight), if they have.
  const chosenMode = useStore((s) => s.exerciseModes[exercise.id])
  const setExerciseMode = useStore((s) => s.setExerciseMode)
  const [timing, setTiming] = useState<number | null>(null)
  const [menu, setMenu] = useState(false)
  const [plates, setPlates] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const [setOpts, setSetOpts] = useState<number | null>(null)
  const [fold, setFold] = useState<{ collapsed: boolean; whenDone: boolean } | null>(null)
  const card = useRef<HTMLDivElement>(null)
  // Warm-ups first (marked W), then the working sets, then any drop sets. Logged sets keep their own flags.
  const firstDrop = warmupSets + setCount
  const sets: StrengthSet[] = setRows({ sets: setCount, warmupSets, dropSets }, current?.sets)
  const workingCount = workingRows(sets).length
  const lastWork = workSets(last)
  const allLogs = useStore((s) => s.logs)
  const history = last ? allLogs.filter((l) => l.exerciseId === exercise.id && l.date <= last.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4) : []
  const custom = useStore((s) => s.custom)
  const fromLast = suggestNext(exercise, last, { reps: targetReps, seconds: targetSeconds, sets: setCount }, units, history, date)
  // Never done this one: start from the most recent similar lift they have logged.
  const tip = (fromLast.kind === 'first' && estimateStart(exercise, allLogs, targetReps, units, (id) => findExercise(custom, id))) || fromLast

  // Typing doesn't tick a set (✓ does, like any gym log); typing over numbers ✓ filled in makes them yours.
  const typed = (patch: Partial<StrengthSet>) => !('auto' in patch) && ('weight' in patch || 'reps' in patch || 'seconds' in patch)
  const update = (i: number, patch: Partial<StrengthSet>) =>
    onChange(sets.map((s, j) => (j === i ? { ...s, ...(typed(patch) ? { auto: false, done: s.done ?? false } : {}), ...patch } : s)))
  const filled = hasNumbers
  // The target for row i: its own working set's target (progress sits on a set or two; the rest repeat last time).
  const aim = (i: number) => {
    const k = sets.slice(0, i).filter((x) => !x.warmup && !x.drop).length
    return tip.sets?.[k] ?? { weight: tip.weight, reps: tip.reps, seconds: tip.seconds }
  }
  const fromTip = (s: StrengthSet, i: number): StrengthSet => ({
    ...s,
    weight: s.weight ?? (mode === 'weight' ? aim(i).weight ?? null : null),
    reps: s.reps ?? (mode === 'time' ? null : aim(i).reps ?? targetReps ?? null),
    ...(mode === 'time' ? { seconds: s.seconds ?? aim(i).seconds ?? targetSeconds ?? null } : {}),
  })
  // Warm-up ramp from the weight you're working up to (rounded to what you can load), by each warm-up's place among
  // the warm-ups, including sets you turned into warm-ups yourself.
  const ramp = warmupRamp(sets.filter((x) => x.warmup).length)
  const rampFor = (i: number): StrengthSet | null => {
    const r = ramp[sets.slice(0, i).filter((x) => x.warmup).length]
    const top = tip.weight ?? workSets(last)[0]?.weight ?? null
    if (!r || mode !== 'weight' || !top) return null
    const step = weightStep(exercise, units)
    const bar = exercise.equipment === 'Barbell' ? (units.weight === 'kg' ? 20 * 2.20462262 : 45) : 0
    return { weight: Math.max(bar, Math.round((top * r.pct) / step) * step), reps: r.reps, warmup: true }
  }
  // Each drop about 20% lighter than the set before it, rounded to what you can load.
  const dropFor = (i: number): number | null => {
    const base = sets[firstDrop - 1]?.weight ?? tip.weight ?? workSets(last).at(-1)?.weight ?? null
    if (mode !== 'weight' || !base) return null
    const step = weightStep(exercise, units)
    return Math.max(step, Math.round((base * 0.8 ** (i - firstDrop + 1)) / step) * step)
  }
  const workRest = rest ?? restFor(exercise, targetReps, targetSeconds)
  // ✓ fills in whatever is missing from the target (typed numbers win), then logs the set. Tapping a ticked set
  // again unticks it (clears it), for a tap by mistake.
  const ticked = isTicked
  const done = (i: number) => {
    const s = sets[i]
    if (ticked(s)) {
      // Untick: numbers ✓ filled in go away again; numbers you typed stay.
      update(i, s.auto ? { weight: null, reps: null, seconds: null, rpe: null, done: false, auto: false } : { done: false })
      return
    }
    const r = s.warmup ? rampFor(i) : null
    const d = s.drop ? dropFor(i) : null
    const next = s.warmup ? { ...s, weight: s.weight ?? r?.weight ?? null, reps: s.reps ?? r?.reps ?? null }
      : s.drop ? { ...s, weight: s.weight ?? d, reps: s.reps ?? targetReps ?? null } : fromTip(s, i)
    update(i, { ...next, done: true, auto: !filled(s) })
    // That was the last one: the card folds up; bring it to the top so the next exercise is right below.
    if (!readOnly && sets.every((x, j) => x.warmup || j === i || ticked(x))) setTimeout(() => card.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60)
    try { navigator.vibrate?.(15) } catch { /* not supported */ }
    const round = sets.slice(0, i + 1).filter((x) => !x.warmup).length
    // No rest before a drop set, nor after one (that's the point of them).
    onSetDone?.(s.drop || sets[i + 1]?.drop ? 0 : s.warmup ? 60 : workRest, { round, warmup: !!s.warmup || !!s.drop })
  }

  // Compare working sets in order with last time's working sets (warm-ups skipped on both sides).
  let workIndex = -1
  const vsLast = sets.map((s) => {
    if (s.warmup || s.drop || !filled(s)) return null
    workIndex++
    return compareSet(s, lastWork[workIndex], mode)
  })
  const beat = vsLast.filter((v) => v === 'up').length
  // Done before with a different number of sets: ask whether to do the same as last time (until a set is ticked).
  const lastCount = lastWork.length
  const askSets = !readOnly && !!onKeepSets && !keepSets && lastCount > 0 && lastCount !== setCount && !sets.some((x) => !x.warmup && !x.drop && ticked(x))
  // 0 lb on a weighted lift usually means bodyweight: ask once, and remember the answer for this exercise.
  const askBodyweight = !readOnly && mode === 'weight' && !chosenMode && sets.some((x) => !x.warmup && !x.drop && x.weight === 0)

  const target = mode === 'time' ? (targetSeconds ? `${setCount} × ${targetSeconds}s` : '') : targetReps ? `${setCount} × ${targetReps}` : ''
  const cols = [
    '2rem',
    ...(mode === 'weight' ? ['minmax(0,1.2fr)'] : []),
    'minmax(0,1fr)',
    ...(trackRpe ? ['3.25rem'] : []),
    '2.75rem',
  ].join(' ')
  const setText = (p: StrengthSet) => formatSet(p, mode, units)
  const headline =
    tip.kind === 'first' ? null
    : mode === 'time' ? `${tip.seconds}s`
    // Reps moves, and weighted lifts done with bodyweight last time: aim for more reps.
    : mode === 'reps' || tip.weight == null ? `${tip.reps} reps`
    : `${showWeight(tip.weight, units)} ${units.weight} × ${tip.reps}`
  // Which sets: "on 2 sets", "on 1 more set"; nothing when it's every set.
  const changed = tip.changed ?? workingCount
  const tipText = !headline ? null
    : tip.kind === 'add-sets' ? `${headline} on ${changed} more set${changed === 1 ? '' : 's'}`
    : changed > 0 && changed < workingCount ? `${headline} on ${changed} set${changed === 1 ? '' : 's'}`
    : headline
  const barbell = mode === 'weight' && exercise.equipment === 'Barbell'
  const plateWeight = showWeight(sets.find((s) => !s.warmup && s.weight)?.weight ?? tip.weight ?? null, units)
  const menuItem = (label: string, go: () => void, danger = false) => (
    <button onClick={() => { setMenu(false); go() }} className={`${rowBtn}${danger ? ' text-red-600' : ''}`}><span>{label}</span></button>
  )

  const counted = sets.filter((x) => !x.warmup)
  const doneCount = counted.filter(ticked).length
  const allDone = !readOnly && counted.length > 0 && doneCount === counted.length
  // Finished exercises fold up to one line so the one you're on stays in view. Tap to open it again; the ⌃/⌄ button
  // folds or opens any card. A choice you make lasts until the card's done-ness changes (e.g. you untick a set).
  const collapsed = fold && fold.whenDone === allDone ? fold.collapsed : allDone
  const toggleFold = () => setFold({ collapsed: !collapsed, whenDone: allDone })
  const summary = counted.filter((x) => filled(x)).map((x) => `${x.drop ? 'D ' : ''}${formatSet(x, mode, units)}`).join(' · ')

  return (
    <div ref={card} className={`scroll-mt-4 rounded-2xl bg-surface shadow-sm ring-1 ring-neutral-200/70 ${collapsed ? 'px-4 py-3' : 'p-4'}`}>
      <div className={`${collapsed ? '' : 'mb-2 '}flex items-start justify-between gap-2`}>
        <div className="min-w-0">
          <button onClick={toggleFold} className="text-left font-semibold">{allDone && collapsed ? '✓ ' : ''}{exercise.name}</button>
          {collapsed ? (
            <button onClick={toggleFold} className="block text-left text-xs text-neutral-400">
              {doneCount} of {counted.length} sets{summary ? ` · ${summary}` : ''}{beat > 0 ? ` · ▲ ${beat} beat last time` : ''}
            </button>
          ) : (
          <p className="text-xs text-neutral-400">
            {exercise.group}
            {mode === 'time' && ' · timed'}
            {chosenMode === 'reps' && exercise.equipment !== 'Bodyweight' && ' · bodyweight'}
            {target && ` · ${target}`}
            {warmupSets > 0 && ` · +${warmupSets} warm-up`}
            {dropSets > 0 && ` · +${dropSets} drop`}
            {restNote ? ` · ${restNote}` : ` · rest ${fmtRest(workRest)}`}
            {note && ` · ${note}`}
          </p>
          )}
        </div>
        <button onClick={toggleFold} aria-label={`${collapsed ? 'Open' : 'Fold'} ${exercise.name}`} aria-expanded={!collapsed} className="-mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm leading-none text-neutral-400 hover:bg-neutral-100">{collapsed ? '⌄' : '⌃'}</button>
        <button onClick={() => setMenu(true)} aria-label={`${exercise.name} options`} className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg leading-none text-neutral-400 hover:bg-neutral-100">⋯</button>
      </div>
      {!collapsed && (<>

      {tipText && (
        <div className="mb-3 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          <span className="font-semibold text-neutral-900">🎯 Try {tipText}</span> · {tip.why}
          {lastWork.length > 0 && <span className="mt-0.5 block text-neutral-400">Last time: {lastWork.map(setText).join(' · ')}</span>}
        </div>
      )}
      {tip.kind === 'first' && <p className="mb-3 text-xs text-neutral-400">{tip.why}</p>}
      {askSets && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl bg-neutral-50 px-3 py-2" role="group" aria-label="Sets this time">
          <span className="text-sm">Last time you did {lastCount} set{lastCount === 1 ? '' : 's'}. Do {lastCount} again?</span>
          <span className="flex gap-2 text-xs">
            <button onClick={() => onSetCount(lastCount)} className="rounded-full bg-accent px-3 py-1.5 font-medium text-on-accent">Yes, {lastCount} set{lastCount === 1 ? '' : 's'}</button>
            <button onClick={onKeepSets} className="rounded-full bg-neutral-100 px-3 py-1.5 text-neutral-600">Keep {setCount}</button>
          </span>
        </div>
      )}

      {readOnly ? (
        <p className="text-sm text-neutral-500">{target || `${setCount} sets`}{warmupSets > 0 ? ` (+${warmupSets} warm-up)` : ''}. Tick the sets off on the day.</p>
      ) : (
      <div className="space-y-2">
        <div className="grid gap-2 text-xs font-medium text-neutral-500" style={{ gridTemplateColumns: cols }}>
          <span>Set</span>
          {mode === 'weight' && <span className="text-center">{units.weight}</span>}
          <span className="text-center">{mode === 'time' ? 'Seconds' : 'Reps'}</span>
          {trackRpe && <span className="text-center">RPE</span>}
          <span />
        </div>
        {sets.map((s, i) => {
          const prev = last?.sets?.[i]
          const mark = vsLast[i] ? MARK[vsLast[i]!] : null
          // Warm-ups and working sets are numbered separately: W W W, then 1 2 3.
          const warmBefore = sets.slice(0, i).filter((x) => x.warmup).length
          const label = s.warmup ? `Warm-up set ${warmBefore + 1}` : s.drop ? `Drop set ${i - firstDrop + 1}` : `Set ${i + 1 - warmBefore}`
          return (
            <div key={i} className="grid items-center gap-2" style={{ gridTemplateColumns: cols }}>
              <button
                onClick={() => setSetOpts(i)}
                aria-label={`${label} options`}
                title="Warm-up or delete"
                className={`h-8 rounded-lg bg-neutral-50 text-sm ${s.warmup ? 'font-semibold text-amber-700' : 'text-neutral-500'}`}
              >
                {s.warmup ? 'W' : s.drop ? 'D' : i + 1 - warmBefore}
                {mark && <span className={`ml-0.5 text-[10px] ${mark.c}`} aria-label={mark.l}>{mark.t}</span>}
              </button>
              {mode === 'weight' && (
                <NumberInput
                  label={`${label} ${units.weight}`}
                  value={showWeight(s.weight, units)}
                  step={units.weight === 'kg' ? 1 : 2.5}
                  placeholder={showWeight(s.warmup ? rampFor(i)?.weight ?? null : s.drop ? dropFor(i) : aim(i).weight ?? prev?.weight ?? null, units)?.toString() ?? '–'}
                  onChange={(v) => update(i, { weight: storeWeight(v, units) })}
                />
              )}
              {mode === 'time' ? (
                <div className="flex items-center gap-1">
                  <NumberInput label={`${label} seconds`} value={s.seconds ?? null} step={5} placeholder={(aim(i).seconds ?? prev?.seconds ?? targetSeconds)?.toString() ?? '–'} onChange={(v) => update(i, { seconds: v })} />
                  <button onClick={() => setTiming(i)} aria-label={`Time set ${i + 1}`} title="Time this hold" className="h-9 w-9 shrink-0 rounded-lg bg-neutral-100 text-base">⏱</button>
                </div>
              ) : (
                <NumberInput label={`${label} reps`} value={s.reps} placeholder={(s.warmup ? rampFor(i)?.reps : aim(i).reps ?? prev?.reps ?? targetReps)?.toString() ?? '–'} onChange={(v) => update(i, { reps: v })} />
              )}
              {trackRpe && <NumberInput label={`${label} RPE`} value={s.rpe ?? null} placeholder="–" onChange={(v) => update(i, { rpe: v == null ? null : Math.min(10, Math.max(1, v)) })} />}
              <button onClick={() => done(i)} aria-label={`${label} done`} aria-pressed={ticked(s)} title={ticked(s) ? 'Tap to untick' : 'Tap when done'} className={`h-10 rounded-xl text-base font-bold ${ticked(s) ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-400'}`}>✓</button>
            </div>
          )
        })}
      </div>
      )}
      {askBodyweight && (
        <div className="mt-3 rounded-xl bg-neutral-50 px-3 py-2.5" role="group" aria-label="Bodyweight exercise?">
          <p className="text-sm font-medium">0 {units.weight}: is {exercise.name} a bodyweight exercise?</p>
          <p className="mt-0.5 text-xs text-neutral-500">Then it’s logged as reps only, today and from now on.</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <button onClick={() => setExerciseMode(exercise.id, 'reps')} className="rounded-full bg-accent px-3 py-1.5 font-medium text-on-accent">Yes, bodyweight</button>
            <button onClick={() => setExerciseMode(exercise.id, 'weight')} className="rounded-full bg-neutral-100 px-3 py-1.5 text-neutral-600">No, it’s weighted</button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-neutral-500">
        {/* One more row than the card shows now (it can show more sets than planned, if the plan changed after logging). */}
        <button onClick={() => onSetCount(Math.max(setCount + 1, sets.length + 1 - warmupSets - dropSets))} className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-600">+ Add set</button>
        {beat > 0 && <span className="font-medium text-green-600">▲ Beat last time on {beat} set{beat === 1 ? '' : 's'}</span>}
      </div>
      {last?.note && <p className="mt-2 text-xs text-neutral-400">Last note: “{last.note}”</p>}
      {current?.note && !editingNote && <button onClick={() => setEditingNote(true)} className="mt-2 block text-left text-sm text-neutral-600">📝 {current.note}</button>}
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

      </>)}

      {menu && (
        <Sheet title={exercise.name} onClose={() => setMenu(false)}>
          {onSwap && menuItem('Swap exercise', onSwap)}
          {onHistory && menuItem('History', onHistory)}
          {onDropSets && mode === 'weight' && menuItem(dropSets ? 'Add another drop set' : 'Add a drop set', () => onDropSets(dropSets + 1))}
          {onNote && menuItem(current?.note ? 'Edit note' : 'Add a note', () => setEditingNote(true))}
          {barbell && menuItem(plates ? 'Hide plates' : 'Plates for this weight', () => setPlates((p) => !p))}
          {mode !== 'time' && menuItem(mode === 'weight' ? 'Track as bodyweight (reps only)' : 'Track with weight', () => setExerciseMode(exercise.id, mode === 'weight' ? 'reps' : 'weight'))}
          {readOnly && setCount > 1 && menuItem('Remove a set', () => onSetCount(setCount - 1))}
          {menuItem('Remove exercise', onRemove, true)}
        </Sheet>
      )}
      {setOpts !== null && sets[setOpts] && (() => {
        const i = setOpts
        const warm = !!sets[i].warmup
        const warmBefore = sets.slice(0, i).filter((x) => x.warmup).length
        if (sets[i].drop) return (
          <Sheet title={`Drop set ${i - firstDrop + 1}`} onClose={() => setSetOpts(null)}>
            <p className="px-3 pb-2 text-sm text-neutral-500">Straight after your last set: strip about 20% off and go to failure. Doesn’t count toward “beat last time”.</p>
            {onDeleteDrop && <button onClick={() => { onDeleteDrop(i); setSetOpts(null) }} className={`${rowBtn} text-red-600`}><span>Delete this drop set</span></button>}
          </Sheet>
        )
        return (
          <Sheet title={warm ? `Warm-up set ${warmBefore + 1}` : `Set ${i + 1 - warmBefore}`} onClose={() => setSetOpts(null)}>
            {warm || workingCount > 1 ? (
              <button onClick={() => { update(i, { warmup: !warm }); setSetOpts(null) }} className={rowBtn}>
                <span><span className="block text-sm">{warm ? 'Make it a working set' : 'Make it a warm-up'}</span><span className="block text-xs text-neutral-400">Warm-ups don’t count toward bests, volume or the sets you planned</span></span>
              </button>
            ) : (
              <p className="px-3 pb-2 text-sm text-neutral-500">This is the only working set, so it can’t be a warm-up. Add a set first.</p>
            )}
            {!warm && setCount > 1 && onDeleteSet && (
              <button onClick={() => { onDeleteSet(i); setSetOpts(null) }} className={`${rowBtn} text-red-600`}><span>Delete this set</span></button>
            )}
          </Sheet>
        )
      })()}
      {timing !== null && <HoldTimerSheet name={`${exercise.name} · set ${timing + 1}`} target={targetSeconds} onUse={(secs) => { update(timing, { seconds: secs }); setTiming(null) }} onClose={() => setTiming(null)} />}
    </div>
  )
}
