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
