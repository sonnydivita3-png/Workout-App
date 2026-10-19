import { expect, test } from './fixtures'
import { seed, state } from './helpers'

test('plan a month step by step: favorites, a rep range, sets that build, a deload week, then weekly sets per muscle', async ({ page }) => {
  await seed(page, { favorites: ['Leg_Press'] })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add' }).click()
  await page.getByRole('button', { name: /Plan a week or month/ }).click()
  const next = page.getByRole('button', { name: 'Next', exact: true })

  await expect(page.getByText('Step 1 of 6')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'What’s the goal?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Build muscle' })).toHaveAttribute('aria-pressed', 'true')
  await next.click()

  await expect(page.getByRole('heading', { name: 'When, and how often?' })).toBeVisible()
  await page.getByText('Next week', { exact: true }).click()
  await page.getByRole('button', { name: 'Month (4 weeks)' }).click()
  await page.getByRole('button', { name: '4 days' }).click()
  await page.getByRole('button', { name: '60 min' }).click()
  await next.click()

  await expect(page.getByRole('button', { name: 'Upper / Lower' })).toContainText('Best for 4 days')
  await page.getByRole('button', { name: 'Upper / Lower' }).click()
  await next.click()

  // Exercises: favorites by body part are right there.
  await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Favorite exercises' }).getByRole('listitem').filter({ hasText: 'Quads' })).toContainText('Leg Press')
  await next.click()

  await expect(page.getByRole('heading', { name: 'How it progresses' })).toBeVisible()
  await page.getByRole('button', { name: 'Classic · 8–12' }).click()
  await page.getByRole('button', { name: 'A set more each week' }).click()
  await expect(page.getByRole('button', { name: 'A lighter week (deload)' })).toHaveAttribute('aria-pressed', 'true')
  await next.click()

  await expect(page.getByRole('heading', { name: 'Warm-up and rest' })).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('button', { name: 'Classic · 8–12' })).toHaveAttribute('aria-pressed', 'true')
  await next.click()
  await page.getByRole('button', { name: 'Build my plan' }).click()

  await expect(page.getByText(/Build muscle · Upper \/ Lower · 4 days · 60 min · Classic · 8–12 · a set more each week · deload week 4/)).toBeVisible()
  const volume = page.getByRole('region', { name: 'Weekly sets per muscle' })
  await expect(volume.getByRole('listitem').filter({ hasText: 'Chest' })).toContainText(/\d+ \/ 12/)
  await expect(page.getByText('lighter week')).toBeVisible()
  await page.getByRole('button', { name: 'Apply to my plan' }).click()

  const s = await state(page)
  expect(s.genPrefs.plan).toEqual({ reps: 'moderate', sets: 'weekly', deload: true, keepLifts: true })
  const dates = Object.keys(s.overrides).sort()
  const items = (from: number, to: number) => dates.slice(from, to).flatMap((d) => s.overrides[d]) as { reps?: number; deload?: boolean; warmup?: boolean; exerciseId: string }[]
  // Lifting targets in the 8-12 range; the last week marked as the lighter one.
  const lifts = items(0, 21).filter((p) => p.reps && !p.warmup)
  expect(lifts.length).toBeGreaterThan(10)
  expect(lifts.every((p) => [8, 10, 12, 15, 20].includes(p.reps!))).toBe(true)
  expect(items(0, 21).some((p) => p.deload)).toBe(false)
  expect(items(21, 28).some((p) => p.deload)).toBe(true)
})

