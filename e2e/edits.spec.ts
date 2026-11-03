import { expect, test } from './fixtures'
import { iso, seed, state } from './helpers'

const fmtLong = (date: string) => new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

test('two runs on one day: deleting one from its history keeps the other', async ({ page }) => {
  const twoRuns = iso(-9)
  await seed(page, {
    logs: [
      { date: twoRuns, exerciseId: 'running', cardio: { distance: 5.1, minutes: 48, parts: [{ distance: 3, minutes: 27 }, { distance: 2.1, minutes: 21 }] } },
      { date: iso(-2), exerciseId: 'running', cardio: { distance: 4, minutes: 36 } },
    ],
  })
  await page.goto('/')
  await page.locator('nav').getByText('Progress').click()
  await page.getByRole('button', { name: 'Exercises', exact: true }).click()
  await page.getByRole('button', { name: /^Running/ }).click()
  await expect(page.getByRole('button', { name: new RegExp(`^Delete ${fmtLong(twoRuns)}`) })).toHaveCount(2)

  await page.getByRole('button', { name: `Delete ${fmtLong(twoRuns)}, run 2` }).click()
  await expect(page.getByRole('button', { name: new RegExp(`^Delete ${fmtLong(twoRuns)}`) })).toHaveCount(1)
  await expect(page.getByText('3 mi · 27 min · 9:00 /mi')).toBeVisible()
  await expect(page.getByText(/^2\.1 mi/)).toHaveCount(0)
  const logs = (await state(page)).logs
  expect(logs.find((l: { date: string }) => l.date === twoRuns).cardio).toEqual({ distance: 3, minutes: 27 })
  expect(logs).toHaveLength(2)
})
