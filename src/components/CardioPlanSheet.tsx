import { useMemo, useState } from 'react'
import { eventsFor, findEvent } from '../lib/cardioEvents'
import { generateCardioPlan, type CardioPlan, type PlanLevel } from '../lib/cardioPlan'
import { addDays, fmtShort, mondayOf, parseISO, toISO, weekdayIndex } from '../lib/dates'
import { cardioWeekdays } from '../lib/program'
import { activePrograms } from '../lib/programs'
import { dayPlanOf } from '../lib/plan'
import { distanceFactor, formatMinutes, formatPace, showDistance, speedUnit, storeDistance } from '../lib/units'
import { useToday } from '../lib/useToday'
import { useStore } from '../store'
import type { Sport } from '../types'
import { NumberInput } from './NumberInput'
import { primaryBtn, Sheet } from './Sheet'
import { WeeklyVolumeChart } from './WeeklyVolumeChart'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PHASE_LABEL = { base: 'Base', build: 'Build', peak: 'Peak', cutback: 'Cutback', taper: 'Taper', race: 'Event week' } as const
const LEVELS: { id: PlanLevel; label: string; blurb: Record<Sport, string> }[] = [
  { id: 'beginner', label: 'Beginner', blurb: { run: 'New to this distance, or under about 15 miles a week.', bike: 'Riding casually, or under about 4 hours a week.' } },
  { id: 'intermediate', label: 'Intermediate', blurb: { run: 'Running regularly, around 20–30 miles a week.', bike: 'Riding regularly, around 5–7 hours a week.' } },
  { id: 'advanced', label: 'Advanced', blurb: { run: 'Experienced, 35+ miles a week.', bike: 'Experienced, 8+ hours a week.' } },
]

