import { describe, expect, it } from 'vitest'
import raw from '../plans/ice-age-50k.json'
import guide from '../../docs/plan-format.md?raw'
import { addDaysIso, checkPlan, dayOf, notesOn, phaseOf, weekOf, workoutOn } from './plan'

const plan = (() => {
  const r = checkPlan(raw)
  if ('errors' in r) throw new Error(r.errors.join('\n'))
  return r.plan
})()
const titles = (date: string) => dayOf(plan, date)!.items.map((i) => i.title)

describe('the Ice Age 50K plan file', () => {
  it('has every day from Nov 30 to May 9, once', () => {
    expect(plan.days).toHaveLength(161)
    plan.days.forEach((d, i) => expect(d.date).toBe(addDaysIso('2026-11-30', i)))
  })

  it('matches the printed week-by-week miles, long runs and weight goals', () => {
    const miles = [13, 15, 17, 12, 19, 21, 24, 26, 28, 19, 32, 35, 37, 25, 40, 42, 45, 27, 47, 44, 32, 20, 40]
    const goals = [215.5, 214.5, 213, 211.5, 210, 208.5, 207.5, 206.5, 205.5, 204.5, 203.5, 202.5, 201.5, 200.5, 200, 199.5, 199, 199, 199, 199, 199, 199, 199]
    expect(plan.weeks.map((w) => w.miles)).toEqual(miles)
    expect(plan.weeks.map((w) => w.goalLb)).toEqual(goals)
    expect(plan.weeks.filter((w) => w.down).map((w) => w.number)).toEqual([4, 10, 14, 18])
    // The days add up to each week's miles.
    for (const w of plan.weeks) {
      const run = Array.from({ length: 7 }, (_, i) => dayOf(plan, addDaysIso(w.start, i)))
        .flatMap((d) => d?.items ?? []).filter((i) => i.type === 'run' || i.type === 'race').reduce((a, i) => a + (i.miles ?? 0), 0)
      expect(run, `week ${w.number}`).toBe(w.miles)
      // And the long run is the week's longest.
      const long = Array.from({ length: 7 }, (_, i) => dayOf(plan, addDaysIso(w.start, i))!).flatMap((d) => d.items).find((i) => i.title === 'Long run' || i.type === 'race')
      expect(`${long?.miles} mi`, `week ${w.number}`).toBe(w.long === 'Race' ? '31 mi' : w.long)
    }
  })

  it('has the days as printed', () => {
    expect(titles('2026-11-30')).toEqual([]) // Monday, the one rest day
    expect(titles('2026-12-01')).toEqual(['Strength A', 'Easy run'])
    expect(titles('2026-12-02')).toEqual(['Strength C', 'Easy run'])
    expect(titles('2026-12-03')).toEqual(['Strength B', 'Run'])
    expect(dayOf(plan, '2026-12-04')!.items).toEqual([{ type: 'bike', title: 'Bike/incline', minutes: 45 }, { type: 'mobility', title: 'Mobility', minutes: 15 }])
    expect(dayOf(plan, '2026-12-06')!.items[0]).toMatchObject({ title: 'Hike', minutes: 75 })
    expect(titles('2027-01-12')).toEqual(['Hills', 'Strength A']) // from Jan 11: run before you lift
    expect(dayOf(plan, '2027-01-12')!.items[0]).toMatchObject({ miles: 5, detail: '6×60 s' })
    expect(dayOf(plan, '2027-02-27')!.items[0]).toMatchObject({ title: 'Long run', miles: 15, minutes: 180, fuel: '40 g carbs/hr' })
    expect(titles('2027-04-15')).toEqual(['Strength B'])
    expect(dayOf(plan, '2027-04-17')!.items[0]).toMatchObject({ miles: 24, minutes: 288, fuel: '50 g carbs/hr' })
    expect(dayOf(plan, '2027-05-06')!.items[0]).toMatchObject({ title: 'Easy run', miles: 2 })
    expect(dayOf(plan, '2027-05-07')).toMatchObject({ items: [], label: 'Rest or a 15-minute shakeout' })
    expect(dayOf(plan, '2027-05-08')!.items[0]).toMatchObject({ type: 'race', miles: 31 })
    expect(dayOf(plan, '2027-05-09')!.items).toEqual([])
  })

  it('has the daily targets as printed', () => {
    const t = (date: string) => plan.targets[dayOf(plan, date)!.target!]
    expect(t('2026-11-30')).toMatchObject({ kcal: 2300, protein: 200, carbs: 195, fat: 80 })
    expect(t('2026-12-04')).toMatchObject({ kcal: 2700, carbs: 295 }) // Friday bike and mobility
    expect(t('2026-12-05')).toMatchObject({ kcal: 3100, carbs: 385, fat: 85 })
    expect(t('2027-01-11')).toMatchObject({ kcal: 2700, carbs: 285, fat: 85 })
    expect(t('2027-03-07')).toMatchObject({ kcal: 3000, carbs: 350 })
    expect(t('2027-03-14')).toMatchObject({ kcal: 3700, protein: 190, carbs: 510, fat: 100 }) // peak Sundays are long days
    expect(t('2027-04-02')).toMatchObject({ kcal: 3550 })
    expect(t('2027-04-04')).toMatchObject({ kcal: 4000, protein: 180, carbs: 595 })
    expect(t('2027-04-24')).toMatchObject({ kcal: 3300, carbs: 420 }) // taper long run
    expect(t('2027-05-05')).toMatchObject({ kcal: 3000 })
    expect(t('2027-05-06')).toMatchObject({ carbs: '720–810', protein: 150, fat: 60 })
    expect(dayOf(plan, '2027-05-09')!.target).toBeUndefined()
  })

  it('gives each strength day the phase’s version of its workout', () => {
    expect(workoutOn(plan, 'A', '2026-12-01')!.version.label).toBe('Phase 1')
    expect(workoutOn(plan, 'A', '2027-01-12')!.version.exercises.map((e) => e.name)).toContain('Pogo hops')
    expect(workoutOn(plan, 'A', '2027-03-09')!.version.exercises[0]).toMatchObject({ prescription: '2 × 4–5', sets: 2 })
    expect(workoutOn(plan, 'A', '2027-04-20')!.version).toMatchObject({ label: 'Taper', note: expect.stringContaining('80%') })
    expect(workoutOn(plan, 'B', '2027-01-14')!.version.exercises.find((e) => e.name === 'Hamstring curl')!.prescription).toBe('3 × 6–8, Nordic')
    expect(workoutOn(plan, 'C', '2027-01-13')!.version.exercises).toHaveLength(4)
    // Every strength day finds its workout, with a version that covers that date.
    for (const d of plan.days) for (const it of d.items) if (it.type === 'strength') {
      const w = workoutOn(plan, it.workout!, d.date)!
      expect(w.version.start <= d.date && d.date <= w.version.end, `${d.date} ${it.title}`).toBe(true)
    }
  })

  it('finds the week, phase and notes for a date', () => {
    expect(weekOf(plan, '2026-12-01')).toMatchObject({ number: 1 })
    expect(weekOf(plan, '2026-11-21')).toBeUndefined()
    expect(weekOf(plan, '2027-05-08')).toMatchObject({ number: 23 })
    expect(phaseOf(plan, '2027-03-08')!.name).toContain('Peak')
    const n = notesOn(plan, '2027-02-10').map((x) => x.title)
    expect(n).toContain('When to change the plan')
    expect(notesOn(plan, '2027-02-10').find((x) => x.title === 'This month')!.bullets[0]).toContain('Feb 1')
    expect(notesOn(plan, '2026-12-01').find((x) => x.title === 'This month')!.bullets[0]).toContain('Monday is your one rest day')
    expect(notesOn(plan, '2027-05-05').map((x) => x.title)).toContain('Race day plan')
  })
})

