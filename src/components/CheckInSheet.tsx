import { useState } from 'react'
import { addDays, parseISO, toISO } from '../lib/dates'
import { bodyweightOn } from '../lib/calories'
import { bestLiftSince, e1rmOf, planWeeks, review, sessionsIn, TEST_LIFTS, type CheckIn, type Review } from '../lib/coach'
import { showWeight, storeWeight } from '../lib/units'
import { useToday } from '../lib/useToday'
import { useStore } from '../store'
import { buildCoachBlock, coachTitle, GOAL_LABEL, goalText, planBurn } from './coachBuild'
import { NumberInput } from './NumberInput'
import { primaryBtn, secondaryBtn, Sheet } from './Sheet'
import { chipBtn } from './ui'

const SCALE = [1, 2, 3, 4, 5]

/**
 * The weekly check-in with the trainer: how many sessions happened (from the logs), progress on each goal (a weigh-in,
 * the best set on the test lift, how moving feels), energy and soreness. Then what changes and why, before it's saved.
 */
export function CheckInSheet({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const today = useToday()
  const plan = s.coach!
  const a = plan.answers
  const units = s.units
  const since = plan.checkins.at(-1)?.date ?? plan.startDate
  const program = s.programs.find((p) => p.id === plan.programId)
  const { planned, done } = sessionsIn(program, s.logs, since, today)
  const strength = a.goals.find((g) => g.kind === 'strength')
  const liftLabel = strength?.kind === 'strength' ? TEST_LIFTS.find((l) => l.id === strength.exerciseId)?.label ?? 'your lift' : ''
  const logged = strength?.kind === 'strength' ? bestLiftSince(s.logs, strength.exerciseId, since) : null
  const weighs = a.goals.some((g) => g.kind === 'lose' || g.kind === 'muscle')
  const recent = s.bodyweight.filter((b) => b.date >= toISO(addDays(parseISO(today), -2))).at(-1)

  const [weight, setWeight] = useState<number | null>(recent ? showWeight(recent.lb, units) : null)
  const [lift, setLift] = useState<{ weight: number | null; reps: number | null }>({ weight: null, reps: null })
  const [moveScore, setMoveScore] = useState<number | null>(null)
  const [energy, setEnergy] = useState(3)
  const [soreness, setSoreness] = useState(2)
  const [result, setResult] = useState<{ r: Review; c: CheckIn } | null>(null)

  const weightLb = weight == null ? null : storeWeight(weight, units)
  const typedLift = lift.weight && lift.reps ? { weight: storeWeight(lift.weight, units)!, reps: lift.reps } : null
  const weekNo = Math.floor((parseISO(today).getTime() - parseISO(plan.startDate).getTime()) / (7 * 86400000))

  const check = () => {
    const weights = [
      ...(a.startLb ? [{ date: plan.startDate, lb: a.startLb }] : []),
      ...s.bodyweight.filter((b) => b.date > plan.startDate && b.date < today),
      ...(weightLb ? [{ date: today, lb: weightLb }] : bodyweightOn(s.bodyweight, today) && s.bodyweight.some((b) => b.date === today) ? [{ date: today, lb: bodyweightOn(s.bodyweight, today)! }] : []),
    ]
    const liftNow = logged ?? (typedLift ? e1rmOf(typedLift) : null)
    const c: Omit<CheckIn, 'notes'> = {
      date: today, weightLb, lift: typedLift ?? (logged ? { weight: logged, reps: 1 } : null), moveScore, energy, soreness, done, planned,
    }
    const r = review(plan, c, { weights, weeklyBurn: planBurn(s, plan, today), liftNow })
    setResult({ r, c: { ...c, notes: r.notes } })
  }

  const save = () => {
    if (!result) return
    const { r, c } = result
    if (weightLb) s.logBodyweight(today, weightLb)
    const weeks = Math.min(104, weekNo + planWeeks(r.estimates))
    const tomorrow = toISO(addDays(parseISO(today), 1))
    // The plan changed, its block ends within the week, or another plan replaced it: the next weeks are rebuilt.
    const active = !!program && program.entries.some((e) => e.date >= tomorrow)
    if (r.rebuild || !active || plan.blockEnd <= toISO(addDays(parseISO(today), 7))) {
      const built = buildCoachBlock(useStore.getState(), a, r.adjust, tomorrow)
      s.coachCheckIn(c, { adjust: r.adjust, weeks, blockEnd: built.blockEnd, days: built.overrides, title: coachTitle(a, GOAL_LABEL) }, tomorrow)
    } else s.coachCheckIn(c, { adjust: r.adjust, weeks }, today)
    onClose()
  }

  if (result) {
    return (
      <Sheet title={`Week ${Math.max(1, weekNo)} check-in`} onClose={onClose} closeLabel="Cancel"
        footer={<><button onClick={save} className={primaryBtn}>Save and update my plan</button><button onClick={() => setResult(null)} className={`${secondaryBtn} mt-2 w-full`}>Back</button></>}>
        <h3 className="mb-2 font-semibold">What changes, and why</h3>
        <ul className="mb-4 space-y-2 text-sm">{result.r.notes.map((n) => <li key={n} className="rounded-2xl bg-neutral-50 px-3 py-2">{n}</li>)}</ul>
        <h3 className="mb-2 font-semibold">Where you’re headed</h3>
        <ul className="space-y-1 text-sm">
          {result.r.estimates.map((e) => (
            <li key={e.goal.kind} className="flex justify-between gap-3"><span>{goalText(e.goal, units)}</span><span className="shrink-0 text-neutral-500">{e.weeks ? `~${e.weeks} weeks to go` : 'not on training alone'}</span></li>
          ))}
        </ul>
      </Sheet>
    )
  }

  return (
    <Sheet title={`Week ${Math.max(1, weekNo)} check-in`} onClose={onClose} closeLabel="Cancel" footer={<button onClick={check} className={primaryBtn}>Review my week</button>}>
      <p className="mb-4 rounded-2xl bg-neutral-50 px-3 py-2 text-sm">{planned ? `You did ${done} of ${planned} planned sessions since the last check-in.` : 'No sessions were planned since the last check-in.'}</p>
      {weighs && (
        <Block title={`Weigh-in today (${units.weight})`} sub="Same time of day each week, ideally in the morning.">
          <NumberInput label="Weigh-in" value={weight} onChange={setWeight} step={0.5} />
        </Block>
      )}
      {strength && (
        <Block title={`Best set on ${liftLabel} this week`} sub={logged ? `From your logs: estimated max ${Math.round(showWeight(logged, units)!)} ${units.weight}.` : 'Log it on the workout, or enter it here.'}>
          {!logged && (
            <div className="grid grid-cols-2 gap-2">
              <NumberInput label={`Weight (${units.weight})`} value={lift.weight} onChange={(w) => setLift((x) => ({ ...x, weight: w }))} placeholder={units.weight} />
              <NumberInput label="Reps" value={lift.reps} onChange={(r) => setLift((x) => ({ ...x, reps: r }))} placeholder="reps" />
            </div>
          )}
        </Block>
      )}
      {a.goals.some((g) => g.kind === 'move') && <Scale title="How does moving feel?" low="Stiff" high="Great" value={moveScore} onChange={setMoveScore} />}
      <Scale title="Energy this week" low="Drained" high="Great" value={energy} onChange={setEnergy} />
      <Scale title="Soreness" low="Fresh" high="Very sore" value={soreness} onChange={setSoreness} />
    </Sheet>
  )
}

const Block = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
  <div className="mb-4"><p className="font-medium">{title}</p>{sub && <p className="mb-2 text-xs text-neutral-500">{sub}</p>}{children}</div>
)
function Scale({ title, low, high, value, onChange }: { title: string; low: string; high: string; value: number | null; onChange: (n: number) => void }) {
  return (
    <div className="mb-4">
      <p className="mb-2 font-medium">{title}</p>
      <div role="radiogroup" aria-label={title} className="grid grid-cols-5 gap-1">
        {SCALE.map((n) => <button key={n} role="radio" aria-checked={value === n} aria-label={`${n} of 5`} onClick={() => onChange(n)} className={`${chipBtn(value === n)} px-0`}>{n}</button>)}
      </div>
      <div className="mt-1 flex justify-between text-xs text-neutral-500"><span>{low}</span><span>{high}</span></div>
    </div>
  )
}
