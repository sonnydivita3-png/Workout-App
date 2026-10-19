import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { Program, Sport } from '../types'
import { generateCardioPlan } from './cardioPlan'
import { addDays, parseISO, toISO } from './dates'
import { planSessions, sessionKind, strengthForPlan, type PlanSession } from './enduranceStrength'
import { withGearFor } from './equipment'

const START = '2026-10-26'
const plan = (eventId: string, days: number[], weeks = 12) => {
  const p = generateCardioPlan({ eventId, level: 'intermediate', trainWeekdays: days, longDay: days.includes(5) ? 5 : days.at(-1)!, anchorMonday: START, fromDate: START, weeks, units: { weight: 'lb', distance: 'mi' } })
  return { p, sessions: p.days.filter((d) => d.role).map((d): PlanSession => ({ date: d.date, kind: sessionKind(d.title), phase: p.weeks[d.weekIndex].phase })) }
}
const PLANS: [string, number[], Sport][] = [['5k', [0, 2, 4, 5], 'run'], ['half', [1, 2, 3, 5, 6], 'run'], ['marathon', [0, 1, 3, 4, 5], 'run'], ['run-base', [0, 2, 4, 5], 'run'], ['c25k', [0, 2, 4], 'run'], ['century', [1, 3, 5, 6], 'bike']]
const day = (d: string, n: number) => toISO(addDays(parseISO(d), n))
const plyo = (id: string) => /jump|hop|bound/i.test(`${id} ${BUILTIN_BY_ID.get(id)?.name}`)

