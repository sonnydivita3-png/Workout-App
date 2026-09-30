import type { Page } from '@playwright/test'

/** Start from a known saved state (skips the first-run pages unless told otherwise). */
export async function seed(page: Page, state: Record<string, unknown> = {}) {
  await page.addInitScript((extra) => {
    if (localStorage.getItem('workout-app-v1')) return
    localStorage.setItem('workout-app-v1', JSON.stringify({
      state: {
        socialChoice: 'declined', tourDone: true, tourVersion: 1000, plan: Array.from({ length: 7 }, () => []), overrides: {}, logs: [], custom: [],
        units: { weight: 'lb', distance: 'mi' }, name: 'Test', notifPrefs: { system: false, goals: false, pbs: false, daily: false, reminderTime: '23:59' },
        nudgeSnooze: { install: 9e15, backup: 9e15 }, tipsSeen: ['plan', 'workout', 'progress'], onboarded: true, ...extra,
      },
      version: 2,
    }))
  }, state)
  page.on('dialog', (d) => d.accept())
}

export const iso = (days = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function state(page: Page) {
  return JSON.parse((await page.evaluate(() => localStorage.getItem('workout-app-v1')))!).state
}

/** Create a social account without an email, starting from the Social tab. */
export async function signUp(page: Page, handle: string, name = 'E2E') {
  await page.locator('nav').getByText('Social').click()
  await page.getByRole('button', { name: 'Set up social features' }).click()
  await page.getByRole('button', { name: 'Continue without email' }).click()
  await page.getByPlaceholder('yourname').fill(handle)
  await page.getByPlaceholder('What friends see').fill(name)
  await page.getByText(/I agree that my handle/).click()
  await page.getByText('I’m 13 or older.').click()
  await page.getByRole('button', { name: 'Create my account' }).click()
}
