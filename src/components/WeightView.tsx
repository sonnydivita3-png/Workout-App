import { useState } from 'react'
import { longDate, shortDate } from '../lib/dates'
import { weekOf } from '../lib/plan'
import { weekAverage } from '../lib/progress'
import { usePlan, useStore } from '../lib/store'
import { card, input, sectionTitle } from './ui'

/** Morning weigh-ins, and each week's average against the plan's goal. */
export function WeightView({ today }: { today: string }) {
  const plan = usePlan()
  const weights = useStore((s) => s.weights)
  const setWeight = useStore((s) => s.setWeight)
  const [date, setDate] = useState(today)
  const [text, setText] = useState(weights[today] != null ? String(weights[today]) : '')
  const lb = Number(text)
  const valid = text.trim() !== '' && Number.isFinite(lb) && lb > 50 && lb < 700
  const week = weekOf(plan, today)
  const avg = week ? weekAverage(weights, week.start) : null
  const weeks = plan.weeks.filter((w) => w.goalLb != null)
  const recent = Object.entries(weights).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Weight</h1>
      <section className={card}>
        <p className={sectionTitle}>Weigh in</p>
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (valid) setWeight(date, Math.round(lb * 10) / 10) }}>
          <label className="flex-1 text-xs text-neutral-500">Date
            <input type="date" value={date} max={today} onChange={(e) => { setDate(e.target.value); setText(weights[e.target.value] != null ? String(weights[e.target.value]) : '') }} className={`${input} mt-1`} />
          </label>
          <label className="w-24 text-xs text-neutral-500">lb
            <input inputMode="decimal" aria-label="Weight in lb" value={text} onChange={(e) => setText(e.target.value)} placeholder="lb" className={`${input} mt-1`} />
          </label>
          <button disabled={!valid} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent">Save</button>
        </form>
        {week && (
          <p className="mt-3 text-sm text-neutral-600">
            Week {week.number}: {avg != null ? <>average <b>{avg} lb</b></> : 'no weigh-ins yet'}{week.goalLb != null && <> · goal {week.goalLb} lb</>}
            {avg != null && week.goalLb != null && <span className={avg <= week.goalLb ? 'text-green-600' : 'text-amber-700'}> ({avg <= week.goalLb ? 'on track' : `${Math.round((avg - week.goalLb) * 10) / 10} lb over`})</span>}
          </p>
        )}
      </section>

      {weeks.length > 0 && <WeightChart weeks={weeks.map((w) => ({ n: w.number, goal: w.goalLb!, avg: weekAverage(weights, w.start), now: w.start <= today }))} />}

      {weeks.length > 0 && (
        <section className={card}>
          <p className={sectionTitle}>Week by week</p>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-neutral-500"><th className="py-1 font-medium">Week</th><th className="font-medium">Dates</th><th className="text-right font-medium">Goal</th><th className="text-right font-medium">My avg</th></tr></thead>
            <tbody>
              {weeks.map((w) => {
                const a = weekAverage(weights, w.start)
                return (
                  <tr key={w.number} className={`border-t border-neutral-200/70 ${week?.number === w.number ? 'font-semibold' : ''}`}>
                    <td className="py-1.5">{w.number}{w.down ? '*' : ''}</td>
                    <td className="text-neutral-600">{shortDate(w.start)}</td>
                    <td className="text-right">{w.goalLb}</td>
                    <td className={`text-right ${a == null ? 'text-neutral-400' : a <= w.goalLb! ? 'text-green-600' : 'text-amber-700'}`}>{a ?? '–'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      {recent.length > 0 && (
        <section className={card}>
          <p className={sectionTitle}>Recent weigh-ins</p>
          <ul className="divide-y divide-neutral-200/70 text-sm">
            {recent.map(([d, w]) => (
              <li key={d} className="flex items-center justify-between py-1.5">
                <span className="text-neutral-600">{longDate(d)}</span>
                <span className="flex items-center gap-3"><b>{w} lb</b>
                  <button onClick={() => setWeight(d, null)} aria-label={`Delete ${longDate(d)} weigh-in`} className="hit rounded-full px-2 text-xs text-red-600">Delete</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** Goal line and weekly averages so far. */
function WeightChart({ weeks }: { weeks: { n: number; goal: number; avg: number | null; now: boolean }[] }) {
  const vals = weeks.flatMap((w) => [w.goal, ...(w.avg != null ? [w.avg] : [])])
  const lo = Math.floor(Math.min(...vals) - 1)
  const hi = Math.ceil(Math.max(...vals) + 1)
  const W = 340
  const H = 140
  const x = (i: number) => 24 + (i / Math.max(1, weeks.length - 1)) * (W - 32)
  const y = (v: number) => 8 + ((hi - v) / (hi - lo)) * (H - 24)
  const goal = weeks.map((w, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(w.goal).toFixed(1)}`).join(' ')
  const pts = weeks.map((w, i) => (w.avg != null ? [x(i), y(w.avg)] : null)).filter((p): p is number[] => !!p)
  return (
    <section className={card} aria-label="Weight chart">
      <div className="mb-1 flex gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-neutral-400" />Goal</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent" />My weekly average</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Goal from ${weeks[0].goal} to ${weeks.at(-1)!.goal} lb`}>
        {[hi, Math.round((hi + lo) / 2), lo].map((v) => (
          <g key={v}><line x1={24} x2={W - 8} y1={y(v)} y2={y(v)} className="stroke-neutral-200" strokeWidth={1} /><text x={0} y={y(v) + 3} className="fill-neutral-500 text-[9px]">{v}</text></g>
        ))}
        <path d={goal} fill="none" className="stroke-neutral-400" strokeWidth={1.5} strokeDasharray="4 3" />
        {pts.length > 1 && <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} fill="none" className="stroke-accent-ink" strokeWidth={2} />}
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={3} className="fill-accent-ink" />)}
        <text x={24} y={H - 2} className="fill-neutral-500 text-[9px]">Wk {weeks[0].n}</text>
        <text x={W - 8} y={H - 2} textAnchor="end" className="fill-neutral-500 text-[9px]">Wk {weeks.at(-1)!.n}</text>
      </svg>
    </section>
  )
}