test('a plan that can’t fit every muscle’s weekly sets says which come up short, and why', async ({ page }) => {
  await seed(page, { trainingPrefs: { styles: [], cardio: [], cardioSplit: false, setTarget: 16 } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add' }).click()
  await page.getByRole('button', { name: /Plan a week or month/ }).click()
  const next = page.getByRole('button', { name: 'Next', exact: true })
  await next.click()
  // Three 45-minute workouts can't give every muscle 16 sets a week.
  await page.getByText('Next week', { exact: true }).click()
  await page.getByRole('button', { name: '3 days' }).click()
  await page.getByRole('button', { name: '45 min' }).click()
  await next.click()
  await page.getByRole('button', { name: 'Push / Pull / Legs' }).click()
  for (const step of ['Exercises', 'How it progresses', 'Warm-up and rest']) {
    await next.click()
    await expect(page.getByRole('heading', { name: step })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Build my plan' }).click()

  const volume = page.getByRole('region', { name: 'Weekly sets per muscle' })
  await expect(volume.getByRole('listitem').filter({ hasText: 'Quads' })).toContainText(/\d+ \/ 16/)
  await expect(volume.getByText(/come up short: there isn’t room for more in 45-minute workouts\. Longer workouts, another day for them, or a lower weekly target \(Settings\) would close the gap\./)).toBeVisible()
})

test('a run plan and a lifting month stack: every run stays, the month adds no cardio of its own, and stopping one leaves the other', async ({ page }) => {
  // A runner: their preferred cardio (and so a lifting day's finisher) is running too.
  await seed(page, { trainingPrefs: { styles: [], cardio: ['running'], cardioSplit: false } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.getByRole('button', { name: /Run or ride plan/ }).click()
  await page.getByRole('button', { name: 'Build mileage' }).click()
  await page.getByRole('button', { name: '5 days' }).click()
  await page.getByRole('button', { name: 'Build my plan' }).click()
  await page.getByRole('button', { name: 'Add to my plan' }).click()
  const runs = (s: { overrides: Record<string, { exerciseId: string; plan?: string; note?: string }[]>; programs: { id: string; kind: string }[] }) => {
    const id = s.programs.find((p) => p.kind === 'cardio')!.id
    return Object.entries(s.overrides).flatMap(([date, items]) => items.filter((x) => x.plan === id).map((x) => `${date} ${x.note}`)).sort()
  }
  const planned = runs(await state(page))
  expect(planned.length).toBeGreaterThan(20)

  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.getByRole('button', { name: /Plan a week or month/ }).click()
  const next = page.getByRole('button', { name: 'Next', exact: true })
  await next.click()
  await page.getByRole('button', { name: 'Month (4 weeks)' }).click()
  await page.getByRole('button', { name: '5 days' }).click()
  await page.getByRole('button', { name: '75 min' }).click()
  for (let i = 0; i < 4; i++) await next.click()
  await page.getByRole('button', { name: 'Build my plan' }).click()
  await expect(page.getByText(/“Build mileage plan” stays on your calendar, with its sessions on \d+ days kept alongside this plan\. It’s your cardio/)).toBeVisible()
  // Days with both: they're asked which comes first, and can't add the plan until they answer.
  const apply = page.getByRole('button', { name: 'Apply to my plan' })
  await expect(page.getByText(/On the \d+ days with both, which first\?/)).toBeVisible()
  await expect(apply).toBeDisabled()
  await page.getByRole('button', { name: 'Run first' }).click()
  await apply.click()

  let s = await state(page)
  expect(runs(s)).toEqual(planned)
  const month = s.programs.find((p: { kind: string }) => p.kind === 'program')!
  const monthItems = Object.values(s.overrides).flat().filter((x) => (x as { plan?: string }).plan === month.id) as { note?: string; warmup?: boolean; exerciseId: string }[]
  expect(monthItems.length).toBeGreaterThan(40)
  expect(monthItems.filter((x) => x.note === 'Finisher, easy pace')).toEqual([])
  // Run first on every day with both; switching in My plans puts the lifting first instead.
  const both = (st: typeof s) => Object.values(st.overrides as Record<string, { plan?: string }[]>).filter((d) => d.some((x) => x.plan === month.id) && d.some((x) => x.plan !== month.id))
  expect(both(s).length).toBeGreaterThan(5)
  expect(both(s).every((d) => d[0].plan !== month.id)).toBe(true)
  await page.getByRole('group', { name: 'Lift or run first' }).getByRole('button', { name: 'Lift first' }).click()
  await expect(page.getByText(/Lifting first on the \d+ days with both/)).toBeVisible()
  s = await state(page)
  expect(s.trainingPrefs.stackOrder).toBe('lift')
  expect(both(s).every((d) => d[0].plan === month.id && d.at(-1)!.plan !== month.id)).toBe(true)

  await expect(page.getByRole('heading', { name: 'My plans' })).toBeVisible()
  await page.getByRole('listitem').filter({ hasText: /month plan/ }).getByRole('button', { name: 'Stop' }).click()
  await page.getByRole('button', { name: 'Stop program' }).click()
  s = await state(page)
  expect(runs(s)).toEqual(planned)
  expect(Object.values(s.overrides).flat().filter((x) => (x as { plan?: string }).plan === month.id)).toEqual([])
})

test('a run plan that starts next week and a week plan this week don’t overlap, and the plan says so', async ({ page }) => {
  await seed(page, { trainingPrefs: { styles: [], cardio: ['running'], cardioSplit: false } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.getByRole('button', { name: /Run or ride plan/ }).click()
  await page.getByRole('button', { name: 'Build mileage' }).click()
  await expect(page.getByText(/^Starts Monday /)).toBeVisible() // next week, by default
  await page.getByRole('button', { name: 'Build my plan' }).click()
  await page.getByRole('button', { name: 'Add to my plan' }).click()

  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.getByRole('button', { name: /Plan a week or month/ }).click()
  const next = page.getByRole('button', { name: 'Next', exact: true })
  for (let i = 0; i < 5; i++) await next.click()
  await page.getByRole('button', { name: 'Build my plan' }).click()
  await expect(page.getByText(/“Build mileage plan” starts \w+ \d+, after this plan ends, so the two don’t overlap\./)).toBeVisible()
  await expect(page.getByText(/which first\?/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Apply to my plan' }).click()
  await expect(page.getByRole('heading', { name: 'My plans' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Lift or run first' })).toHaveCount(0)
})

test('a run plan added on top of a lifting month asks lift or run first too', async ({ page }) => {
  await seed(page, { trainingPrefs: { styles: [], cardio: ['running'], cardioSplit: false } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.getByRole('button', { name: /Plan a week or month/ }).click()
  const next = page.getByRole('button', { name: 'Next', exact: true })
  await next.click()
  await page.getByRole('button', { name: 'Month (4 weeks)' }).click()
  await page.getByRole('button', { name: '5 days' }).click()
  for (let i = 0; i < 4; i++) await next.click()
  await page.getByRole('button', { name: 'Build my plan' }).click()
  await page.getByRole('button', { name: 'Apply to my plan' }).click()

  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.getByRole('button', { name: /Run or ride plan/ }).click()
  await page.getByRole('button', { name: 'Build mileage' }).click()
  await page.getByRole('button', { name: 'This week' }).click()
  await expect(page.getByText(/^Starts today\./)).toBeVisible()
  await page.getByRole('button', { name: 'Build my plan' }).click()
  const add = page.getByRole('button', { name: 'Add to my plan' })
  await expect(page.getByText(/On the \d+ days? with both, which first\?/)).toBeVisible()
  await expect(add).toBeDisabled()
  await page.getByRole('button', { name: 'Lift first' }).click()
  await add.click()

  const s = await state(page)
  expect(s.trainingPrefs.stackOrder).toBe('lift')
  const run = s.programs.find((p: { kind: string }) => p.kind === 'cardio')!.id
  const both = Object.values(s.overrides as Record<string, { plan?: string; warmup?: boolean }[]>).filter((d) => d.some((x) => x.plan === run) && d.some((x) => x.plan !== run))
  expect(both.length).toBeGreaterThan(3)
  expect(both.every((d) => d.at(-1)!.plan === run)).toBe(true)
})

test('strength made for a run plan: offered with the run plan, previewed week by week, placed around the runs', async ({ page }) => {
  await seed(page, { trainingPrefs: { styles: [], cardio: ['running'], cardioSplit: false } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.getByRole('button', { name: /Run or ride plan/ }).click()
  await page.getByRole('button', { name: 'Half marathon' }).click()
  await page.getByRole('button', { name: 'Build my plan' }).click()
  await page.getByText('Then build strength training made for this plan').click()
  await page.getByRole('button', { name: 'Add to my plan' }).click()

  // The strength sheet opens next, with what it does and a look at each week.
  await expect(page.getByRole('heading', { name: 'Strength for Half marathon plan' })).toBeVisible()
  await expect(page.getByText(/2 a week while you build, fewer near race time/)).toBeVisible()
  await page.getByRole('button', { name: '1', exact: true }).click()
  await expect(page.getByText(/1 a week while you build/)).toBeVisible()
  await page.getByRole('button', { name: '2', exact: true }).click()
  await page.getByRole('button', { name: '30 min' }).click()
  const weeks = page.getByRole('list', { name: 'Strength weeks' })
  await expect(weeks.getByText(/Strength [AB] ·/).first()).toBeVisible()
  const add = page.getByRole('button', { name: 'Add strength plan' })
  await expect(add).toBeDisabled() // lift or run first, asked first
  await page.getByRole('button', { name: 'Run first' }).click()
  await add.click()

  const s = await state(page)
  const run = s.programs.find((p: { kind: string }) => p.kind === 'cardio')
  const lift = s.programs.find((p: { kind: string }) => p.kind === 'program')
  expect(lift.title).toBe('Strength for Half marathon plan')
  expect(lift.supports).toBe(run.id)
  expect(run.entries.every((e: { phase?: string }) => e.phase)).toBe(true)
  const longRuns = new Set(Object.entries(s.overrides as Record<string, { plan?: string; note?: string }[]>)
    .filter(([, d]) => d.some((x) => x.plan === run.id && /^Long run/.test(x.note ?? ''))).map(([date]) => date))
  const liftDates = lift.entries.map((e: { date: string }) => e.date)
  expect(liftDates.length).toBeGreaterThan(10)
  for (const d of liftDates) {
    expect(longRuns.has(d)).toBe(false)
    const next = new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10)
    expect(longRuns.has(next)).toBe(false)
    const day = s.overrides[d] as { plan?: string }[]
    if (day.some((x) => x.plan === run.id)) expect(day[0].plan).toBe(run.id) // run first
  }
  // My plans: both, and no second offer of strength for this run plan.
  await expect(page.getByRole('heading', { name: 'My plans' })).toBeVisible()
  await expect(page.getByText('Strength for Half marathon plan')).toBeVisible()
  await expect(page.getByRole('button', { name: '+ Strength made for it' })).toHaveCount(0)
})

test('a run plan already on the calendar gets strength from My plans', async ({ page }) => {
  await seed(page, { trainingPrefs: { styles: [], cardio: ['running'], cardioSplit: false } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.getByRole('button', { name: /Run or ride plan/ }).click()
  await page.getByRole('button', { name: 'Build mileage' }).click()
  await page.getByRole('button', { name: 'Build my plan' }).click()
  await page.getByRole('button', { name: 'Add to my plan' }).click()
  await page.getByRole('button', { name: '+ Strength made for it' }).click()
  await expect(page.getByRole('heading', { name: 'Strength for Build mileage plan' })).toBeVisible()
  // Up to four a week; past two they're upper body and core.
  await page.getByRole('button', { name: '4', exact: true }).click()
  await expect(page.getByText(/Sessions past two are upper body and core/)).toBeVisible()
  // Or their own days: Mon, Wed, Fri, Sat (Saturday is the long run, Friday the day before): kept, and flagged.
  const days = page.getByRole('group', { name: 'Strength days' })
  for (const d of ['Mon', 'Wed', 'Fri', 'Sat']) await days.getByRole('button', { name: d }).click()
  await expect(page.getByText('4 a week, on the days you picked.')).toBeVisible()
  await expect(page.getByRole('button', { name: '4', exact: true })).toHaveCount(0)
  await expect(page.getByRole('note')).toContainText(/leg sessions? falls? on or the day before a long run/)
  await page.getByRole('button', { name: 'Lift first' }).click()
  await page.getByRole('button', { name: 'Add strength plan' }).click()
  const s = await state(page)
  expect(s.programs.map((p: { title: string }) => p.title)).toEqual(['Build mileage plan', 'Strength for Build mileage plan'])
  const weekdays = new Set(s.programs[1].entries.map((e: { date: string }) => (new Date(`${e.date}T12:00:00`).getDay() + 6) % 7))
  expect([...weekdays].sort()).toEqual([0, 2, 4, 5])
})
