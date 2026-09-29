import { describe, expect, it } from 'vitest'
import { assignRoles, generateCardioPlan, toPlanned, type CardioPlanInput, type PlanLevel, type Role } from './cardioPlan'
import { addDays, parseISO, toISO, weekdayIndex } from './dates'

const MONDAY = '2026-09-28'
const mi = { weight: 'lb', distance: 'mi' } as const
const plan = (over: Partial<CardioPlanInput>) =>
  generateCardioPlan({ eventId: 'marathon', level: 'beginner', trainWeekdays: [1, 2, 3, 5], longDay: 5, anchorMonday: MONDAY, weeks: 18, units: mi, ...over })
const LEVELS: PlanLevel[] = ['beginner', 'intermediate', 'advanced']
const sessions = (p: ReturnType<typeof plan>, week: number) => p.days.filter((d) => d.weekIndex === week && d.role && d.role !== 'race')
const longOf = (p: ReturnType<typeof plan>, week: number) => sessions(p, week).find((d) => d.role === 'long')

describe('marathon', () => {
  it('long run builds to ~20 miles three weeks before race week, then tapers', () => {
    for (const level of LEVELS) {
      for (const weeks of [16, 18, 20]) {
        const p = plan({ level, weeks })
        const peakWeek = weeks - 4
        expect(longOf(p, peakWeek)!.miles!, `${level} ${weeks}w`).toBeGreaterThanOrEqual(19)
        expect(longOf(p, peakWeek)!.miles!).toBeLessThanOrEqual(22)
        for (let w = 0; w < peakWeek; w++) expect(longOf(p, w)!.miles!).toBeLessThanOrEqual(longOf(p, peakWeek)!.miles!)
        expect(longOf(p, weeks - 3)!.miles!).toBeLessThan(longOf(p, peakWeek)!.miles! * 0.7) // ~12 mi
        expect(longOf(p, weeks - 2)!.miles!).toBeLessThan(longOf(p, weeks - 3)!.miles!) // ~8 mi
        expect(longOf(p, weeks - 1)).toBeUndefined() // race week: the race replaces the long run
      }
    }
  })

  it('follows the classic beginner shape: start ~6 mi, peak 20 in week 15 of 18, cutbacks every 4th week', () => {
    const p = plan({})
    expect(longOf(p, 0)!.miles).toBe(6)
    expect(longOf(p, 14)!.miles).toBe(20)
    for (const w of [3, 7, 11]) expect(longOf(p, w)!.miles!, `week ${w + 1}`).toBeLessThan(longOf(p, w - 1)!.miles!)
    expect(p.weeks.filter((w) => w.phase === 'cutback').map((w) => w.index)).toEqual([3, 7, 11])
    expect(p.weeks.at(-3)!.phase).toBe('taper')
    expect(p.weeks.at(-1)!.phase).toBe('race')
  })

  it('weekly volume grows about 10% a week at most, and cutback weeks are lighter', () => {
    for (const level of LEVELS) {
      const p = plan({ level, weeks: 18 })
      let prev = 0
      for (const w of p.weeks) {
        if (w.phase === 'cutback') { expect(w.volume).toBeLessThan(prev); continue }
        if (w.phase === 'taper' || w.phase === 'race') break
        if (prev) expect(w.volume / prev, `${level} week ${w.index + 1}`).toBeLessThanOrEqual(1.16) // 12% cap + half-mile rounding
        prev = w.volume
      }
    }
  })

  it('race week has only short easy runs before race day', () => {
    const p = plan({})
    const race = p.days.at(-1)!
    expect(race.role).toBe('race')
    expect(race.miles).toBeCloseTo(26.219)
    expect(race.date).toBe(toISO(addDays(parseISO(MONDAY), 17 * 7 + 5)))
    for (const d of sessions(p, 17)) expect(d.miles!).toBeLessThanOrEqual(4)
    expect(p.weeks.at(-1)!.eventVolume).toBeCloseTo(26.219)
    expect(p.weeks.at(-1)!.volume).toBeLessThan(p.peak.volume * 0.5)
  })
})

