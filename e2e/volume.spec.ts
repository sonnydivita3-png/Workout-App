import { expect, test } from './fixtures'
import { iso, openSettings, seed, state } from './helpers'
import type { Page } from '@playwright/test'

async function chestHour(page: Page) {
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.locator('.fixed').getByText('Make me a workout').click()
  const sheet = page.locator('.fixed')
  // The sheet remembers the last choices: Chest may already be picked.
  const chest = sheet.getByRole('button', { name: 'Chest', exact: true })
  if ((await chest.getAttribute('aria-pressed')) !== 'true') await chest.click()
  await sheet.getByRole('button', { name: '60 min', exact: true }).click()
  await sheet.getByRole('button', { name: /^Generate/ }).click()
  return sheet
}

test('an hour of one muscle: says what works, offers other ways to use the time, and can be kept as is', async ({ page }) => {
  await seed(page)
  await page.goto('/')
  const sheet = await chestHour(page)
  const check = sheet.getByRole('region', { name: 'Lots for one muscle' })
  await expect(check).toContainText(/That’s a lot of chest: \d+ exercises, \d+ sets/)
  await expect(check).toContainText('about 10–15 hard sets for one muscle in a session')
  await check.getByRole('button', { name: 'Heavier, fewer exercises' }).click()
  await expect(check).toHaveCount(0)
  await expect(sheet.getByText(/Heavier, fewer exercises instead of \d+ chest exercises\./)).toBeVisible()
  // Changed their mind: keep it as it was made.
  await sheet.getByRole('button', { name: 'Change', exact: true }).click()
  await check.getByRole('button', { name: /^Keep it as is/ }).click()
  await expect(sheet.getByText('Kept all the chest exercises.')).toBeVisible()
  await sheet.getByRole('button', { name: /^Add to/ }).click()
  const chest = ((await state(page)).overrides[iso(0)] as { warmup?: boolean }[]).filter((p) => !p.warmup)
  expect(chest.length).toBeGreaterThan(5)
})

test('their own number and a standing choice, in the prompt and in Settings', async ({ page }) => {
  await seed(page)
  await page.goto('/')
  let sheet = await chestHour(page)
  const check = sheet.getByRole('region', { name: 'Lots for one muscle' })
  await check.getByRole('button', { name: 'More exercises per muscle' }).click()
  expect((await state(page)).trainingPrefs.perMuscle).toBe(6)
  await check.getByText('Do this every time').click()
  await check.getByRole('button', { name: 'Add a cardio finisher' }).click()
  expect((await state(page)).trainingPrefs.extraTime).toBe('finisher')
  // Next time it just does it, and says so.
  await sheet.getByRole('button', { name: 'Reroll', exact: true }).click()
  await expect(sheet.getByText(/Add a cardio finisher instead of \d+ chest exercises \(your setting\)\./)).toBeVisible()
  await sheet.getByRole('button', { name: 'Close', exact: true }).click()

  await openSettings(page, 'Workouts')
  await expect(page.getByRole('combobox', { name: 'When a workout would have more' })).toHaveValue('finisher')
  await expect(page.getByLabel('Exercises per muscle', { exact: true })).toHaveText('6')
  await page.getByRole('combobox', { name: 'When a workout would have more' }).selectOption('more')
  sheet = await chestHour(page)
  await expect(sheet.getByRole('region', { name: 'Lots for one muscle' })).toHaveCount(0)
  await expect(sheet.getByRole('button', { name: /^Add to/ })).toBeVisible()
})
