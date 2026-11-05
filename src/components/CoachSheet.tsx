import { useMemo, useRef, useState } from 'react'
import { addDays, DAY_LABELS, parseISO, toISO } from '../lib/dates'
import { BODY_PARTS } from '../lib/bodyParts'
import { bodyweightOn } from '../lib/calories'
import {
  bestLiftSince, e1rmOf, estimate, EXPERIENCE, GOAL_KINDS, MOVE_FOCUS, planWeeks, TEST_LIFTS, WEIGHT_DISCLAIMER,
  type CoachAnswers, type CoachGoal, type Experience, type GoalEstimate, type GoalKind, type MoveFocus,
} from '../lib/coach'
import { defaultWeekdays } from '../lib/program'
import { showWeight, storeWeight } from '../lib/units'
import { useModal } from '../lib/useModal'
import { useToday } from '../lib/useToday'
import { useStore } from '../store'
import { buildCoachBlock, coachTitle, finishText, GOAL_LABEL, goalText } from './coachBuild'
import { EquipmentPicker } from './EquipmentPicker'
import { NumberInput } from './NumberInput'
import { primaryBtn, secondaryBtn } from './Sheet'
import { LikedCardioPicker, LikedStylesPicker } from './TrainingPrefsPicker'
import { chipBtn } from './ui'

type Step = 'intro' | 'goals' | 'lose' | 'muscle' | 'strength' | 'move' | 'experience' | 'days' | 'minutes' | 'styles' | 'cardio' | 'areas' | 'gear' | 'weight' | 'plan'

const card = (on: boolean) => `flex w-full min-h-14 items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left ring-1 ${on ? 'bg-accent/15 ring-accent-ink' : 'bg-surface ring-neutral-200/70'}`

/**
 * Durata's trainer, first session: one question a screen (goals, the details of each, experience, schedule, what they
 * like, focus areas, equipment), then a plan that runs as long as the goals take, with weekly check-ins.
 */