describe('half marathon, 10K and 5K', () => {
  it('half: long run peaks ~2 weeks before race week at 10–15 miles; race week under half of peak volume', () => {
    for (const level of LEVELS) {
      const p = plan({ eventId: 'half', level, weeks: 12, trainWeekdays: [1, 3, 5], longDay: 5 })
      const peakLong = longOf(p, 12 - 3)!.miles!
      expect(peakLong).toBeGreaterThanOrEqual(10)
      expect(peakLong).toBeLessThanOrEqual(15)
      expect(p.weeks.at(-1)!.volume).toBeLessThanOrEqual(p.peak.volume * 0.5 + 0.5)
      expect(p.weeks.at(-2)!.volume).toBeLessThan(p.peak.volume * 0.8) // taper week ~65–75%
      expect(p.warnings.join()).not.toMatch(/Marathon plans/)
    }
  })
  it('10K and 5K taper for just the race week and include race-specific work at peak (not for beginners)', () => {
    for (const eventId of ['10k', '5k']) {
      const p = plan({ eventId, level: 'intermediate', weeks: 8, trainWeekdays: [1, 2, 4, 5], longDay: 5 })
      expect(p.weeks.filter((w) => w.phase === 'taper')).toHaveLength(0)
      expect(p.weeks.at(-1)!.phase).toBe('race')
      expect(p.weeks.at(-1)!.volume).toBeLessThanOrEqual(p.peak.volume * 0.6 + 0.5)
      expect(p.days.some((d) => d.title === 'Intervals')).toBe(true)
    }
    const beginner = plan({ eventId: '10k', level: 'beginner', weeks: 8, trainWeekdays: [1, 3, 5], longDay: 5 })
    expect(beginner.days.some((d) => /Intervals|Hill|Tempo/.test(d.title))).toBe(false)
  })
})

describe('structure rules', () => {
  it('the long run is the longest, on the long day only, and a modest share of the week', () => {
    for (const eventId of ['5k', '10k', 'half', 'marathon']) {
      for (const days of [[1, 3, 5], [1, 2, 3, 5], [0, 1, 3, 4, 5], [0, 1, 2, 3, 4, 5]]) {
        for (const level of LEVELS) {
          const p = plan({ eventId, level, trainWeekdays: days, longDay: 5, weeks: eventId === 'marathon' ? 18 : 12 })
          for (const w of p.weeks) {
            const s = sessions(p, w.index)
            const longs = s.filter((d) => d.role === 'long')
            if (longs.length === 0) continue
            for (const l of longs) expect(weekdayIndex(parseISO(l.date))).toBe(5)
            const max = Math.max(...s.map((d) => d.miles!))
            expect(longs[0].miles!, `${eventId} ${level} ${days} w${w.index + 1}`).toBe(max)
            expect(longs[0].miles! / (w.volume || 1)).toBeLessThanOrEqual(eventId === 'marathon' ? 0.62 : 0.6)
          }
        }
      }
    }
  })
  it('only trains your chosen days and rests the rest', () => {
    const p = plan({ trainWeekdays: [0, 2, 4, 6], longDay: 6, weeks: 12, eventId: 'half' })
    for (const d of p.days) {
      const trains = [0, 2, 4, 6].includes(weekdayIndex(parseISO(d.date)))
      if (d.role === 'race') continue
      expect(!!d.role, d.date).toBe(trains)
    }
  })
  it('no two hard days back to back (when the schedule allows it)', () => {
    for (const sport of ['run', 'bike'] as const) {
      for (const days of [[1, 3, 5], [1, 2, 3, 5], [0, 1, 3, 4, 5], [0, 1, 2, 3, 4, 5]]) {
        const roles = assignRoles(days, 5, sport)
        // A cyclist's endurance ride is easy enough to sit beside a hard day; a runner's medium-long run is not.
        const hard = new Set<Role>(sport === 'bike' ? ['long', 'quality', 'quality2'] : ['long', 'quality', 'medium', 'quality2'])
        const backToBack = [...roles].filter(([d, r]) => hard.has(r) && hard.has(roles.get((d + 1) % 7) as Role)).map(([d]) => d)
        expect(backToBack, `${sport} on ${days}`).toEqual([])
      }
    }
  })
  it('cyclists on back-to-back days still get an endurance ride, not two recovery spins', () => {
    const roles = [...assignRoles([0, 1, 3, 4], 4, 'bike').values()].sort()
    expect(roles).toEqual(['easy', 'long', 'medium', 'quality'])
  })
  it('places the hard session far from the long day, and gives 5-day runners a medium-long run and cyclists an endurance ride', () => {
    expect(assignRoles([0, 1, 3, 4, 5], 5, 'run').get(1)).toBe('quality')
    const five = [...assignRoles([0, 1, 3, 4, 5], 5, 'run').values()]
    expect(five).toContain('medium')
    expect([...assignRoles([1, 3, 5], 5, 'bike').values()].sort()).toEqual(['long', 'medium', 'quality'])
  })
})

