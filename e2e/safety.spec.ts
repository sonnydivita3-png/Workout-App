import { expect, test } from './fixtures'
import { iso, seed } from './helpers'

async function startSignUp(page: import('@playwright/test').Page, handle: string, name = 'E2E') {
  await page.getByRole('button', { name: 'Set up social features' }).click()
  await page.getByRole('button', { name: 'Continue without email' }).click()
  await page.getByPlaceholder('yourname').fill(handle)
  await page.getByPlaceholder('What friends see').fill(name)
  await page.getByText(/I agree that my handle/).click()
  await page.getByText('I’m 13 or older.').click()
  await page.getByRole('button', { name: 'Create my account' }).click()
}

test('offensive handles are refused with a clear message', async ({ page }) => {
  await seed(page, { socialChoice: 'unset' })
  await page.goto('/')
  await startSignUp(page, 'sh1t_lifter')
  await expect(page.getByText('Please choose a different name')).toBeVisible()
})

test('a friend request can be reported, which also blocks the sender', async ({ page }) => {
  await seed(page, { socialChoice: 'unset' })
  await page.goto('/')
  await startSignUp(page, 'reporter')
  await page.locator('nav').getByText('Social').click()
  await page.getByRole('button', { name: 'Review' }).first().click()
  await page.getByRole('button', { name: 'Report', exact: true }).click()
  const send = page.getByRole('button', { name: 'Send report' })
  await expect(send).toBeDisabled()
  await page.getByRole('radio', { name: 'Spam' }).click()
  await send.click()
  await expect(page.getByText('Report sent')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Review' })).toHaveCount(1)
  const demo = JSON.parse((await page.evaluate(() => localStorage.getItem('ez-social-demo-v1')))!)
  expect(demo.reports).toHaveLength(1)
  expect(demo.blocks).toHaveLength(1)
})

test('privacy and account deletion pages open directly, without sign-up', async ({ page }) => {
  await seed(page, { socialChoice: 'unset' })
  await page.goto('/#delete-account')
  await expect(page.getByRole('heading', { name: 'Deleting your account' })).toBeVisible()
  await expect(page.getByText('Settings → Account → Delete my account')).toBeVisible()
  await page.goto('/#privacy')
  await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible()
  await page.getByRole('link', { name: 'Open the app' }).click()
  await expect(page.getByRole('button', { name: 'Set up social features' })).toBeVisible()
})

test('Home nudges: install first, then backup once a few days are logged', async ({ page }) => {
  const log = (d: string) => ({ exerciseId: 'Pushups', date: d, sets: [{ reps: 10 }] })
  await seed(page, { nudgeSnooze: {}, logs: [log(iso(-1)), log(iso(-2)), log(iso(-3))] })
  await page.goto('/')
  await expect(page.getByText('Add the app to your home screen')).toBeVisible()
  await page.getByRole('button', { name: 'Later' }).click()
  await expect(page.getByText('Back up your workouts')).toBeVisible()
  await page.getByRole('button', { name: 'Set up backup' }).click()
  await expect(page.getByRole('button', { name: 'Turn on cloud backup' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Report a bug/ })).toBeVisible()
})
