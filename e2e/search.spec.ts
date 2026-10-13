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