describe('checking a plan file', () => {
  const minimal = { format: 'durata-plan', version: 1, id: 'x', name: 'X', start: '2027-01-04', end: '2027-01-05', phases: [], weeks: [], targets: {}, workouts: {},
    days: [{ date: '2027-01-05', items: [] }, { date: '2027-01-04', items: [{ type: 'run', title: 'Run', miles: 3 }] }] }

  it('takes a minimal plan, sorting its days', () => {
    const r = checkPlan(minimal)
    expect('plan' in r && r.plan.days.map((d) => d.date)).toEqual(['2027-01-04', '2027-01-05'])
  })

  it('says exactly what is wrong', () => {
    const bad = { ...minimal, version: 2, days: [{ date: '2027-01-04', target: 'nope', items: [{ type: 'swim', title: '', workout: 'Z', miles: '3' }] }, { date: '2027-01-04', items: [] }] }
    const r = checkPlan(bad) as { errors: string[] }
    expect(r.errors).toEqual(expect.arrayContaining([
      'version: must be 1',
      'day 2027-01-04.target: "nope" isn\'t in targets',
      expect.stringMatching(/items\[0\]\.type: must be one of/),
      'day 2027-01-04.items[0].title: is missing',
      'day 2027-01-04.items[0].miles: must be a number',
      'day 2027-01-04.items[0].workout: "Z" isn\'t in workouts',
      'day 2027-01-04: is listed twice',
    ]))
    expect(checkPlan(null)).toEqual({ errors: [expect.stringContaining('not a plan')] })
    expect(checkPlan({ ...minimal, workouts: { A: { name: 'A', versions: [{ label: 'x', start: '2027-01-01', end: '2027-02-01', exercises: [{ name: 'Row', prescription: '3 × 10', sets: 0 }] }] } } }))
      .toEqual({ errors: ['workouts.A.versions[0].exercises[0].sets: must be a whole number from 1 to 20'] })
  })

  it('accepts the examples in the format guide', () => {
    // Each JSON block in docs/plan-format.md, dropped into a minimal plan, passes the check.
    const blocks = [...guide.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1].trim())
    expect(blocks).toHaveLength(3)
    const [day, targets, workouts] = blocks
    const p = { ...minimal, ...JSON.parse(`{${targets}}`), ...JSON.parse(`{${workouts}}`), days: [{ ...JSON.parse(day), target: 'p1-train' }] }
    p.days[0].items[0].workout = 'A'
    expect(checkPlan(p)).toMatchObject({ plan: { id: 'x' } })
  })
})
