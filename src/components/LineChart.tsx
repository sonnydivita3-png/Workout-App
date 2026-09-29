import { useRef, useState } from 'react'

export interface Point {
  date: string // YYYY-MM-DD
  y: number
}

interface Props {
  points: Point[]
  format: (y: number) => string
  label: string
  refLine?: { y: number; label: string } // e.g. a goal
}

const W = 320
const H = 170
const PAD = { l: 44, r: 14, t: 12, b: 24 }

const fmtDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export function LineChart({ points, format, label, refLine }: Props) {
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  if (points.length === 0) return null

  const active = hover ?? points.length - 1
  const t = points.map((p) => new Date(p.date + 'T00:00:00').getTime())
  const t0 = t[0]
  const span = t[t.length - 1] - t0
  const ys = [...points.map((p) => p.y), ...(refLine ? [refLine.y] : [])]
  let lo = Math.min(...ys)
  let hi = Math.max(...ys)
  if (lo === hi) { lo -= 1; hi += 1 }
  const pad = (hi - lo) * 0.12
  lo -= pad
  hi += pad

  const x = (i: number) => (span === 0 ? (PAD.l + W - PAD.r) / 2 : PAD.l + ((t[i] - t0) / span) * (W - PAD.l - PAD.r))
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b)
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad]
  const path = points.map((_, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(points[i].y).toFixed(1)}`).join('')

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    let best = 0
    points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i })
    setHover(best)
  }

  const ax = x(active)

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-neutral-400">{fmtDate(points[active].date)}</span>
        <span className="tabular-nums font-medium">{format(points[active].y)}</span>
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y select-none"
        role="img"
        aria-label={`${label}: ${points.map((p) => `${fmtDate(p.date)} ${format(p.y)}`).join(', ')}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="stroke-neutral-200" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" className="fill-neutral-400 text-[9px]">
              {format(v)}
            </text>
          </g>
        ))}
        <text x={PAD.l} y={H - 6} className="fill-neutral-400 text-[9px]">{fmtDate(points[0].date)}</text>
        {points.length > 1 && (
          <text x={W - PAD.r} y={H - 6} textAnchor="end" className="fill-neutral-400 text-[9px]">
            {fmtDate(points[points.length - 1].date)}
          </text>
        )}
        {refLine && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(refLine.y)} y2={y(refLine.y)} className="stroke-neutral-400" strokeWidth={1} strokeDasharray="4 3" />
            <text x={W - PAD.r} y={y(refLine.y) - 4} textAnchor="end" className="fill-neutral-500 text-[9px]">{refLine.label}</text>
          </g>
        )}
        <line x1={ax} x2={ax} y1={PAD.t} y2={H - PAD.b} className="stroke-neutral-300" strokeWidth={1} />
        {points.length > 1 && <path d={path} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((_, i) => (
          <circle key={i} cx={x(i)} cy={y(points[i].y)} r={i === active ? 5 : 4} className="fill-accent stroke-surface" strokeWidth={2} />
        ))}
      </svg>
    </div>
  )
}
