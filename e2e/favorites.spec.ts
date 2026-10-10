import { expect, test } from './fixtures'
import { openSettings, seed, state } from './helpers'

test('star favorites in the exercise list: they come first, all together under Favorites, and in Settings by body part', async ({ page }) => {
  await seed(page)
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.getByText('Add an exercise').click()
  const picker = page.locator('.fixed')
  await picker.getByRole('button', { name: 'Favorites', exact: true }).click()
  await expect(picker.getByText(/No favorites yet/)).toBeVisible()
  await picker.getByRole('button', { name: 'All', exact: true }).click()
  await picker.getByPlaceholder(/search/i).fill('leg press')
  const star = picker.getByRole('button', { name: 'Favorite: Leg Press', exact: true })
  await star.click()
  await expect(star).toHaveAttribute('aria-pressed', 'true')
  await picker.getByPlaceholder(/search/i).fill('')
  // Favorites first, whatever the list.
  await expect(picker.locator('ul li').first()).toContainText('Leg Press')
  await picker.getByRole('button', { name: 'Favorites', exact: true }).click()
  await expect(picker.locator('ul li')).toHaveCount(1)
  // Quick add from there.
  await picker.locator('ul li').first().getByRole('button', { name: /^Leg Press/ }).click()
  await expect(picker.locator('ul li').first()).toContainText('Added')
  await picker.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('button', { name: 'Leg Press', exact: true })).toBeVisible()
  expect((await state(page)).favorites).toEqual(['Leg_Press'])

  // Settings: favorites by body part, add more for a part, remove one.
  await openSettings(page, 'Profile, units & equipment')
  const favs = page.getByRole('list', { name: 'Favorite exercises' })
  await expect(favs.getByRole('listitem').filter({ hasText: 'Quads' })).toContainText('Leg Press')
  await expect(favs.getByRole('listitem').filter({ hasText: 'Chest' })).toContainText('None yet')
  await page.getByRole('button', { name: 'Add favorite chest exercises' }).click()
  await expect(page.getByRole('heading', { name: 'Favorite chest exercises' })).toBeVisible()
  await page.locator('.fixed').getByPlaceholder(/search/i).fill('bench press')
  await page.locator('.fixed button', { hasText: /^Bench Press/ }).first().click()
  await page.locator('.fixed').getByRole('button', { name: 'Done' }).click()
  await expect(favs.getByRole('listitem').filter({ hasText: 'Chest' })).toContainText('Bench Press')
  await page.getByRole('button', { name: 'Remove Leg Press from favorites' }).click()
  await expect(favs.getByRole('listitem').filter({ hasText: 'Quads' })).toContainText('None yet')
  expect((await state(page)).favorites).toEqual(['Barbell_Bench_Press_-_Medium_Grip'])
})
