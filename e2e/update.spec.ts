import { expect, test } from './fixtures'
import { iso, seed, state } from './helpers'

test('a newer version on the server: updates itself at launch once, then offers a button; workouts stay', async ({ page }) => {
  await seed(page, { logs: [{ date: iso(-1), exerciseId: 'running', cardio: { distance: 3, minutes: 30 } }] })
  let served = 0
  await page.route('**/version.json*', async (route) => { served++; await route.fulfill({ json: { version: 'abc1234' } }) })
  await page.goto('/')
  // It reloaded fresh (once) and tidied the address bar afterwards.
  await expect.poll(() => served).toBeGreaterThanOrEqual(2)
  await expect(page).not.toHaveURL(/[?&]v=/)
  // The server still says newer (e.g. a slow CDN): no reload loop, a button instead.
  const banner = page.getByRole('status').filter({ hasText: 'A new version of the app is ready.' })
  await expect(banner).toBeVisible()
  expect((await state(page)).logs).toHaveLength(1)

  // Settings → Help shows the version and the same update.
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('main').getByRole('button', { name: /^Help/ }).click()
  await expect(page.getByText('Version abc1234 is ready.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Update now' })).toBeVisible()
})

test('on the latest version: no banner, and a manual check says so', async ({ page }) => {
  await seed(page)
  await page.goto('/')
  await expect(page.getByText('A new version of the app is ready.')).toHaveCount(0)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('main').getByRole('button', { name: /^Help/ }).click()
  await page.getByRole('button', { name: 'Check for updates' }).click()
  await expect(page.getByText('You’re on the latest version.')).toBeVisible()
  await expect(page.getByText(/Reload the app fresh/)).toBeVisible()
})
