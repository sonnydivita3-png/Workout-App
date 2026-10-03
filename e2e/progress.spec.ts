import { expect, test } from './fixtures'
import { iso, openSettings, seed, state } from './helpers'

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip'

test.beforeEach(async ({ page }) => {
  await seed(page, {
    overrides: { [iso(0)]: [{ exerciseId: BENCH, sets: 3, reps: 8 }] },
    logs: [{ date: iso(-3), exerciseId: BENCH, sets: [{ weight: 135, reps: 8 }, { weight: 135, reps: 8 }, { weight: 135, reps: 8 }], note: 'felt easy' }],
  })
})

test('suggests the next step and marks sets that beat last time', async ({ page }) => {
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  // 3 × 8 once: a rep more on two sets, the third repeats.
  await expect(page.getByText('🎯 Try 135 lb × 9 on 2 sets')).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: 'Set 3 reps' })).toHaveAttribute('placeholder', '8')
  await expect(page.getByText('Last note: “felt easy”')).toBeVisible()
  for (let i = 1; i <= 3; i++) await page.getByRole('button', { name: `Set ${i} done` }).click()
  // Done: the card folds up (with the result); open it again to keep editing.
  await expect(page.getByText(/3 of 3 sets .*▲ 2 beat last time/)).toBeVisible()
  await page.getByRole('button', { name: 'Open Bench Press' }).click()
  await expect(page.getByText('▲ Beat last time on 2 sets')).toBeVisible()
  const s = await state(page)
  expect(s.logs.find((l: { date: string }) => l.date === iso(0)).sets.map((x: { reps: number }) => x.reps)).toEqual([9, 9, 8])
  // warm-up sets don't count
  await page.getByRole('button', { name: 'Set 1 options' }).click()
  await page.getByRole('button', { name: /Make it a warm-up/ }).click()
  await expect(page.getByText('▲ Beat last time on 1 set')).toBeVisible()
  // plates and how-to (plates are under the exercise's ⋯)
  await page.getByRole('button', { name: 'Bench Press options' }).click()
  await page.getByRole('button', { name: 'Plates for this weight' }).click()
  await expect(page.getByText(/45 lb bar \+/)).toBeVisible()
  await page.getByRole('button', { name: 'Bench Press', exact: true }).click()
  await expect(page.getByText('Barbell Bench Press - Medium Grip')).toBeVisible()
  await expect(page.getByText(/Lie back on a flat bench/i)).toBeVisible()
})

test('✓ sets, the optional rest timer, and a beat-last-time summary', async ({ page }) => {
  await page.goto('/')
  // The rest timer is off unless you turn it on.
  await openSettings(page, 'Workouts')
  await page.getByRole('combobox', { name: 'Rest timer after each set' }).selectOption('60')
  await page.locator('nav').getByText('Home').click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  for (let i = 1; i <= 3; i++) await page.getByRole('button', { name: `Set ${i} done` }).click()
  await expect(page.getByRole('timer')).toContainText('Rest')
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByRole('button', { name: '✓ Finish workout' }).click()
  await expect(page.getByText('Beat last time on everything 🔥')).toBeVisible()
  // More reps at the same weight beats last time, but isn't a heavier-than-ever personal best.
  await expect(page.getByText('PR', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  expect((await state(page)).finishedDays).toEqual([iso(0)])
})