export function CoachSheet({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const today = useToday()
  const units = s.units
  const panel = useRef<HTMLDivElement>(null)
  useModal(panel, onClose)
  const lbNow = bodyweightOn(s.bodyweight, today)

  const [kinds, setKinds] = useState<GoalKind[]>([])
  const [weight, setWeight] = useState<number | null>(lbNow)
  const [loseLb, setLoseLb] = useState<number | null>(null)
  const [muscleLb, setMuscleLb] = useState<number | null>(null)
  const [areas, setAreas] = useState<string[]>([])
  const [lift, setLift] = useState(TEST_LIFTS[0].id)
  const best = (id: string) => bestLiftSince(s.logs, id, toISO(addDays(parseISO(today), -90)))
  const [liftNow, setLiftNow] = useState<{ weight: number | null; reps: number | null }>({ weight: null, reps: null })
  const [liftTarget, setLiftTarget] = useState<number | null>(null)
  const [focus, setFocus] = useState<MoveFocus[]>(['posture', 'mobility'])
  const [experience, setExperience] = useState<Experience>(s.logs.length > 60 ? 'some' : 'new')
  const [days, setDays] = useState<number[]>(defaultWeekdays(4))
  const [minutes, setMinutes] = useState(60)
  const [understood, setUnderstood] = useState(false)
  const [i, setI] = useState(0)

  const has = (k: GoalKind) => kinds.includes(k)
  const weighty = has('lose') || has('muscle')
  const steps: Step[] = [
    'intro', 'goals',
    ...(has('lose') ? ['lose' as const] : []), ...(has('muscle') ? ['muscle' as const] : []),
    ...(has('strength') ? ['strength' as const] : []), ...(has('move') ? ['move' as const] : []),
    'experience', 'days', 'minutes', 'styles', 'cardio', ...(has('muscle') ? [] : ['areas' as const]), 'gear',
    ...(weighty ? ['weight' as const] : []), 'plan',
  ]
  const step = steps[Math.min(i, steps.length - 1)]

  // Pounds from what they type (their units).
  const lb = (v: number | null) => (v == null ? null : storeWeight(v, units)!)
  const shown = (v: number | null) => (v == null ? null : showWeight(v, units))
  const liftStart = liftNow.weight && liftNow.reps ? e1rmOf({ weight: lb(liftNow.weight)!, reps: liftNow.reps }) : best(lift)
  const goals: CoachGoal[] = kinds.map((k): CoachGoal => {
    switch (k) {
      case 'lose': return { kind: 'lose', lb: lb(loseLb) ?? 0 }
      case 'muscle': return { kind: 'muscle', lb: lb(muscleLb), areas }
      case 'strength': return { kind: 'strength', exerciseId: lift, targetLb: lb(liftTarget) ?? 0, startLb: liftStart ?? 0 }
      case 'move': return { kind: 'move', focus }
    }
  })
  const answers: CoachAnswers = { goals, experience, days, minutes, areas, startLb: weight ?? lbNow }

  const ok: Record<Step, boolean> = {
    intro: true, goals: kinds.length > 0,
    lose: !!weight && !!loseLb && loseLb > 0 && lb(loseLb)! < (weight ?? 0) * 0.5,
    muscle: true,
    strength: !!liftStart && !!liftTarget && lb(liftTarget)! > 0,
    move: focus.length > 0, experience: true, days: days.length >= 2, minutes: true, styles: true, cardio: true, areas: true, gear: true,
    weight: understood, plan: true,
  }
  const why: Partial<Record<Step, string>> = {
    goals: 'Pick at least one goal.', lose: 'Add your weight and how much to lose (at most half of it).',
    strength: 'Add a recent set (or log the lift first) and the max you want.', move: 'Pick at least one.', days: 'Two days a week at least.',
    weight: 'Tick the box to carry on.',
  }

  // The plan, built when they reach the last screen.
  const built = useMemo(() => (step === 'plan' ? buildCoachBlock(useStore.getState(), answers, { minutes: 0, volume: 0 }, today) : null), [step]) // eslint-disable-line react-hooks/exhaustive-deps
  const est: GoalEstimate[] = built ? estimate(answers, built.weeklyBurn) : []
  const weeks = built ? planWeeks(est) : 0

  const start = () => {
    if (!built) return
    if (weight && weight !== lbNow) s.logBodyweight(today, weight)
    s.startCoach({ startDate: today, answers, weeks, blockEnd: built.blockEnd, adjust: { minutes: 0, volume: 0 }, checkins: [] }, built.overrides, coachTitle(answers, GOAL_LABEL), today)
    onClose()
  }
  const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])

  const body = (() => {
    switch (step) {
      case 'intro':
        return (
          <>
            <h2 className="mb-2 text-2xl font-semibold tracking-tight">Let’s build your plan</h2>
            <p className="mb-3 text-neutral-600">I’m your Durata trainer. A few questions, one at a time, then you get a plan that runs as long as your goal takes.</p>
            <p className="text-neutral-600">Every week I’ll check in on how it’s going and adjust the plan to what your body is actually doing.</p>
          </>
        )
      case 'goals':
        return (
          <>
            <Q title="What do you want to reach?" sub="Pick one or more. The first you pick leads the plan." />
            <div className="space-y-2">
              {GOAL_KINDS.map((g) => {
                const n = kinds.indexOf(g.kind)
                return (
                  <button key={g.kind} aria-pressed={n >= 0} onClick={() => setKinds((k) => toggle(k, g.kind))} className={card(n >= 0)}>
                    <span><span className="block font-medium">{g.label}</span><span className="block text-sm text-neutral-500">{g.blurb}</span></span>
                    {n >= 0 && <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent">{['1st', '2nd', '3rd', '4th'][n]}</span>}
                  </button>
                )
              })}
            </div>
          </>
        )
      case 'lose':
        return (
          <>
            <Q title="How much do you want to lose?" sub="A pace you can keep (and keep muscle at) is up to about 1% of your weight a week." />
            <Field label={`Your weight now (${units.weight})`}><NumberInput label="Your weight now" value={shown(weight)} onChange={(v) => setWeight(lb(v))} step={0.5} /></Field>
            <Field label={`How much to lose (${units.weight})`}><NumberInput label="How much to lose" value={loseLb} onChange={setLoseLb} step={1} /></Field>
          </>
        )
      case 'muscle':
        return (
          <>
            <Q title="Where do you want to build?" sub="These get more work each week. Pick none for all-over." />
            <Chips options={BODY_PARTS} on={areas} toggle={(p) => setAreas((a) => toggle(a, p))} label="Areas to build" />
            <Field label={`Muscle to gain, if you have a number (${units.weight})`}><NumberInput label="Muscle to gain" value={muscleLb} onChange={setMuscleLb} placeholder="Not sure" /></Field>
          </>
        )
      case 'strength': {
        const logged = best(lift)
        return (
          <>
            <Q title="Which lift, and what number?" sub="Progress is tracked as your estimated one-rep max, from the sets you log." />
            <div role="radiogroup" aria-label="Lift" className="mb-4 grid grid-cols-2 gap-2">
              {TEST_LIFTS.map((l) => <button key={l.id} role="radio" aria-checked={lift === l.id} onClick={() => setLift(l.id)} className={chipBtn(lift === l.id)}>{l.label}</button>)}
            </div>
            <p className="mb-2 text-sm text-neutral-600">{logged ? `From your logs: an estimated max of about ${Math.round(shown(logged)!)} ${units.weight}. Or enter a recent best set:` : 'A recent best set (weight × reps):'}</p>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <NumberInput label={`Best set weight (${units.weight})`} value={liftNow.weight} onChange={(w) => setLiftNow((x) => ({ ...x, weight: w }))} placeholder={units.weight} />
              <NumberInput label="Best set reps" value={liftNow.reps} onChange={(r) => setLiftNow((x) => ({ ...x, reps: r }))} placeholder="reps" />
            </div>
            <Field label={`One-rep max you want (${units.weight})`}><NumberInput label="Target one-rep max" value={liftTarget} onChange={setLiftTarget} step={5} /></Field>
          </>
        )
      }
      case 'move':
        return (
          <>
            <Q title="What does moving better mean for you?" sub="Pick all that matter." />
            <div className="space-y-2">
              {MOVE_FOCUS.map((m) => (
                <button key={m.id} aria-pressed={focus.includes(m.id)} onClick={() => setFocus((f) => toggle(f, m.id))} className={card(focus.includes(m.id))}>
                  <span><span className="block font-medium">{m.label}</span><span className="block text-sm text-neutral-500">{m.blurb}</span></span>
                </button>
              ))}
            </div>
          </>
        )
      case 'experience':
        return (
          <>
            <Q title="How long have you been training?" sub="It sets how fast you can expect to progress." />
            <div role="radiogroup" aria-label="Experience" className="space-y-2">
              {EXPERIENCE.map((e) => (
                <button key={e.id} role="radio" aria-checked={experience === e.id} onClick={() => setExperience(e.id)} className={card(experience === e.id)}>
                  <span><span className="block font-medium">{e.label}</span><span className="block text-sm text-neutral-500">{e.blurb}</span></span>
                </button>
              ))}
            </div>
          </>
        )
      case 'days':
        return (
          <>
            <Q title="Which days can you train?" sub="Pick the days you can really keep. Three or four is plenty for most goals." />
            <div role="group" aria-label="Training days" className="grid grid-cols-7 gap-1">
              {DAY_LABELS.map((d, n) => <button key={d} aria-pressed={days.includes(n)} onClick={() => setDays((x) => toggle(x, n).sort())} className={`${chipBtn(days.includes(n))} px-0`}>{d}</button>)}
            </div>
          </>
        )
      case 'minutes':
        return (
          <>
            <Q title="How long is a session?" sub="Warm-up included." />
            <div role="radiogroup" aria-label="Session length" className="grid grid-cols-3 gap-2">
              {[30, 45, 60, 75, 90].map((m) => <button key={m} role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)} className={chipBtn(minutes === m)}>{m} min</button>)}
            </div>
          </>
        )
      case 'styles':
        return <><Q title="What kinds of workout do you enjoy?" sub="The plan leans towards these. Skip if you’re not sure." /><LikedStylesPicker /></>
      case 'cardio':
        return <><Q title="Any cardio you like?" sub="Your cardio days use these." /><LikedCardioPicker /></>
      case 'areas':
        return (
          <>
            <Q title="Any areas you want extra work on?" sub="Optional: these get a few more sets a week." />
            <Chips options={BODY_PARTS} on={areas} toggle={(p) => setAreas((a) => toggle(a, p))} label="Focus areas" />
          </>
        )
      case 'gear':
        return <><Q title="Where do you train?" sub="Only exercises you have the equipment for." /><EquipmentPicker detailed={false} /></>
      case 'weight':
        return (
          <>
            <Q title="How weight change works" />
            <div className="space-y-3 text-sm text-neutral-700">{WEIGHT_DISCLAIMER.map((t) => <p key={t}>{t}</p>)}</div>
            <label className="mt-4 flex min-h-12 items-center gap-3 rounded-2xl bg-neutral-100 px-4 py-3 text-sm">
              <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="h-5 w-5" />
              I understand Durata covers the training side only
            </label>
          </>
        )
      case 'plan': {
        const end = toISO(addDays(parseISO(today), weeks * 7))
        const week = (built?.days ?? []).filter((d) => d.date < toISO(addDays(parseISO(today), 7)))
        return (
          <>
            <Q title="Your plan" sub={`${weeks} weeks, to about ${finishText(end, today)}. Check-ins every week adjust it.`} />
            <ul className="mb-4 space-y-2">
              {est.map((e) => (
                <li key={e.goal.kind} className="rounded-2xl bg-surface px-4 py-3 ring-1 ring-neutral-200/70">
                  <p className="font-medium">{goalText(e.goal, units)}</p>
                  <p className="text-sm text-neutral-500">{e.weeks ? `About ${e.weeks} weeks` : 'More than two years on training alone'} · {e.rate}</p>
                </li>
              ))}
            </ul>
            {est.some((e) => e.goal.kind === 'lose' && (!e.weeks || e.weeks > 26)) && (
              <p className="mb-4 rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
                Training alone is a slow way to lose weight: this plan burns about {Math.round((built?.weeklyBurn ?? 0) / 100) * 100} calories a week.
                More days, longer sessions or more cardio help a little; eating a little less is the big lever, and every check-in will show your real pace.
              </p>
            )}
            <h3 className="mb-2 text-sm font-semibold text-neutral-600">Your first week</h3>
            <ul className="space-y-1 text-sm">
              {week.map((d) => <li key={d.date} className="flex justify-between gap-3"><span>{DAY_LABELS[(parseISO(d.date).getDay() + 6) % 7]}</span><span className="text-neutral-500">{d.rest ? 'Rest' : d.name}</span></li>)}
            </ul>
          </>
        )
      }
    }
  })()

  const last = step === 'plan'
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-page">
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Your trainer" tabIndex={-1} className="mx-auto flex min-h-full max-w-md flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] outline-none">
        <div className="mb-5 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200" aria-hidden><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
          <button onClick={onClose} className="min-h-11 rounded-full px-3 text-sm font-medium text-neutral-500">Close</button>
        </div>
        <div className="flex-1">{body}</div>
        <div className="mt-6 space-y-2">
          {!ok[step] && why[step] && <p role="status" className="text-center text-xs text-neutral-500">{why[step]}</p>}
          <button disabled={!ok[step]} onClick={() => (last ? start() : setI((n) => Math.min(n + 1, steps.length - 1)))} className={primaryBtn}>
            {step === 'intro' ? 'Let’s start' : last ? 'Start my plan' : 'Next'}
          </button>
          {i > 0 && <button onClick={() => setI((n) => n - 1)} className={`${secondaryBtn} w-full`}>Back</button>}
        </div>
      </div>
    </div>
  )
}

const Q = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="mb-4"><h2 className="text-2xl font-semibold tracking-tight">{title}</h2>{sub && <p className="mt-1 text-neutral-600">{sub}</p>}</div>
)
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="mb-4"><p className="mb-1 text-sm font-medium text-neutral-700">{label}</p>{children}</div>
)
function Chips({ options, on, toggle, label }: { options: readonly string[]; on: string[]; toggle: (x: string) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="mb-4 flex flex-wrap gap-2">
      {options.map((o) => <button key={o} aria-pressed={on.includes(o)} onClick={() => toggle(o)} className={chipBtn(on.includes(o))}>{o}</button>)}
    </div>
  )
}

