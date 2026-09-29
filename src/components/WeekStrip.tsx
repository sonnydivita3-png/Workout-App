import { DAY_LABELS, toISO } from '../lib/dates'

interface Props {
  dates: Date[]
  selected: number
  counts: number[]
  /** Days explicitly marked as rest. */
  rest?: boolean[]
  today: string
  onSelect: (i: number) => void
}

export function WeekStrip({ dates, selected, counts, rest, today, onSelect }: Props) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {dates.map((d, i) => {
        const active = i === selected
        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`flex flex-col items-center rounded-xl py-2 transition ${
              active ? 'bg-accent text-on-accent' : 'text-neutral-500 hover:bg-neutral-200/60'
            }`}
          >
            <span className="text-[11px] uppercase tracking-wide">{DAY_LABELS[i]}</span>
            <span className={`text-lg font-semibold ${toISO(d) === today && !active ? 'text-neutral-900' : ''}`}>
              {d.getDate()}
            </span>
            {rest?.[i] ? (
              <span className={`text-[9px] uppercase leading-none ${active ? 'text-neutral-300' : 'text-neutral-400'}`}>rest</span>
            ) : (
              <span className={`mt-0.5 h-1 w-1 rounded-full ${counts[i] ? (active ? 'bg-surface' : 'bg-neutral-400') : 'bg-transparent'}`} />
            )}
          </button>
        )
      })}
    </div>
  )
}
