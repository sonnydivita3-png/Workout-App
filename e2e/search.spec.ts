import { expect, test } from './fixtures'
import { seed } from './helpers'

test('search finds lifts by everyday names: "dumbbell overhead press", plurals, skater hops', async ({ page }) => {
  await seed(page)
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: 'Add exercises' }).click()
  const search = page.getByPlaceholder(/search/i)
  await search.fill('dumbbell overhead press')
  await expect(page.getByRole('button', { name: /^Dumbbell Shoulder Press/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Seated Dumbbell Press/ })).toBeVisible()
  await search.fill('hammer curls')
  await expect(page.getByRole('button', { name: /^Hammer Curl/ }).first()).toBeVisible()
  await search.fill('skater hops')
  await expect(page.getByRole('button', { name: /^Skater Hops/ })).toBeVisible()
})

test('a search nothing fully matches (a typo, or something not in the list) shows the closest exercises and offers to make it', async ({ page }) => {
  await seed(page)
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: 'Add exercises' }).click()
  const picker = page.locator('.fixed').filter({ has: page.getByRole('heading', { name: 'Add exercise' }) })
  const search = picker.getByPlaceholder(/search/i)

  // A typo: the closest ones, the right one first, and it can be picked straight away.
  await search.fill('dumbell shoulder pres')
  await expect(picker.getByText('No exact match')).toBeVisible()
  await expect(picker.getByText('Closest to “dumbell shoulder pres”:')).toBeVisible()
  const first = picker.getByRole('button', { name: /^Dumbbell Shoulder Press/ })
  await expect(first).toBeVisible()
  await expect(picker.getByRole('button', { name: /Not one of these\? Create “dumbell shoulder pres” as your own exercise/ })).toBeVisible()
  await first.click()
  await expect(picker.getByRole('button', { name: /^Dumbbell Shoulder Press.*Added/ })).toBeDisabled()

  // Not in the list: the nearest ones, and making it their own starts with what they typed.
  await search.fill('landmine press')
  await expect(picker.getByText('No exact match')).toBeVisible()
  await picker.getByRole('button', { name: /Create “landmine press” as your own exercise/ }).click()
  const make = page.locator('.fixed').filter({ has: page.getByRole('heading', { name: 'New exercise' }) })
  await expect(make.getByLabel('Name')).toHaveValue('landmine press')
  await make.getByRole('button', { name: 'Cancel' }).click()

  // Gibberish: nothing close, just the offer.
  await search.fill('zzzz')
  await expect(picker.getByText('No exercise matches “zzzz”.')).toBeVisible()
  await expect(picker.getByRole('button', { name: /Create “zzzz” as your own exercise/ })).toBeVisible()
})
