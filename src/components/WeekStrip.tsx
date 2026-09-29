import { DAY_LABELS, toISO } from '../lib/dates'

interface Props {
  dates: Date[]
  selected: number
  counts: number[]
  today: string
  onSelect: (i: number) => void
}

export function WeekStrip({ dates, selected, counts, today, onSelect }: Props) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {dates.map((d, i) => {
        const active = i === selected
        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`flex flex-col items-center rounded-xl py-2 transition ${
              active ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-200/60'
            }`}
          >
            <span className="text-[11px] uppercase tracking-wide">{DAY_LABELS[i]}</span>
            <span className={`text-lg font-semibold ${toISO(d) === today && !active ? 'text-neutral-900' : ''}`}>
              {d.getDate()}
            </span>
            <span className={`mt-0.5 h-1 w-1 rounded-full ${counts[i] ? (active ? 'bg-white' : 'bg-neutral-400') : 'bg-transparent'}`} />
          </button>
        )
      })}
    </div>
  )
}
