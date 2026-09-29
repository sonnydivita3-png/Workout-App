import { useState } from 'react'
import type { CardioWeek } from '../lib/cardioPlan'

interface Props {
  weeks: CardioWeek[]
  /** Formats a week's volume, e.g. "32 mi" or "6.5 h". */
  format: (v: number) => string
  /** Name of the measure for screen readers, e.g. "Weekly miles". */
  label: string
}

const W = 320
const H = 120
const PAD = { l: 4, r: 4, t: 22, b: 18 }
const PHASE: Record<CardioWeek['phase'], string> = { base: 'Base', build: 'Build', peak: 'Peak', cutback: 'Cutback', taper: 'Taper', race: 'Event week' }

/** Weekly training volume as thin bars: the shape of the plan at a glance. */
export function WeeklyVolumeChart({ weeks, format, label }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  if (weeks.length === 0) return null
  const max = Math.max(...weeks.map((w) => w.volume), 1)
  const peakIdx = weeks.reduce((best, w, i) => (w.volume > weeks[best].volume ? i : best), 0)
  const active = hover ?? peakIdx
  const slot = (W - PAD.l - PAD.r) / weeks.length
  const bar = Math.max(4, Math.min(16, slot - 2)) // thin, with a gap between bars
  const x = (i: number) => PAD.l + slot * i + (slot - bar) / 2
  const h = (v: number) => ((H - PAD.t - PAD.b) * v) / max
  const base = H - PAD.b

  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.floor(((e.clientX - r.left) / r.width) * W - PAD.l) / slot
    setHover(Math.min(weeks.length - 1, Math.max(0, Math.floor(i))))
  }

  const w = weeks[active]
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-neutral-400">Week {w.index + 1} · {PHASE[w.phase]}</span>
        <span className="tabular-nums font-medium">
          {format(w.volume)}
          {w.eventVolume ? <span className="ml-1 font-normal text-neutral-400">+ event {format(w.eventVolume)}</span> : null}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y select-none"
        role="img"
        aria-label={`${label} by week. Peak ${format(weeks[peakIdx].volume)} in week ${weeks[peakIdx].index + 1}.`}
        onPointerMove={move}
        onPointerDown={move}
        onPointerLeave={() => setHover(null)}
      >
        <line x1={PAD.l} x2={W - PAD.r} y1={base} y2={base} className="stroke-neutral-200" strokeWidth={1} />
        {weeks.map((wk, i) => {
          const bh = Math.max(1, h(wk.volume))
          const r = Math.min(4, bar / 2, bh)
          const isActive = i === active
          // Rounded data end, square at the baseline.
          const d = `M${x(i)},${base} V${base - bh + r} Q${x(i)},${base - bh} ${x(i) + r},${base - bh} H${x(i) + bar - r} Q${x(i) + bar},${base - bh} ${x(i) + bar},${base - bh + r} V${base} Z`
          return (
            <path
              key={wk.index}
              d={d}
              className={isActive ? 'fill-accent' : wk.phase === 'cutback' ? 'fill-neutral-300' : 'fill-neutral-400'}
            />
          )
        })}
        <text x={x(peakIdx) + bar / 2} y={base - h(weeks[peakIdx].volume) - 5} textAnchor="middle" className="fill-neutral-500 text-[9px]">
          {format(weeks[peakIdx].volume)}
        </text>
        <text x={PAD.l} y={H - 4} className="fill-neutral-400 text-[9px]">Wk 1</text>
        <text x={W - PAD.r} y={H - 4} textAnchor="end" className="fill-neutral-400 text-[9px]">
          {weeks.at(-1)!.phase === 'race' ? 'Event' : `Wk ${weeks.length}`}
        </text>
      </svg>
    </div>
  )
}