describe('event dates and timelines', () => {
  it('ends on the event date and derives its own length', () => {
    const p = plan({ eventId: 'half', trainWeekdays: [1, 3, 5, 6], longDay: 6, raceDate: '2026-11-22', weeks: 99 })
    expect(p.weeks).toHaveLength(8)
    expect(p.days.at(-1)!.date).toBe('2026-11-22')
    expect(p.days.at(-1)!.role).toBe('race')
    expect(p.raceDate).toBe('2026-11-22')
  })
  it('schedules the event even if it falls on a non-training day, and plans nothing after it', () => {
    const p = plan({ eventId: '10k', trainWeekdays: [1, 3, 5], longDay: 5, raceDate: '2026-11-15' }) // Sunday
    expect(p.days.at(-1)).toMatchObject({ date: '2026-11-15', role: 'race' })
    expect(p.days.every((d) => d.date <= '2026-11-15')).toBe(true)
  })
  it('an event date in the past gives a warning and no plan', () => {
    const p = plan({ eventId: 'half', raceDate: '2026-09-20' })
    expect(p.days).toHaveLength(0)
    expect(p.warnings.join()).toMatch(/before the plan/)
  })
  it('starting mid-week skips the past but keeps the rest of the plan identical', () => {
    const full = plan({ eventId: 'half', weeks: 12, trainWeekdays: [1, 3, 5], longDay: 5 })
    const late = plan({ eventId: 'half', weeks: 12, trainWeekdays: [1, 3, 5], longDay: 5, fromDate: '2026-10-01' })
    expect(late.days[0].date).toBe('2026-10-01')
    expect(late.days).toEqual(full.days.filter((d) => d.date >= '2026-10-01'))
  })
  it('warns when the timeline is too short and lowers the peak instead of ramping unsafely', () => {
    const short = plan({ level: 'beginner', weeks: 8 })
    expect(short.warnings.join()).toMatch(/timeline is short/)
    expect(short.peak.longMiles).toBeLessThan(20)
    const p = short
    let prev = 0
    for (const w of p.weeks.filter((x) => x.phase !== 'taper' && x.phase !== 'race' && x.phase !== 'cutback')) {
      if (prev) expect(w.volume / prev).toBeLessThanOrEqual(1.16)
      prev = w.volume
    }
  })
  it('is deterministic', () => {
    expect(plan({ level: 'advanced', goalTime: '3:30:00' })).toEqual(plan({ level: 'advanced', goalTime: '3:30:00' }))
  })
})

