import { expect, test } from './fixtures'
import { seed, state } from './helpers'

test('Make me a workout for a calorie target: lifting keeps its time, the cardio makes up the rest', async ({ page }) => {
  await seed(page, { trainingPrefs: { styles: [], cardio: ['running'], cardioSplit: false } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.locator('.fixed').getByText('Make me a workout').click()
  const sheet = page.locator('.fixed')
  await sheet.getByRole('button', { name: 'Lifting', exact: true }).click()
  await sheet.getByRole('button', { name: 'Cardio', exact: true }).click()
  await sheet.getByRole('button', { name: 'Full body', exact: true }).click()
  await expect(sheet.getByRole('button', { name: /^Generate/ })).toBeEnabled()

  await sheet.getByRole('group', { name: 'Plan by' }).getByRole('button', { name: 'Calories' }).click()
  await sheet.getByRole('button', { name: '1,000 cal' }).click()
  const status = sheet.getByRole('status')
  await expect(status).toContainText('Add your weight')
  await expect(sheet.getByRole('button', { name: /^Generate/ })).toBeDisabled()
  await sheet.getByLabel('Your weight').fill('180')
  // About 1,000 (minutes round to 5): roughly 2 hours for a 180 lb runner with 30 minutes of lifting.
  await expect(status).toContainText(/About (9[5-9]\d|1,0[0-4]\d) cal in (1h 5\d|2h)/)
  // The cardio row is worked out; lifting keeps its own +/−.
  await expect(sheet.getByText('worked out for your target')).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'More Cardio time' })).toHaveCount(0)
  const cardioBefore = await sheet.locator('li', { hasText: 'worked out for your target' }).textContent()
  // 20 more minutes of lifting: less cardio needed.
  for (let i = 0; i < 4; i++) await sheet.getByRole('button', { name: 'More Standard time' }).click()
  await expect(sheet.locator('li', { hasText: 'worked out for your target' })).not.toHaveText(cardioBefore!)

  await sheet.getByRole('button', { name: '500 cal' }).click()
  await expect(status).toContainText(/About \d{3} cal in/)
  await sheet.getByRole('button', { name: /^Generate/ }).click()
  // The workout as made comes to about the target (its cardio fitted to it).
  await expect(sheet.getByText(/≈ (4[5-9]\d|5[0-4]\d) cal/)).toBeVisible()

  const s = await state(page)
  expect(s.bodyweight.at(-1).lb).toBe(180)
})

test('Make me a workout for a calorie target, lifting only: the time grows to reach it, with a nudge to add cardio', async ({ page }) => {
  await seed(page, { bodyweight: [{ date: '2026-01-01', lb: 200 }] })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.locator('.fixed').getByText('Make me a workout').click()
  const sheet = page.locator('.fixed')
  await sheet.getByRole('button', { name: 'Lifting', exact: true }).click()
  await sheet.getByRole('group', { name: 'Plan by' }).getByRole('button', { name: 'Calories' }).click()
  await sheet.getByRole('button', { name: '1,000 cal' }).click()
  const status = sheet.getByRole('status')
  await expect(status).toContainText(/\(200 lb\)/)
  await expect(status).toContainText('Adding cardio gets there in much less time')
})
