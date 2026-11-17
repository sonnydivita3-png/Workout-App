import { useState } from 'react'
import { shortDate } from '../lib/dates'
import { notesOn, phaseOf, workoutOn } from '../lib/plan'
import { usePlan } from '../lib/store'
import { card, sectionTitle } from './ui'

/** The plan's reference pages: strength workouts by phase, the routine, the effort guide and the notes for now. */
export function PlanView({ today }: { today: string }) {
  const plan = usePlan()
  const date = today < plan.start ? plan.start : today > plan.end ? plan.end : today
  const phase = phaseOf(plan, date)
  const notes = notesOn(plan, date)
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl">Plan</h1>
        {phase && <p className="text-sm text-neutral-500">Now: {phase.name}{phase.summary ? `. ${phase.summary}` : ''}</p>}
      </header>

      {Object.keys(plan.workouts).map((key) => <WorkoutTables key={key} id={key} date={date} />)}

      {plan.routine && (
        <section className={card}>
          <p className={sectionTitle}>{plan.routine.name}{plan.routine.minutes ? ` · ${plan.routine.minutes} min` : ''}</p>
          {plan.routine.when && <p className="mb-2 text-sm text-neutral-500">{plan.routine.when}</p>}
          <ol className="list-decimal space-y-1 pl-5 text-sm">{plan.routine.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </section>
      )}

      {plan.effort && (
        <section className={card}>
          <p className={sectionTitle}>Effort guide</p>
          <dl className="space-y-2 text-sm">
            {plan.effort.map((e) => <div key={e.term}><dt className="font-semibold">{e.term}</dt><dd className="text-neutral-600">{e.meaning}</dd></div>)}
          </dl>
        </section>
      )}

      {notes.map((n) => (
        <section key={`${n.title}-${n.start ?? ''}`} className={card}>
          <p className={sectionTitle}>{n.title}{n.start && n.end ? ` · ${shortDate(n.start)}–${shortDate(n.end)}` : ''}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">{n.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
        </section>
      ))}

      {plan.phases.length > 0 && (
        <section className={card}>
          <p className={sectionTitle}>Phases</p>
          <ul className="space-y-2 text-sm">
            {plan.phases.map((p) => (
              <li key={p.name} className={p === phase ? 'font-semibold' : ''}>
                {p.name} <span className="font-normal text-neutral-500">{shortDate(p.start)}–{shortDate(p.end)}</span>
                {p.summary && <p className="font-normal text-neutral-600">{p.summary}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** One workout's exercises, for the phase that's on now, or any other phase. */
function WorkoutTables({ id, date }: { id: string; date: string }) {
  const plan = usePlan()
  const now = workoutOn(plan, id, date)
  const [pick, setPick] = useState<number | null>(null)
  if (!now) return null
  const { workout } = now
  const version = pick != null ? workout.versions[pick] : now.version
  return (
    <section className={card} aria-label={workout.name}>
      <p className="font-semibold text-strength">{workout.name}{workout.focus ? ` · ${workout.focus}` : ''}</p>
      {workout.versions.length > 1 && (
        <div role="tablist" aria-label={`${workout.name} phase`} className="my-2 flex flex-wrap gap-1.5">
          {workout.versions.map((v, i) => (
            <button key={v.label} role="tab" aria-selected={v === version} onClick={() => setPick(i)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${v === version ? 'bg-neutral-900 text-surface' : 'bg-neutral-100 text-neutral-600'}`}>
              {v.label}{v === now.version ? ' (now)' : ''}
            </button>
          ))}
        </div>
      )}
      <p className="mb-1 text-xs text-neutral-500">{shortDate(version.start)}–{shortDate(version.end)}{version.note ? ` · ${version.note}` : ''}</p>
      <table className="w-full text-sm">
        <tbody>
          {version.exercises.map((e) => (
            <tr key={e.name} className="border-t border-neutral-200/70"><td className="py-1.5 pr-2">{e.name}</td><td className="whitespace-nowrap text-right text-neutral-600">{e.prescription}</td></tr>
          ))}
        </tbody>
      </table>
      {workout.notes && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-neutral-500">{workout.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
    </section>
  )
}