const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`
const h3 = 'mb-2 text-sm font-semibold text-neutral-700'

interface Props {
  onClose: () => void
  onApplied: (firstDate: string) => void
}

export function CardioPlanSheet({ onClose, onApplied }: Props) {
  const { units, plan: weeklyPlan, overrides, goals, programs, startCardioProgram, addGoal } = useStore()
  const today = useToday()
  const [sport, setSport] = useState<Sport>('run')
  const [eventId, setEventId] = useState('10k')
  const [level, setLevel] = useState<PlanLevel>('beginner')
  const [weeks, setWeeks] = useState<number | null>(null)
  const [raceDate, setRaceDate] = useState('')
  const [days, setDays] = useState<number[]>(cardioWeekdays(4))
  const [longDay, setLongDay] = useState(5)
  const [current, setCurrent] = useState<number | null>(null)
  const [target, setTarget] = useState<number | null>(null)
  const [goalTime, setGoalTime] = useState('')
  const [speed, setSpeed] = useState<number | null>(null)
  const [ftp, setFtp] = useState<number | null>(null)
  const [when, setWhen] = useState<'this' | 'next'>('next')
  const [result, setResult] = useState<CardioPlan | null>(null)
  const [addRaceGoal, setAddRaceGoal] = useState(true)
  const [replace, setReplace] = useState(false)
  const [stopOld, setStopOld] = useState(true)
  const [openWeek, setOpenWeek] = useState<number | null>(0)
  const [openDay, setOpenDay] = useState<string | null>(null)

  const events = eventsFor(sport)
  const ev = findEvent(eventId) ?? events[0]
  const c25k = ev.id === 'c25k'
  const openEnded = !ev.miles
  const chosenWeeks = weeks ?? ev.weeks[Math.floor(ev.weeks.length / 2)]
  const factor = distanceFactor(units)
  const dUnit = units.distance

  const monday = mondayOf(parseISO(today))
  const anchorMonday = toISO(when === 'this' ? monday : addDays(monday, 7))
  const fromDate = when === 'this' ? today : anchorMonday
  const dateOk = !raceDate || raceDate >= fromDate

  const pickSport = (s: Sport) => {
    setSport(s)
    const first = eventsFor(s).find((e) => e.id === (s === 'run' ? '10k' : 'ride-50'))!
    setEventId(first.id)
    setWeeks(null)
    setRaceDate('')
  }
  const pickEvent = (id: string) => {
    setEventId(id)
    setWeeks(null)
    if (id === 'c25k') { setDays([0, 2, 4]); setLongDay(4) }
  }
  const toggleDay = (d: number) => setDays((cur) => {
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()
    if (!next.includes(longDay) && next.length) setLongDay(next.at(-1)!)
    return next
  })
  const preset = (n: number) => { const d = cardioWeekdays(n); setDays(d); setLongDay(d.includes(5) ? 5 : d.at(-1)!) }

  const build = () => {
    const speedMph = sport === 'bike' && speed ? speed / factor : undefined
    setResult(generateCardioPlan({
      eventId: ev.id, level, trainWeekdays: days, longDay, anchorMonday, fromDate, weeks: chosenWeeks,
      raceDate: raceDate && ev.miles && !c25k ? raceDate : undefined,
      currentWeekly: current ? (sport === 'run' ? storeDistance(current, units)! : current) : undefined,
      targetWeekly: target ? (sport === 'run' ? storeDistance(target, units)! : target) : undefined,
      goalTime: sport === 'run' && goalTime.trim() && !openEnded ? goalTime.trim() : undefined,
      speedMph, ftp: sport === 'bike' && ftp ? ftp : undefined, units,
    }))
    setOpenWeek(0)
    setOpenDay(null)
  }

  // Running plans count distance; cycling and Couch to 5K (time-based) count hours.
  const byDistance = sport === 'run' && !c25k
  const volume = (v: number) => (byDistance ? `${showDistance(v, units)} ${dUnit}` : `${Math.round(v * 10) / 10} h`)
  const sessions = useMemo(() => result?.days.filter((d) => d.role) ?? [], [result])

  // ---------------------------------------------------------------- form
  if (!result) {
    return (
      <Sheet title="Training plan" onClose={onClose} closeLabel="Cancel">
        <p className="mb-4 text-sm text-neutral-500">Build a run or bike plan for a goal or race. It’s added to your calendar and can be stopped or replaced any time.</p>

        <div className="mb-4 flex gap-2">
          <button onClick={() => pickSport('run')} className={chip(sport === 'run')}>Running</button>
          <button onClick={() => pickSport('bike')} className={chip(sport === 'bike')}>Cycling</button>
        </div>

        <h3 className={h3}>Goal</h3>
        <div className="mb-5 flex flex-wrap gap-2">
          {events.map((e) => <button key={e.id} onClick={() => pickEvent(e.id)} className={chip(e.id === ev.id)}>{e.label}</button>)}
        </div>

        {!c25k && (
          <>
            <h3 className={h3}>Your level</h3>
            <div className="mb-1 flex flex-wrap gap-2">
              {LEVELS.map((l) => <button key={l.id} onClick={() => setLevel(l.id)} className={chip(l.id === level)}>{l.label}</button>)}
            </div>
            <p className="mb-5 text-xs text-neutral-400">{LEVELS.find((l) => l.id === level)!.blurb[sport]}</p>
          </>
        )}

        <h3 className={h3}>Timeline</h3>
        {c25k ? (
          <p className="mb-5 text-sm text-neutral-500">9 weeks, 3 sessions a week with a rest day between. It alternates jogging and walking until you can run 30 minutes.</p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {ev.weeks.map((wk) => <button key={wk} onClick={() => { setWeeks(wk); setRaceDate('') }} className={chip(!raceDate && chosenWeeks === wk)}>{wk} weeks</button>)}
            </div>
            {!openEnded && (
              <label className="mb-1 block text-sm text-neutral-500">
                Or pick your event date
                <input type="date" value={raceDate} min={fromDate} onChange={(e) => setRaceDate(e.target.value)} className="mt-1 block w-full rounded-lg bg-neutral-100 px-3 py-2 text-neutral-900 outline-none" />
              </label>
            )}
            <p className="mb-5 text-xs text-neutral-400">
              {raceDate ? (dateOk ? 'The plan builds back from your event date.' : 'That date is before the plan would start.') : 'Weeks are counted from the start date below; the event is on your long-day of the final week.'}
            </p>
          </>
        )}

        <h3 className={h3}>Start</h3>
        <div className="mb-5 flex gap-2">
          <button onClick={() => setWhen('this')} className={chip(when === 'this')}>This week</button>
          <button onClick={() => setWhen('next')} className={chip(when === 'next')}>Next week</button>
        </div>

        <h3 className={h3}>Training days</h3>
        {!c25k && (
          <div className="mb-2 flex flex-wrap gap-2">
            {[2, 3, 4, 5, 6].map((n) => <button key={n} onClick={() => preset(n)} className={chip(days.join() === cardioWeekdays(n).join())}>{n} days</button>)}
          </div>
        )}
        <div className="mb-2 grid grid-cols-7 gap-1.5">
          {DAY_NAMES.map((l, i) => (
            <button key={l} onClick={() => toggleDay(i)} aria-pressed={days.includes(i)} className={`rounded-xl py-2 text-sm ${days.includes(i) ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-500'}`}>{l}</button>
          ))}
        </div>
        {!c25k && days.length > 1 && (
          <div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            Long {sport === 'run' ? 'run' : 'ride'} on
            {days.map((d) => <button key={d} onClick={() => setLongDay(d)} className={chip(d === longDay)}>{DAY_NAMES[d]}</button>)}
          </div>
        )}
        <p className="mb-5 text-xs text-neutral-400">{days.length} training day{days.length === 1 ? '' : 's'} a week; the rest are rest days.</p>

        {!c25k && (
          <>
            <h3 className={h3}>Optional details</h3>
            <div className="mb-5 grid grid-cols-2 gap-3">
              <label className="block text-sm text-neutral-500">
                {sport === 'run' ? `Current ${dUnit} / week` : 'Current hours / week'}
                <div className="mt-1"><NumberInput value={current} step={sport === 'run' ? 1 : 0.5} placeholder="typical" onChange={setCurrent} /></div>
              </label>
              {openEnded && (
                <label className="block text-sm text-neutral-500">
                  {sport === 'run' ? `Target ${dUnit} / week` : 'Target hours / week'}
                  <div className="mt-1"><NumberInput value={target} step={sport === 'run' ? 1 : 0.5} placeholder="auto" onChange={setTarget} /></div>
                </label>
              )}
              {sport === 'run' && !openEnded && (
                <label className="block text-sm text-neutral-500">
                  Goal finish time
                  <input value={goalTime} onChange={(e) => setGoalTime(e.target.value)} placeholder="h:mm:ss" inputMode="numeric" className="mt-1 w-full rounded-lg bg-neutral-100 px-2 py-2 text-center outline-none placeholder:text-neutral-400" />
                </label>
              )}
              {sport === 'bike' && (
                <>
                  <label className="block text-sm text-neutral-500">
                    Average speed ({speedUnit(units)})
                    <div className="mt-1"><NumberInput value={speed} step={0.5} placeholder="auto" onChange={setSpeed} /></div>
                  </label>
                  <label className="block text-sm text-neutral-500">
                    FTP (watts)
                    <div className="mt-1"><NumberInput value={ftp} step={5} placeholder="optional" onChange={setFtp} /></div>
                  </label>
                </>
              )}
            </div>
            {sport === 'run' && !openEnded && <p className="-mt-3 mb-5 text-xs text-neutral-400">A goal time gives you personal easy, tempo and interval paces. Leave it blank to train by effort.</p>}
          </>
        )}

        <button disabled={days.length === 0 || !dateOk} onClick={build} className={primaryBtn}>Build my plan</button>
      </Sheet>
    )
  }

  // ---------------------------------------------------------------- preview
  const { paces } = result
  const trainingWeeks = result.weeks
  const byWeek = (i: number) => sessions.filter((d) => d.weekIndex === i)
  const clashes = new Set(sessions.filter((d) => dayPlanOf(weeklyPlan, overrides, d.date).length > 0).map((d) => d.date)).size
  const lastDate = sessions.at(-1)?.date
  const running = activePrograms(programs, today).filter((p) => p.kind === 'cardio' && p.sport === sport)
  const goalLabel = c25k ? '5K' : ev.label
  const goalDate = result.raceDate ?? (c25k ? lastDate : undefined)
  const goalExists = goals.some((g) => g.type === 'race' && g.label === goalLabel && g.date === goalDate)

  const apply = () => {
    let goalId = goals.find((g) => g.type === 'race' && g.label === goalLabel && g.date === goalDate)?.id
    if (addRaceGoal && ev.miles && !goalExists) goalId = addGoal({ type: 'race', sport, label: goalLabel, distance: c25k ? 3.107 : ev.miles, ...(goalDate ? { date: goalDate } : {}) })
    startCardioProgram({ sessions, sport, title: `${ev.label} plan`, goalId, replace, stopSame: stopOld && running.length > 0, today })
    onApplied(sessions[0].date)
    onClose()
  }

  return (
    <Sheet title={`Your ${ev.label} plan`} onClose={onClose} closeLabel="Close">
      {sessions.length === 0 ? (
        <>
          {result.warnings.map((w) => <p key={w} className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{w}</p>)}
          <button onClick={() => setResult(null)} className={primaryBtn}>Change settings</button>
        </>
      ) : (
        <>
          <p className="mb-1 text-sm text-neutral-500">
            {trainingWeeks.length} weeks · {sessions.length} sessions · busiest week {volume(result.peak.volume)}
            {result.peak.longMiles && !c25k ? ` · longest ${sport === 'run' ? 'run' : 'ride'} ${showDistance(result.peak.longMiles, units)} ${dUnit}` : ''}
          </p>
          {result.raceDate && <p className="mb-3 text-sm text-neutral-500">{ev.label} on {fmtShort(result.raceDate)}</p>}

          {result.warnings.map((w) => <p key={w} className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{w}</p>)}

          {paces && (
            <div className="mb-4 rounded-2xl bg-neutral-50 p-3 text-sm">
              <p className="mb-1 text-sm font-semibold text-neutral-700">Your training paces</p>
              <ul className="space-y-0.5 tabular-nums text-neutral-600">
                <li>Easy <span className="float-right">{formatPace(1, paces.easy[1], units)} – {formatPace(1, paces.easy[0], units)}</span></li>
                <li>Marathon pace <span className="float-right">{formatPace(1, paces.marathon, units)}</span></li>
                <li>Tempo <span className="float-right">{formatPace(1, paces.threshold, units)}</span></li>
                <li>Intervals (5K effort) <span className="float-right">{formatPace(1, paces.interval, units)}</span></li>
              </ul>
              <p className="mt-2 text-xs text-neutral-400">Estimated from your goal time with Jack Daniels’ VDOT tables. Treat them as a guide and adjust by feel.</p>
            </div>
          )}

          <div className="mb-4"><WeeklyVolumeChart weeks={trainingWeeks} format={(v) => volume(v)} label={byDistance ? `Weekly ${dUnit}` : 'Weekly hours'} /></div>

          <ul className="mb-4 divide-y divide-neutral-100 rounded-2xl bg-neutral-50 px-3">
            {trainingWeeks.map((wk) => {
              const isOpen = openWeek === wk.index
              return (
                <li key={wk.index} className="py-2.5">
                  <button onClick={() => setOpenWeek(isOpen ? null : wk.index)} aria-expanded={isOpen} className="flex w-full items-center justify-between text-left text-sm">
                    <span><span className="font-medium">Week {wk.index + 1}</span><span className="ml-2 text-xs text-neutral-400">{PHASE_LABEL[wk.phase]}</span></span>
                    <span className="text-xs tabular-nums text-neutral-400">{volume(wk.volume)}{wk.eventVolume ? ` + event` : ''} {isOpen ? '⌃' : '⌄'}</span>
                  </button>
                  {isOpen && (
                    <ul className="mt-1 space-y-0.5">
                      {byWeek(wk.index).map((d) => {
                        const open = openDay === d.date
                        return (
                          <li key={d.date}>
                            <button onClick={() => setOpenDay(open ? null : d.date)} className="flex w-full items-baseline justify-between gap-2 py-1.5 text-left text-sm">
                              <span className="min-w-0"><span className="text-neutral-400">{DAY_NAMES[weekdayIndex(parseISO(d.date))]} {parseISO(d.date).getDate()}</span><span className="ml-2">{d.title}</span></span>
                              <span className="shrink-0 text-xs tabular-nums text-neutral-400">{d.miles ? `${showDistance(d.miles, units)} ${dUnit} · ` : ''}{formatMinutes(d.minutes)}</span>
                            </button>
                            {open && <p className="mb-1 rounded-xl bg-surface px-3 py-2 text-xs text-neutral-500">{d.note}</p>}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>

          {ev.miles && (
            <label className="mb-2 flex items-center gap-3 text-sm">
              <input type="checkbox" checked={addRaceGoal && !goalExists} disabled={goalExists} onChange={(e) => setAddRaceGoal(e.target.checked)} className="h-4 w-4" />
              {goalExists ? 'You already have a goal for this event' : `Add “${goalLabel}${goalDate ? ' · ' + fmtShort(goalDate) : ''}” to my goals`}
            </label>
          )}
          {running.length > 0 && (
            <label className="mb-2 flex items-center gap-3 text-sm">
              <input type="checkbox" checked={stopOld} onChange={(e) => setStopOld(e.target.checked)} className="h-4 w-4" />
              Stop my current {running[0].title} and replace it
            </label>
          )}
          <label className="mb-3 flex items-center gap-3 text-sm">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="h-4 w-4" />
            Replace exercises already planned on these days
          </label>
          <p className="mb-4 text-xs text-neutral-400">
            Adds {sessions.length} {sport === 'run' ? 'runs' : 'rides'} to your calendar.
            {clashes > 0 && (replace ? ` ${clashes} day${clashes === 1 ? '' : 's'} with other exercises will be replaced.` : ` ${clashes} day${clashes === 1 ? '' : 's'} already have exercises; those are kept alongside.`)}
            {' '}Rest days are left as they are.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setResult(null)} className="flex-1 rounded-2xl bg-neutral-100 py-3 text-sm font-medium">Change settings</button>
            <button onClick={apply} className="flex-1 rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent">Add to my plan</button>
          </div>
        </>
      )}
    </Sheet>
  )
}