describe('paces and units', () => {
  it('adds personal paces from a goal time, and effort guidance without one', () => {
    const withTime = plan({ level: 'intermediate', weeks: 16, goalTime: '3:45:00', trainWeekdays: [0, 1, 3, 4, 5] })
    expect(withTime.paces!.marathon).toBeGreaterThan(8)
    expect(withTime.paces!.marathon).toBeLessThan(9.5) // 3:45 marathon ≈ 8:35/mi
    expect(withTime.days.find((d) => d.title === 'Easy run')!.note).toMatch(/\d+:\d\d \/mi–\d+:\d\d \/mi/)
    const without = plan({ level: 'intermediate', weeks: 16 })
    expect(without.paces).toBeUndefined()
    expect(without.days.find((d) => d.title === 'Easy run')!.note).toMatch(/Conversational/)
    const bad = plan({ goalTime: '0:05' })
    expect(bad.warnings.join()).toMatch(/goal time looks off/)
  })
  it('speaks kilometres when asked', () => {
    const p = plan({ units: { weight: 'kg', distance: 'km' }, level: 'intermediate', weeks: 16, goalTime: '3:45:00' })
    const note = p.days.filter((d) => d.role).map((d) => d.note).join(' ')
    expect(note).toMatch(/km/)
    expect(note).toMatch(/\/km/)
    expect(note).not.toMatch(/\bmi\b/)
  })
})

describe('Couch to 5K', () => {
  const p = generateCardioPlan({ eventId: 'c25k', level: 'beginner', trainWeekdays: [0, 2, 4], longDay: 4, anchorMonday: MONDAY, weeks: 1, units: mi })
  it('is 9 weeks of 3 sessions with a rest day between', () => {
    expect(p.weeks).toHaveLength(9)
    for (const w of p.weeks) expect(w.sessions).toBe(3)
    const runDays = p.days.filter((d) => d.role).map((d) => weekdayIndex(parseISO(d.date)))
    expect(new Set(runDays)).toEqual(new Set([0, 2, 4]))
  })
  it('starts with 1-minute jogs and ends with 30 continuous minutes', () => {
    expect(p.days.find((d) => d.role)!.note).toMatch(/8 × \(jog 1 min, walk 90 sec\)/)
    const last = p.days.filter((d) => d.role).at(-1)!
    expect(last.note).toMatch(/jog 30 min/)
    expect(last.minutes).toBe(40) // 5 warm-up + 30 + 5 cool-down
    expect(p.days.filter((d) => d.role && d.weekIndex === 4).map((d) => d.note.match(/then (.*?), then a 5-minute/)![1])).toEqual([
      'jog 5 min, walk 3 min, jog 5 min, walk 3 min, jog 5 min', 'jog 8 min, walk 5 min, jog 8 min', 'jog 20 min',
    ])
  })
  it('has no race and never asks for more than 3 days', () => {
    expect(p.raceDate).toBeUndefined()
    const many = generateCardioPlan({ eventId: 'c25k', level: 'beginner', trainWeekdays: [0, 1, 2, 3, 4], longDay: 4, anchorMonday: MONDAY, weeks: 1, units: mi })
    expect(many.warnings.join()).toMatch(/three sessions/)
    expect(many.weeks.every((w) => w.sessions === 3)).toBe(true)
  })
})

