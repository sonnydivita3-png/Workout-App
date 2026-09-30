import { expect, test } from './fixtures'
import { iso, seed, state } from './helpers'

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip'

test.beforeEach(async ({ page }) => {
  await seed(page, {
    overrides: { [iso(0)]: [{ exerciseId: BENCH, sets: 3, reps: 8 }] },
    logs: [{ date: iso(-3), exerciseId: BENCH, sets: [{ weight: 135, reps: 8 }, { weight: 135, reps: 8 }, { weight: 135, reps: 8 }], note: 'felt easy' }],
  })
})

test('suggests the next step and marks sets that beat last time', async ({ page }) => {
  await page.goto('/')
  await page.locator('nav').getByText('Plan').click()
  await expect(page.getByText('🎯 Try 140 lb × 8')).toBeVisible()
  await expect(page.getByText('Last note: “felt easy”')).toBeVisible()
  await page.getByRole('button', { name: 'Fill' }).click()
  await expect(page.getByText('▲ Beat last time on 3 sets')).toBeVisible()
  const s = await state(page)
  expect(s.logs.find((l: { date: string }) => l.date === iso(0)).sets.map((x: { weight: number }) => x.weight)).toEqual([140, 140, 140])
  // warm-up sets don't count
  await page.getByRole('button', { name: /Set 1; tap to mark as warm-up/ }).click()
  await expect(page.getByText('▲ Beat last time on 2 sets')).toBeVisible()
  // plates and how-to
  await page.getByRole('button', { name: 'Plates' }).click()
  await expect(page.getByText(/45 lb bar \+/)).toBeVisible()
  await page.getByRole('button', { name: 'Bench Press', exact: true }).click()
  await expect(page.getByText('Barbell Bench Press - Medium Grip')).toBeVisible()
  await expect(page.getByText(/Lie back on a flat bench/i)).toBeVisible()
})

test('workout mode: ✓ sets, rest timer, and a beat-last-time summary', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '▶ Start workout' }).click()
  await page.getByRole('combobox').selectOption('60')
  for (let i = 1; i <= 3; i++) await page.getByRole('button', { name: `Set ${i} done` }).click()
  await expect(page.getByRole('timer')).toContainText('Rest')
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: 'Finish workout' }).click()
  await expect(page.getByText('Beat last time on everything 🔥')).toBeVisible()
  await expect(page.getByText('PR', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  expect((await state(page)).session).toBeNull()
})
