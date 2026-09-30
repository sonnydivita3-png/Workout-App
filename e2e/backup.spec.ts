import { expect, test } from './fixtures'
import { iso, seed, state } from './helpers'

test('cloud backup: turn on, back up, restore after erasing, and resolve a conflict', async ({ page }) => {
  await seed(page, { logs: [{ date: iso(-1), exerciseId: 'Pushups', sets: [{ weight: null, reps: 30 }] }] })
  await page.goto('/')
  await page.locator('nav').getByText('Settings').click()
  await page.getByRole('button', { name: 'Turn on cloud backup' }).click()
  await page.locator('.fixed input[type=email]').fill('me@example.com')
  await page.locator('.fixed').getByRole('button', { name: 'Send code' }).click()
  await page.locator('.fixed input[autocomplete=one-time-code]').fill('123456')
  await page.locator('.fixed').getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('✅ Backed up')).toBeVisible()
  await expect.poll(async () => (await state(page)).cloud.lastSyncedAt).not.toBeNull()

  // Erase everything; backup turns off but the cloud copy stays. Turning it back on restores.
  await page.getByText('Erase all data and start over').click()
  await page.locator('.fixed input').last().fill('ERASE')
  await page.locator('.fixed').getByRole('button', { name: 'Erase everything' }).click()
  await expect.poll(async () => (await state(page)).logs.length).toBe(0)
  await page.getByRole('button', { name: 'Turn on cloud backup' }).click()
  await expect.poll(async () => (await state(page)).logs.length).toBe(1)

  // Change the backup behind this phone's back and change this phone too: the app asks.
  await page.evaluate(() => {
    const demo = JSON.parse(localStorage.getItem('ez-social-demo-v1')!)
    const me = demo.meId
    demo.cloud[me] = { data: { ...demo.cloud[me].data, name: 'From other phone' }, updatedAt: new Date(Date.now() + 60000).toISOString() }
    localStorage.setItem('ez-social-demo-v1', JSON.stringify(demo))
    const app = JSON.parse(localStorage.getItem('workout-app-v1')!)
    app.state.name = 'This phone'
    localStorage.setItem('workout-app-v1', JSON.stringify(app))
  })
  await page.reload()
  await expect(page.getByText(/Your backup and this phone both changed/)).toBeVisible()
  await page.getByText(/Your backup and this phone both changed/).click()
  await page.getByRole('button', { name: /Use the backup/ }).click()
  await expect.poll(async () => (await state(page)).name).toBe('From other phone')
})