describe('strength made for a run or bike plan', () => {
  it('never on the long run or race, or the day before a long run, hard session or race; two or more days apart', () => {
    for (const [id, days, sport] of PLANS) {
      const { sessions } = plan(id, days)
      const on = new Map(sessions.map((s) => [s.date, s]))
      const out = strengthForPlan({ sessions, sport, from: START, perWeek: 2, minutes: 45 })
      expect(out.length, id).toBeGreaterThan(8)
      for (const s of out) {
        expect(['long', 'race'], `${id} ${s.date}`).not.toContain(on.get(s.date)?.kind)
        expect(['long', 'hard', 'race'], `${id} ${s.date}`).not.toContain(on.get(day(s.date, 1))?.kind)
      }
      for (let i = 1; i < out.length; i++) expect(parseISO(out[i].date).getTime() - parseISO(out[i - 1].date).getTime()).toBeGreaterThanOrEqual(2 * 86400000)
    }
  })

  it('two a week in base and build, one at peak, in cutbacks and taper, none in race week', () => {
    for (const [id, days, sport] of PLANS) {
      const { sessions } = plan(id, days)
      for (const perWeek of [1, 2] as const) {
        const out = strengthForPlan({ sessions, sport, from: START, perWeek, minutes: 45 })
        const weeks = new Map<number, typeof out>()
        for (const s of out) weeks.set(s.weekIndex, [...(weeks.get(s.weekIndex) ?? []), s])
        for (const list of weeks.values()) {
          const phase = list[0].phase
          expect(phase).not.toBe('race')
          expect(list.length, `${id} ${phase}`).toBeLessThanOrEqual(phase === 'base' || phase === 'build' ? perWeek : 1)
        }
        // Base and build weeks get what was asked for.
        const building = [...weeks.values()].filter((l) => l[0].phase === 'build')
        expect(building.every((l) => l.length === perWeek), id).toBe(true)
      }
    }
  })

  it('prefers the day of a hard session (after the run), so easy days stay easy', () => {
    const { sessions } = plan('marathon', [0, 1, 3, 4, 5])
    const out = strengthForPlan({ sessions, sport: 'run', from: START, perWeek: 2, minutes: 45 })
    const hardDays = out.filter((s) => s.after === 'hard').length
    expect(hardDays).toBeGreaterThan(out.length / 3)
  })

  it('runners: heavy main lifts with hops once the base is built; first weeks moderate with no jumping; lighter near race day', () => {
    const { sessions } = plan('half', [1, 2, 3, 5, 6])
    const out = strengthForPlan({ sessions, sport: 'run', from: START, perWeek: 2, minutes: 45 })
    const early = out.filter((s) => s.weekIndex < 3)
    expect(early.flatMap((s) => s.items).some((p) => plyo(p.exerciseId))).toBe(false)
    const build = out.find((s) => s.phase === 'build')!
    expect(build.items.some((p) => plyo(p.exerciseId))).toBe(true)
    expect(build.items.some((p) => p.reps === 5 && p.sets === 4 && p.warmupSets === 2)).toBe(true)
    expect(build.items.some((p) => BUILTIN_BY_ID.get(p.exerciseId)?.group === 'Calves' && !plyo(p.exerciseId))).toBe(true)
    const taper = out.filter((s) => s.phase === 'taper')
    expect(taper.length).toBeGreaterThan(0)
    for (const t of taper) {
      expect(t.items.length).toBeLessThan(build.items.length)
      expect(t.items.filter((p) => !plyo(p.exerciseId) && BUILTIN_BY_ID.get(p.exerciseId)?.mode === 'weight').every((p) => p.deload)).toBe(true)
    }
  })

  it('cyclists: no jumping; new runners (Couch to 5K): moderate weights, no jumps, leg curls before Nordics', () => {
    const bike = strengthForPlan({ sessions: plan('century', [1, 3, 5, 6]).sessions, sport: 'bike', from: START, perWeek: 2, minutes: 60 })
    expect(bike.flatMap((s) => s.items).some((p) => plyo(p.exerciseId) && p.exerciseId !== 'x-box-jump')).toBe(false)
    const c25k = strengthForPlan({ sessions: plan('c25k', [0, 2, 4], 9).sessions, sport: 'run', from: START, perWeek: 2, minutes: 45 })
    const items = c25k.flatMap((s) => s.items)
    expect(items.some((p) => plyo(p.exerciseId))).toBe(false)
    expect(items.every((p) => !p.reps || p.reps >= 10)).toBe(true)
    expect(items.some((p) => p.exerciseId === 'Natural_Glute_Ham_Raise')).toBe(false)
  })

  it('uses what they have: bodyweight only still gets a full session', () => {
    const { sessions } = plan('10k', [0, 2, 4, 5])
    const out = withGearFor([], () => strengthForPlan({ sessions, sport: 'run', from: START, perWeek: 2, minutes: 45 }))
    for (const s of out) {
      expect(s.items.length).toBeGreaterThanOrEqual(4)
      for (const p of s.items) expect(['Bodyweight', 'Other', 'Box', undefined]).toContain(BUILTIN_BY_ID.get(p.exerciseId)?.equipment === 'Bodyweight' ? 'Bodyweight' : BUILTIN_BY_ID.get(p.exerciseId)?.equipment)
    }
  })

  it('starts from today partway through a plan, and works out the phases of an older plan from its sessions', () => {
    const { p, sessions } = plan('half', [1, 2, 3, 5, 6])
    // An older plan: no phases stored, only the planned runs on the calendar.
    const program: Program = { id: 'run', kind: 'cardio', title: 'Half marathon plan', sport: 'run', createdAt: '', entries: sessions.map((s) => ({ date: s.date, exerciseId: 'running' })) }
    const overrides = Object.fromEntries(p.days.filter((d) => d.role).map((d) => [d.date, [{ exerciseId: 'running', sets: 1, minutes: d.minutes, note: `${d.title}: ${d.note}`, plan: 'run' }]]))
    const guessed = planSessions(program, overrides)
    expect(guessed.map((s) => s.kind)).toEqual(sessions.map((s) => s.kind))
    expect(guessed.at(-1)!.phase).toBe('race')
    expect(guessed.filter((s) => s.phase === 'taper').length).toBeGreaterThan(0)
    expect(guessed[0].phase).toBe('base')
    const from = day(START, 30)
    const out = strengthForPlan({ sessions: guessed, sport: 'run', from, perWeek: 2, minutes: 45 })
    expect(out.every((s) => s.date >= from)).toBe(true)
    expect(out.some((s) => s.phase === 'taper')).toBe(true)
  })
})
