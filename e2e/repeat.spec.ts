import { expect, test } from './fixtures'
import { iso, seed, state } from './helpers'

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip'
const fourSets = { date: iso(-3), exerciseId: BENCH, sets: Array.from({ length: 4 }, () => ({ weight: 135, reps: 8 })) }

test('done before with a different number of sets: asks whether to do the same again', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: BENCH, sets: 3, reps: 8 }] }, logs: [fourSets] })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  const ask = page.getByRole('group', { name: 'Sets this time' })
  await expect(ask).toContainText('Last time you did 4 sets. Do 4 again?')
  await expect(page.getByRole('button', { name: 'Set 4 done' })).toHaveCount(0)
  await ask.getByRole('button', { name: 'Yes, 4 sets' }).click()
  await expect(ask).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Set 4 done' })).toBeVisible()
  expect((await state(page)).overrides[iso(0)][0].sets).toBe(4)
})

test('keeping the planned sets is remembered, and starting the exercise settles it too', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: BENCH, sets: 3, reps: 8 }] }, logs: [fourSets] })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  const ask = page.getByRole('group', { name: 'Sets this time' })
  // Ticking a set means they've started: no question while it's ticked.
  await page.getByRole('button', { name: 'Set 1 done' }).click()
  await expect(ask).toHaveCount(0)
  await page.getByRole('button', { name: 'Set 1 done' }).click()
  await ask.getByRole('button', { name: 'Keep 3' }).click()
  await expect(ask).toHaveCount(0)
  expect((await state(page)).overrides[iso(0)][0]).toMatchObject({ sets: 3, keepSets: true })
  await page.reload()
  await page.locator('nav').getByText('Workouts').click()
  await expect(page.getByRole('button', { name: 'Set 3 done' })).toBeVisible()
  await expect(ask).toHaveCount(0)
})

test('adding an exercise you have done before plans as many sets as last time', async ({ page }) => {
  await seed(page, { logs: [fourSets] })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.getByText('Add an exercise').click()
  await page.getByPlaceholder(/search/i).fill('bench press')
  await page.locator('.fixed button', { hasText: /^Bench Press/ }).first().click()
  await page.locator('.fixed').getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('button', { name: 'Set 4 done' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Sets this time' })).toHaveCount(0)
  expect(Object.values((await state(page)).overrides).flat()).toEqual([{ exerciseId: BENCH, sets: 4 }])
})
