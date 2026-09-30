import { DAY_LABELS, toISO } from '../lib/dates'

interface Props {
  dates: Date[]
  selected: number
  counts: number[]
  /** One-word summary per day (e.g. "Legs", "Run"). */
  labels?: string[]
  /** Days with something logged. */
  done?: boolean[]
  /** Days explicitly marked as rest. */
  rest?: boolean[]
  today: string
  onSelect: (i: number) => void
}

export function WeekStrip({ dates, selected, counts, labels, done, rest, today, onSelect }: Props) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {dates.map((d, i) => {
        const active = i === selected
        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            aria-label={`${d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}${rest?.[i] ? ', rest day' : labels?.[i] ? `, ${labels[i]}` : counts[i] ? `, ${counts[i]} exercises` : ''}${done?.[i] ? ', done' : ''}`}
            aria-pressed={active}
            className={`flex min-w-0 flex-col items-center rounded-xl py-2 transition ${
              active ? 'bg-accent text-on-accent' : 'text-neutral-500 hover:bg-neutral-200/60'
            }`}
          >
            <span className="text-[11px] uppercase tracking-wide">{DAY_LABELS[i]}</span>
            <span className={`text-lg font-semibold ${toISO(d) === today && !active ? 'text-neutral-900' : ''}`}>
              {d.getDate()}
            </span>
            <span className={`h-3.5 max-w-full truncate px-0.5 text-[10px] leading-3.5 ${active ? '' : rest?.[i] ? 'text-neutral-400' : 'text-neutral-500'}`}>
              {done?.[i] ? '✓ ' : ''}{rest?.[i] ? 'Rest' : labels?.[i] || (counts[i] ? '•' : '')}
            </span>
          </button>
        )
      })}
    </div>
  )
}
