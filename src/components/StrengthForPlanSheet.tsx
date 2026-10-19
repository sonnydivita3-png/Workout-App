import { useMemo, useState } from 'react'
import { fmtShort, mondayOf, parseISO, toISO, weekdayIndex } from '../lib/dates'
import { planSessions, strengthForPlan, type StrengthDay } from '../lib/enduranceStrength'
import { withGearFor } from '../lib/equipment'
import { activePrograms, type StackOrder } from '../lib/programs'
import { useToday } from '../lib/useToday'
import { findExercise, useStore } from '../store'
import type { PlannedExercise, WeekPhase } from '../types'
import { primaryBtn, Sheet } from './Sheet'
import { StackOrderPicker } from './StackOrderPicker'

const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PHASE: Record<WeekPhase, string> = { base: 'Base', build: 'Build', peak: 'Peak', cutback: 'Lighter week', taper: 'Taper', race: 'Race week' }
const AFTER = { hard: 'after a hard session', easy: 'after an easy one', long: '', race: '', rest: 'rest day' } as const
const CLASH = { long: 'on your long run', race: 'on race day', 'before-long': 'the day before your long run', 'before-hard': 'the day before a hard session', 'before-race': 'the day before the race' } as const

/** A strength plan made for a run/bike plan: how many sessions and how long, then a look at each week before adding it. */
export function StrengthForPlanSheet({ programId, onClose, onApplied }: { programId: string; onClose: () => void; onApplied: (first: string) => void }) {
  const { programs, overrides, custom, equipment, trainingPrefs, setTrainingPrefs, startProgram } = useStore()
  const today = useToday()
  const [perWeek, setPerWeek] = useState(2)
  // Weekdays they picked (0 = Monday), or null for the best days around their runs.
  const [picked, setPicked] = useState<number[] | null>(null)
  const togglePick = (i: number) => setPicked((cur) => {
    const next = cur?.includes(i) ? cur.filter((x) => x !== i) : [...(cur ?? []), i].sort()
    return next.length ? next : null
  })
  const [minutes, setMinutes] = useState(45)
  const [order, setOrder] = useState<StackOrder | undefined>(trainingPrefs.stackOrder)
  const [open, setOpen] = useState<number | null>(0)
  const plan = programs.find((p) => p.id === programId)
  const sport = plan?.sport ?? 'run'
  const days = useMemo(
    () => (plan ? withGearFor(equipment, () => strengthForPlan({ sessions: planSessions(plan, overrides).filter((s) => s.date >= today), sport, from: today, perWeek, minutes, days: picked ?? undefined })) : []),
    [plan, overrides, today, equipment, sport, perWeek, minutes, picked],
  )
  if (!plan) return null

  const ride = sport === 'bike'
  const lifting = activePrograms(programs, today).find((p) => p.kind === 'program')
  const shared = days.filter((d) => d.after !== 'rest').length
  const weeks = [...new Set(days.map((d) => d.weekIndex))]
  const planWeeks = new Set(planSessions(plan, overrides).filter((s) => s.date >= today).map((s) => toISO(mondayOf(parseISO(s.date))))).size
  const name = (id: string) => findExercise(custom, id)?.name ?? id
  const n = picked?.length ?? perWeek
  const clashes = days.filter((d) => d.clash)
  // Fewer than asked for in a building week: there weren't enough days that work around the runs.
  const most = Math.max(0, ...weeks.filter((w) => ['base', 'build'].includes(days.find((d) => d.weekIndex === w)!.phase)).map((w) => days.filter((d) => d.weekIndex === w).length))
  const run = ride ? 'ride' : 'run'
  const dose = (p: PlannedExercise) => `${p.sets} × ${p.seconds ? `${p.seconds}s` : p.reps}`

  const apply = () => {
    if (shared > 0 && order) setTrainingPrefs({ stackOrder: order })
    startProgram(Object.fromEntries(days.map((d) => [d.date, d.items])), `Strength for ${plan.title}`, today, plan.id)
    onApplied(days[0].date)
    onClose()
  }

  return (
    <Sheet title={`Strength for ${plan.title}`} onClose={onClose} closeLabel="Cancel">
      <ul className="mb-4 space-y-1.5 text-sm text-neutral-600">
        <li>• {ride ? 'Heavy legs, single-leg work and core: what research shows makes pedalling more economical. No jumping.' : 'Heavy legs, calves, single-leg work, hops and core: what research shows makes running more economical and your legs more robust.'}</li>
        <li>• {n} a week while you build, fewer near race time (one a week keeps the strength), none in race week.</li>
        {n > 2 && <li>• Sessions past two are upper body and core, so your legs stay fresh for {ride ? 'riding' : 'running'}.</li>}
        <li>• {picked ? `On the days you pick. Heavy legs are best not the day before your long ${run} or a hard session; you’ll see where that happens.` : `Never the day before your long ${run} or a hard session; usually after a hard one, so easy days stay easy.`}</li>
        <li>• Sets stop a couple of reps short of failure, so your {ride ? 'riding' : 'running'} doesn’t suffer.</li>
      </ul>

      <h3 className="mb-2 text-sm font-semibold text-neutral-700">Days</h3>
      <button onClick={() => setPicked(null)} aria-pressed={!picked} className={`mb-2 ${chip(!picked)}`}>Best days around my {run}s</button>
      <div role="group" aria-label="Strength days" className="mb-1 grid grid-cols-7 gap-1">
        {DAY_NAMES.map((l, i) => (
          <button key={l} onClick={() => togglePick(i)} aria-pressed={!!picked?.includes(i)} className={`rounded-xl py-2 text-sm ${picked?.includes(i) ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-500'}`}>{l}</button>
        ))}
      </div>
      <p className="mb-4 text-xs text-neutral-400">{picked ? `${n} a week, on the days you picked.` : 'Or pick the days that suit you.'}</p>
      {!picked && (
        <>
          <h3 className="mb-2 text-sm font-semibold text-neutral-700">Sessions a week (base and build)</h3>
          <div className="mb-4 flex gap-2">
            {[1, 2, 3, 4].map((k) => <button key={k} onClick={() => setPerWeek(k)} aria-pressed={perWeek === k} className={chip(perWeek === k)}>{k}</button>)}
          </div>
        </>
      )}
      <h3 className="mb-2 text-sm font-semibold text-neutral-700">Length</h3>
      <div className="mb-4 flex gap-2">
        {[30, 45, 60].map((m) => <button key={m} onClick={() => setMinutes(m)} aria-pressed={minutes === m} className={chip(minutes === m)}>{m} min</button>)}
      </div>

      {days.length === 0 ? (
        <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">There’s no room left for strength in this plan (it’s race week, or the plan has ended).</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-neutral-500">{days.length} sessions over {planWeeks} weeks · about {minutes} min</p>
          {!picked && most < n && (
            <p className="mb-2 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-500">Only {most} a week fit around your {run}s without heavy legs the day before a long {run} or hard session. Pick the days yourself to fit more.</p>
          )}
          {clashes.length > 0 && (
            <p role="note" className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {clashes.length} leg session{clashes.length === 1 ? ' falls' : 's fall'} on or the day before a long {run}, hard session or race (marked ⚠). Heavy legs then can take the edge off that {run}; another day may work better.
            </p>
          )}
          <ul aria-label="Strength weeks" className="mb-4 divide-y divide-neutral-100 rounded-2xl bg-neutral-50 px-3">
            {weeks.map((w) => {
              const list = days.filter((d) => d.weekIndex === w)
              const isOpen = open === w
              return (
                <li key={w} className="py-2.5">
                  <button onClick={() => setOpen(isOpen ? null : w)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-2 text-left text-sm">
                    <span><span className="font-medium">{fmtShort(list[0].date)}</span><span className="ml-2 text-xs text-neutral-400">{PHASE[list[0].phase]}</span></span>
                    <span className="text-xs text-neutral-400">{list.map((d) => `${when(d)}${d.clash ? ' ⚠' : ''}`).join(', ')} {isOpen ? '⌃' : '⌄'}</span>
                  </button>
                  {isOpen && list.map((d) => (
                    <div key={d.date} className="mt-2 rounded-xl bg-surface px-3 py-2 text-xs text-neutral-600">
                      <p className="mb-1 font-medium text-neutral-700">{when(d)} · {d.name}{AFTER[d.after ?? 'rest'] ? ` · ${AFTER[d.after ?? 'rest']}` : ''}</p>
                      {d.clash && <p className="mb-1 text-amber-700">⚠ {CLASH[d.clash].replace('long run', `long ${run}`)}</p>}
                      {d.items.map((p) => <p key={p.exerciseId}>{name(p.exerciseId)} <span className="text-neutral-400">{dose(p)}</span></p>)}
                    </div>
                  ))}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {lifting && <p className="mb-3 text-xs text-neutral-500">Replaces your current lifting plan “{lifting.title}” from today on.</p>}
      {days.length > 0 && shared > 0 && <StackOrderPicker value={order} onChange={setOrder} sport={sport} days={shared} />}
      <button onClick={apply} disabled={days.length === 0 || (shared > 0 && !order)} className={primaryBtn}>Add strength plan</button>
    </Sheet>
  )
}

const when = (d: StrengthDay) => `${DAY_NAMES[weekdayIndex(parseISO(d.date))]} ${parseISO(d.date).getDate()}`
