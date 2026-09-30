import { expect, test } from '@playwright/test'
import { iso, seed, state } from './helpers'

const B = 'Barbell_Bench_Press_-_Medium_Grip'

test('history by workout: calendar, day comparison, muscle sets, delete a day', async ({ page }) => {
  await seed(page, {
    logs: [
      { date: iso(-7), exerciseId: B, sets: [{ weight: 135, reps: 8 }] },
      { date: iso(0), exerciseId: B, sets: [{ weight: 145, reps: 8 }, { weight: 145, reps: 8 }] },
      { date: iso(0), exerciseId: 'Pushups', sets: [{ weight: null, reps: 25 }] },
    ],
  })
  await page.goto('/')
  await page.locator('nav').getByText('History').click()
  await expect(page.getByText('Hard sets per muscle')).toBeVisible()
  await expect(page.getByText('▲ 1 improved')).toBeVisible()
  await page.getByRole('button', { name: /workout logged/ }).last().click()
  await expect(page.getByText(/Beat the time before on/)).toBeVisible()
  await expect(page.locator('.fixed').getByText('🏅 PR ▲ better')).toBeVisible()
  await page.getByRole('button', { name: 'Delete this workout' }).click()
  await expect.poll(async () => (await state(page)).logs.length).toBe(1)
})

test('body: log measurements and see the trend', async ({ page }) => {
  await seed(page, { measurements: [{ id: 'm1', date: iso(-30), waist: 34 }] })
  await page.goto('/')
  await page.locator('nav').getByText('History').click()
  await page.getByRole('button', { name: 'Body' }).click()
  await page.getByRole('button', { name: '+ Log' }).click()
  await page.locator('.fixed label', { hasText: 'Waist' }).locator('input').fill('33')
  await page.locator('.fixed').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText(/-1 in since/)).toBeVisible()
  await expect(page.getByText('Progress photos')).toBeVisible()
})
