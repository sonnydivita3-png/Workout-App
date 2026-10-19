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
  await page.getByRole('button', { name: 'Apply to my plan' }).click()

  let s = await state(page)
  expect(runs(s)).toEqual(planned)
  const month = s.programs.find((p: { kind: string }) => p.kind === 'program')!
  const monthItems = Object.values(s.overrides).flat().filter((x) => (x as { plan?: string }).plan === month.id) as { note?: string; warmup?: boolean; exerciseId: string }[]
  expect(monthItems.length).toBeGreaterThan(40)
  expect(monthItems.filter((x) => x.note === 'Finisher, easy pace')).toEqual([])

  await expect(page.getByRole('heading', { name: 'My plans' })).toBeVisible()
  await page.getByRole('listitem').filter({ hasText: /month plan/ }).getByRole('button', { name: 'Stop' }).click()
  await page.getByRole('button', { name: 'Stop program' }).click()
  s = await state(page)
  expect(runs(s)).toEqual(planned)
  expect(Object.values(s.overrides).flat().filter((x) => (x as { plan?: string }).plan === month.id)).toEqual([])
})
