import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { ExerciseLog } from '../types'
import { addDays, parseISO, toISO, weekdayIndex } from './dates'
import { applyProgression, defaultWeekdays, generateProgram, majorGroupsLogged, MAJOR_GROUPS, PROGRAM_GOALS, rerollDay, type ProgramGoal, type ProgramInput } from './program'
import { minutesFor } from './randomizer'
import { mulberry32 } from './randomUtil'

const MONDAY = '2026-09-28'
const GOALS = PROGRAM_GOALS.map((g) => g.id)
const base = (over: Partial<ProgramInput> = {}): ProgramInput => ({
  anchorMonday: MONDAY, weeks: 1, trainWeekdays: [0, 2, 4], goal: 'muscle', minutes: 45, rng: mulberry32(1), ...over,
})
const majors = (groups: string[]) => groups.filter((g) => MAJOR_GROUPS.includes(g))

describe('recovery: never the same major muscle two days in a row', () => {
  const patterns = [[0, 1], [0, 1, 2], [0, 1, 3, 4], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5, 6], [1, 2, 4, 5, 6], [0, 6], [3, 4, 5, 6, 0]]
  it('holds for every goal, day pattern, length and seed', () => {
    let checked = 0
    for (const goal of GOALS) {
      for (const trainWeekdays of patterns) {
        for (const weeks of [1, 4]) {
          for (let seed = 1; seed <= 12; seed++) {
            const days = generateProgram(base({ goal, trainWeekdays, weeks, rng: mulberry32(seed * 97 + weeks) }))
            for (let i = 1; i < days.length; i++) {
              if (days[i].rest || days[i - 1].rest) continue
              const shared = majors(days[i].groups).filter((g) => majors(days[i - 1].groups).includes(g))
              expect(shared, `${goal} ${trainWeekdays} w${weeks} seed ${seed}: ${days[i - 1].name} → ${days[i].name} on ${days[i].date}`).toEqual([])
              checked++
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(5000)
  })

  it('also holds across a week boundary (Sunday → Monday)', () => {
    for (const goal of GOALS) {
      const days = generateProgram(base({ goal, trainWeekdays: [0, 6], weeks: 4, rng: mulberry32(5) }))
      const sunMon = days.filter((d, i) => !d.rest && weekdayIndex(parseISO(d.date)) === 0 && i > 0 && !days[i - 1].rest)
      expect(sunMon.length).toBeGreaterThan(0)
      for (const d of sunMon) {
        const prev = days[days.indexOf(d) - 1]
        expect(majors(d.groups).filter((g) => majors(prev.groups).includes(g))).toEqual([])
      }
    }
  })

  it('respects what was actually trained the day before the plan starts', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const days = generateProgram(base({ goal: 'muscle', trainWeekdays: [0, 1, 2], prevDayGroups: ['Legs', 'Glutes'], rng: mulberry32(seed) }))
      expect(majors(days[0].groups)).not.toContain('Legs')
      expect(majors(days[0].groups)).not.toContain('Glutes')
    }
  })

  it('skips a heavy conflict by using a cardio day when nothing else fits', () => {
    // Everything but cardio hits Legs, Chest, Back, Shoulders somewhere; after a full-body day only cardio is allowed.
    const days = generateProgram(base({ goal: 'muscle', trainWeekdays: [0, 1], prevDayGroups: ['Chest', 'Back', 'Shoulders', 'Legs', 'Glutes'], rng: mulberry32(2) }))
    expect(days[0].name).toBe('Cardio')
  })
})

describe('schedule', () => {
  it('trains exactly the chosen weekdays and rests the rest', () => {
    for (const trainWeekdays of [[0, 2, 4], [1, 3], [0, 1, 2, 3, 4, 5]]) {
      const days = generateProgram(base({ trainWeekdays, weeks: 4 }))
      expect(days).toHaveLength(28)
      for (const d of days) {
        const trains = trainWeekdays.includes(weekdayIndex(parseISO(d.date)))
        expect(d.rest).toBe(!trains)
        expect(d.items.length > 0).toBe(trains)
      }
      expect(days.filter((d) => !d.rest)).toHaveLength(trainWeekdays.length * 4)
    }
  })

  it('a week starts on the anchor and dates are consecutive', () => {
    const days = generateProgram(base({ weeks: 4 }))
    expect(days[0].date).toBe(MONDAY)
    days.forEach((d, i) => expect(d.date).toBe(toISO(addDays(parseISO(MONDAY), i))))
    expect(days.map((d) => d.weekIndex)).toEqual(days.map((_, i) => Math.floor(i / 7)))
  })

  it('planning mid-week leaves the past alone', () => {
    const days = generateProgram(base({ fromDate: '2026-10-01', trainWeekdays: [0, 1, 2, 3, 4, 5, 6] })) // Thursday
    expect(days[0].date).toBe('2026-10-01')
    expect(days).toHaveLength(4) // Thu, Fri, Sat, Sun
  })

  it('every session fits the requested length', () => {
    for (const goal of GOALS) {
      for (const minutes of [30, 45, 60, 90]) {
        for (const d of generateProgram(base({ goal, minutes, trainWeekdays: [0, 1, 2, 3, 4, 5, 6], rng: mulberry32(minutes) })).filter((x) => !x.rest)) {
          expect(minutesFor(d.items), `${goal} ${minutes} ${d.name}`).toBeLessThanOrEqual(minutes + 8)
        }
      }
    }
  })
})

describe('coverage and variety', () => {
  it('a 4-day muscle plan trains every major group each week', () => {
    let full = 0
    const runs = 60
    for (let seed = 1; seed <= runs; seed++) {
      const days = generateProgram(base({ goal: 'muscle', trainWeekdays: [0, 1, 3, 4], weeks: 1, rng: mulberry32(seed) }))
      const trained = new Set(days.flatMap((d) => majors(d.groups)))
      if (MAJOR_GROUPS.every((g) => trained.has(g))) full++
    }
    expect(full / runs).toBeGreaterThan(0.9)
  })

  it('3 days a week is mostly full-body, 5 days is split by body part', () => {
    const avgGroups = (n: number) => {
      let sum = 0, count = 0
      for (let seed = 1; seed <= 30; seed++) for (const d of generateProgram(base({ goal: 'muscle', trainWeekdays: defaultWeekdays(n), weeks: 1, rng: mulberry32(seed) })).filter((x) => !x.rest)) { sum += majors(d.groups).length; count++ }
      return sum / count
    }
    expect(avgGroups(3)).toBeGreaterThan(avgGroups(5))
  })

  it('does not repeat the same exercises session after session', () => {
    let overlap = 0, pairs = 0
    for (let seed = 1; seed <= 20; seed++) {
      const days = generateProgram(base({ goal: 'fitness', trainWeekdays: [0, 2, 4], weeks: 4, rng: mulberry32(seed) })).filter((d) => !d.rest)
      for (let i = 1; i < days.length; i++) {
        const a = new Set(days[i - 1].items.map((p) => p.exerciseId))
        const shared = days[i].items.filter((p) => a.has(p.exerciseId)).length
        overlap += shared / Math.max(1, days[i].items.length)
        pairs++
      }
    }
    expect(overlap / pairs).toBeLessThan(0.15)
  })

  it('fat-loss plans lean on circuits and cardio, strength plans on heavy lifts', () => {
    const styles = (goal: ProgramGoal) => generateProgram(base({ goal, trainWeekdays: [0, 1, 2, 3, 4, 5], weeks: 4, rng: mulberry32(9) })).filter((d) => !d.rest).map((d) => d.style)
    const fat = styles('fatloss')
    expect(fat.filter((s) => s === 'circuit' || s === 'pha').length / fat.length).toBeGreaterThan(0.4)
    const strong = styles('strength')
    expect(strong.filter((s) => s === 'strength').length / strong.length).toBeGreaterThan(0.6)
  })

  it('a Hyrox / CrossFit plan uses those formats', () => {
    const styles = new Set(generateProgram(base({ goal: 'functional', trainWeekdays: [0, 2, 4, 5], weeks: 4, rng: mulberry32(4) })).filter((d) => !d.rest).map((d) => d.style))
    expect(styles.has('hyrox') || styles.has('crossfit')).toBe(true)
  })
})

describe('progression (4-week block)', () => {
  const items = () => [{ exerciseId: 'Barbell_Deadlift', sets: 3, reps: 5, est: 8.5 }, { exerciseId: 'running', sets: 1, minutes: 20 }, { exerciseId: 'x-burpee', sets: 4, block: 'circuit', note: '40s on / 20s off' }]
  it('adds a set in week 3 and deloads in week 4, leaving blocks and cardio alone', () => {
    expect(applyProgression(items(), 0, 4)).toEqual(items())
    expect(applyProgression(items(), 1, 4)).toEqual(items())
    const w3 = applyProgression(items(), 2, 4)
    expect(w3[0].sets).toBe(4)
    expect(w3[0].est).toBeGreaterThan(items()[0].est!) // one more set takes longer
    expect(w3[1]).toEqual(items()[1])
    expect(w3[2]).toEqual(items()[2])
    expect(applyProgression(items(), 3, 4)[0].sets).toBe(2)
  })
  it('does nothing for one-week plans', () => {
    expect(applyProgression(items(), 2, 1)).toEqual(items())
  })
  it('is applied in generated month plans', () => {
    const days = generateProgram(base({ goal: 'strength', trainWeekdays: [0, 2, 4], weeks: 4, rng: mulberry32(3) })).filter((d) => !d.rest)
    const avgSets = (w: number) => { const it = days.filter((d) => d.weekIndex === w).flatMap((d) => d.items).filter((p) => p.reps); return it.reduce((a, p) => a + p.sets, 0) / it.length }
    expect(avgSets(2)).toBeGreaterThan(avgSets(0))
    expect(avgSets(3)).toBeLessThan(avgSets(0))
  })
})

describe('helpers', () => {
  it('rerolls a day into a different workout of the same type', () => {
    const day = generateProgram(base({ goal: 'muscle', trainWeekdays: [0] }))[0]
    const again = rerollDay(day, 45, 1, new Set(day.items.map((p) => p.exerciseId)), mulberry32(99))
    expect(again.name).toBe(day.name)
    expect(again.items.map((p) => p.exerciseId)).not.toEqual(day.items.map((p) => p.exerciseId))
  })
  it('reads yesterday\'s muscle groups from the log', () => {
    const logs: ExerciseLog[] = [
      { date: '2026-09-27', exerciseId: 'Barbell_Deadlift', sets: [{ weight: 100, reps: 5 }] },
      { date: '2026-09-27', exerciseId: 'Plank', sets: [{ weight: null, reps: null, seconds: 30 }] },
      { date: '2026-09-27', exerciseId: 'Pushups', sets: [{ weight: null, reps: null }] }, // nothing logged
      { date: '2026-09-26', exerciseId: 'Leg_Press', sets: [{ weight: 100, reps: 5 }] },
    ]
    expect(majorGroupsLogged(logs, '2026-09-27', (id) => BUILTIN_BY_ID.get(id))).toEqual(['Back']) // Plank is core: not a major group
  })
  it('default weekday spreads put rest days between sessions', () => {
    expect(defaultWeekdays(3)).toEqual([0, 2, 4])
    expect(defaultWeekdays(2)).toHaveLength(2)
    for (let n = 1; n <= 7; n++) expect(defaultWeekdays(n)).toHaveLength(n)
  })
})

describe('warm-ups and session length in plans', () => {
  it('lifting days start with the warm-up and fill the session; cardio days skip it', () => {
    const days = generateProgram(base({ goal: 'muscle', trainWeekdays: [0, 1, 2, 3, 4], weeks: 1, minutes: 45, rng: mulberry32(9), warmup: { cardio: 5, mobility: 4, sets: true } })).filter((d) => !d.rest)
    for (const d of days) {
      const cardioDay = d.focus.length === 1 && d.focus[0] === 'Cardio'
      if (cardioDay) expect(d.items.some((p) => p.warmup)).toBe(false)
      else {
        expect(d.items[0].warmup, d.name).toBe(true)
        const liftDay = d.items.some((p) => p.reps && !p.block)
        if (liftDay) {
          const total = minutesFor(d.items)
          expect(total, `${d.name}: ${total}`).toBeGreaterThan(45 * 0.85)
          expect(total, `${d.name}: ${total}`).toBeLessThan(45 * 1.15)
        }
      }
    }
  })
})
