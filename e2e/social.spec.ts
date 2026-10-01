import { expect, test } from './fixtures'
import { openSettings, seed } from './helpers'

test('social sign-up without email needs the age check, then friends work', async ({ page }) => {
  await seed(page, { socialChoice: 'unset' })
  await page.goto('/')
  await page.locator('nav').getByText('Social').click()
  await page.getByRole('button', { name: 'Set up social features' }).click()
  await page.getByRole('button', { name: 'Continue without email' }).click()
  await page.getByPlaceholder('yourname').fill('e2e_user')
  await page.getByPlaceholder('What friends see').fill('E2E')
  await page.getByText(/I agree that my handle/).click()
  const create = page.getByRole('button', { name: 'Create my account' })
  await expect(create).toBeDisabled()
  await page.getByText('I’m 13 or older.').click()
  await create.click()
  await page.locator('nav').getByText('Social').click()
  await expect(page.getByText('@e2e_user')).toBeVisible()
  // This test build has no server, so it says so (on the live site it reads "Live server").
  await expect(page.getByLabel('Connection status')).toContainText('Preview only: accounts stay on this phone · version')
  await page.getByRole('button', { name: 'Review' }).first().click()
  await page.getByRole('button', { name: 'Allow all' }).click()
  await page.getByRole('button', { name: 'Accept' }).click()
  await page.getByRole('button', { name: 'Friends', exact: true }).click()
  await expect(page.getByText('@alex')).toBeVisible()
})

test('legal pages open from Settings', async ({ page }) => {
  await seed(page)
  await page.goto('/')
  await openSettings(page, 'Help & feedback')
  await page.getByRole('button', { name: 'Privacy policy' }).click()
  await expect(page.getByText('No ads, no selling or renting data')).toBeVisible()
})
