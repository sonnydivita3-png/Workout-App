import { expect, test } from './fixtures'
import { seed, state } from './helpers'

async function signUp(page: import('@playwright/test').Page, handle: string) {
  await page.getByRole('button', { name: 'Set up social features' }).click()
  await page.getByRole('button', { name: 'Continue without email' }).click()
  await page.getByPlaceholder('yourname').fill(handle)
  await page.getByPlaceholder('What friends see').fill('E2E')
  await page.getByText(/I agree that my handle/).click()
  await page.getByText('I’m 13 or older.').click()
  await page.getByRole('button', { name: 'Create my account' }).click()
}

test('an invite link survives sign-up and adds the inviter in one tap', async ({ page }) => {
  await seed(page, { socialChoice: 'unset' })
  await page.goto('/?add=Maya')
  await expect(page.getByText('invited you. Set up social to add them')).toBeVisible()
  expect(page.url()).not.toContain('add=')
  await signUp(page, 'invitee')
  await expect(page.getByText('invited you to train together')).toBeVisible()
  await page.getByRole('button', { name: 'Add friend' }).click()
  await expect(page.getByText('Friend request sent')).toBeVisible()
  await expect(page.getByText('invited you to train together')).toHaveCount(0)
  expect((await state(page)).pendingInvite).toBeNull()
  await page.locator('nav').getByText('Social').click()
  await page.getByRole('button', { name: 'Friends', exact: true }).click()
  await expect(page.getByText('@maya', { exact: true })).toBeVisible()
})

test('invite link can be dismissed, and Settings copies an app link without a share sheet', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await seed(page)
  await page.goto('/?add=sam')
  await page.getByRole('button', { name: 'Not now' }).click()
  await expect(page.getByText('invited you to train together')).toHaveCount(0)
  await page.locator('nav').getByText('Settings').click()
  await page.evaluate(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }) })
  await page.getByRole('button', { name: /Invite a friend to the app/ }).click()
  await expect(page.getByText('Invite copied')).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toMatch(/https?:\/\/[^ ]+\/$/)
})

test('an account can be deleted from Settings even with social turned off', async ({ page }) => {
  await seed(page, { socialChoice: 'unset' })
  await page.goto('/')
  await signUp(page, 'leaver')
  await page.locator('nav').getByText('Settings').click()
  await page.getByRole('button', { name: 'Turn off social features' }).click()
  await page.getByRole('button', { name: 'Turn off', exact: true }).click()
  await page.getByRole('button', { name: /Delete my account/ }).click()
  await page.getByRole('button', { name: 'Delete my account', exact: true }).click()
  await expect(page.getByText('Account deleted')).toBeVisible()
  await expect(page.getByRole('button', { name: /Delete my account/ })).toHaveCount(0)
  const demo = JSON.parse((await page.evaluate(() => localStorage.getItem('ez-social-demo-v1')))!)
  expect(demo.profiles.some((p: { handle: string }) => p.handle === 'leaver')).toBe(false)
})