describe('cycling', () => {
  const century = (level: PlanLevel, weeks = 16, over: Partial<CardioPlanInput> = {}) =>
    plan({ eventId: 'century', level, weeks, trainWeekdays: [1, 3, 4, 5], longDay: 5, ...over })
  it('longest ride reaches 70%+ of a century at least two weeks before the event', () => {
    for (const level of LEVELS) {
      const p = century(level)
      const longs = p.days.filter((d) => d.role === 'long')
      const peak = longs.reduce((a, b) => (b.miles! > a.miles! ? b : a))
      expect(peak.miles!, level).toBeGreaterThanOrEqual(70)
      expect(peak.miles!).toBeLessThanOrEqual(100)
      const eventWeek = p.weeks.at(-1)!.index
      expect(eventWeek - peak.weekIndex).toBeGreaterThanOrEqual(2)
    }
  })
  it('tapers for two weeks and finishes with the event', () => {
    const p = century('intermediate')
    expect(p.weeks.at(-2)!.phase).toBe('taper')
    expect(p.weeks.at(-2)!.volume).toBeLessThan(p.peak.volume * 0.75)
    const ev = p.days.at(-1)!
    expect(ev).toMatchObject({ role: 'race', miles: 100 })
    expect(ev.title).toMatch(/Event day/)
    expect(ev.minutes).toBe(Math.round((100 / 14.5) * 60))
  })
  it('metric century, 50 and 25 milers follow the ~75% long-ride rule', () => {
    for (const [eventId, miles] of [['metric', 62.14], ['ride-50', 50], ['ride-25', 25]] as const) {
      const p = plan({ eventId, level: 'intermediate', weeks: 10, trainWeekdays: [1, 3, 5], longDay: 5 })
      expect(p.peak.longMiles, eventId).toBeGreaterThanOrEqual(miles * 0.7)
      expect(p.peak.longMiles).toBeLessThanOrEqual(miles)
    }
  })
  it('uses your speed, and shows power targets when you give an FTP', () => {
    const fast = century('intermediate', 16, { speedMph: 18 })
    const slow = century('intermediate', 16, { speedMph: 12 })
    expect(fast.days.at(-1)!.minutes).toBeLessThan(slow.days.at(-1)!.minutes)
    const watts = century('intermediate', 16, { ftp: 200 })
    expect(watts.days.map((d) => d.note).join(' ')).toMatch(/176–188 W/) // sweet spot 88–94% of 200
    expect(century('intermediate').days.map((d) => d.note).join(' ')).not.toMatch(/ W\)/)
  })
  it('weekly time builds gradually with cutback weeks, and long ride share stays sane', () => {
    const p = century('intermediate')
    expect(p.weeks.filter((w) => w.phase === 'cutback').length).toBeGreaterThan(0)
    let prev = 0
    for (const w of p.weeks.filter((x) => x.phase === 'base' || x.phase === 'build' || x.phase === 'peak')) {
      if (prev) expect(w.volume / prev, `week ${w.index + 1}`).toBeLessThanOrEqual(1.25)
      prev = w.volume
    }
  })
})

describe('open-ended plans', () => {
  it('build mileage climbs toward your weekly target with no race and no taper', () => {
    const p = plan({ eventId: 'run-base', level: 'intermediate', weeks: 12, currentWeekly: 15, targetWeekly: 30, trainWeekdays: [0, 2, 4, 5], longDay: 5 })
    expect(p.days.some((d) => d.role === 'race')).toBe(false)
    expect(p.weeks.every((w) => w.phase !== 'taper' && w.phase !== 'race')).toBe(true)
    expect(p.peak.volume).toBeGreaterThanOrEqual(26)
    expect(p.weeks.at(-1)!.volume).toBeGreaterThanOrEqual(p.peak.volume * 0.95)
    expect(p.days).toHaveLength(12 * 7)
  })
  it('build fitness for cycling works too', () => {
    const p = plan({ eventId: 'bike-base', level: 'beginner', weeks: 8, trainWeekdays: [1, 3, 5], longDay: 5 })
    expect(p.days.filter((d) => d.role === 'long').length).toBe(8)
    expect(p.days.some((d) => d.role === 'race')).toBe(false)
  })
})

describe('turning a plan into Plan-tab entries', () => {
  it('maps sessions to running/cycling with minutes, distance and notes; rest days become nothing', () => {
    const p = plan({ eventId: 'half', weeks: 12, trainWeekdays: [1, 3, 5], longDay: 5 })
    const long = toPlanned(p.days.find((d) => d.role === 'long')!, 'run')!
    expect(long).toMatchObject({ exerciseId: 'running', sets: 1 })
    expect(long.distance).toBeGreaterThan(0)
    expect(long.minutes).toBeGreaterThan(0)
    expect(long.note).toMatch(/^Long run:/)
    expect(toPlanned(p.days.find((d) => !d.role)!, 'run')).toBeNull()
    const ride = toPlanned(century('intermediate').days.find((d) => d.role === 'long')!, 'bike')!
    expect(ride.exerciseId).toBe('cycling')
  })
  function century(level: PlanLevel) { return plan({ eventId: 'century', level, weeks: 16, trainWeekdays: [1, 3, 4, 5], longDay: 5 }) }
})
