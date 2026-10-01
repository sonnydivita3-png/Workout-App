import { expect, test } from './fixtures'
import { iso, seed, state } from './helpers'

async function openRandomizer(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.locator('.fixed').getByText('Make me a workout').click()
}

test('a 30-minute strength workout really fills about 30 minutes', async ({ page }) => {
  await seed(page)
  await openRandomizer(page)
  const sheet = page.locator('.fixed')
  await sheet.getByRole('button', { name: /More options/ }).click()
  await sheet.getByRole('button', { name: 'Strength', exact: true }).click()
  await sheet.getByRole('button', { name: 'Chest', exact: true }).click()
  await sheet.getByRole('button', { name: 'Quads', exact: true }).click()
  await sheet.getByRole('button', { name: '30 min', exact: true }).click()
  await sheet.getByRole('button', { name: /^Generate/ }).click()
  const header = await sheet.getByText(/about \d+ min/).innerText()
  const mins = Number(/about (\d+) min/.exec(header)![1])
  expect(mins).toBeGreaterThanOrEqual(26)
  expect(mins).toBeLessThanOrEqual(33)
  await sheet.getByRole('button', { name: /^Add to/ }).click()
  const st = await state(page)
  const planned = [...st.plan.flat(), ...Object.values(st.overrides).flat()] as { sets: number }[]
  expect(planned.reduce((a, p) => a + p.sets, 0)).toBeGreaterThan(8)
})

test('warm-up: easy cardio, mobility and ramp-up sets, with the rest timer following the plan', async ({ page }) => {
  await seed(page, { restSeconds: -1, logs: [{ date: iso(-4), exerciseId: 'Barbell_Squat', sets: [{ weight: 225, reps: 5 }, { weight: 225, reps: 5 }] }] })
  await openRandomizer(page)
  const sheet = page.locator('.fixed')
  await sheet.getByRole('button', { name: /More options/ }).click()
  await sheet.getByRole('button', { name: 'Strength', exact: true }).click()
  await sheet.getByRole('button', { name: 'Quads', exact: true }).click()
  for (const w of ['Easy cardio', 'Mobility', 'Warm-up sets']) await sheet.getByRole('button', { name: w, exact: true }).click()
  await expect(sheet.getByText('Time for each part')).toBeVisible()
  await expect(sheet.getByText('Warm-up', { exact: true })).toBeVisible()
  await sheet.getByRole('button', { name: /^Generate/ }).click()
  await expect(sheet.getByText(/Warm-up/i).first()).toBeVisible()
  await expect(sheet.getByText(/\+3 warm-up sets/)).toBeVisible()
  await sheet.getByRole('button', { name: /^Add to/ }).click()

  // Plan tab: the warm-up card with a guided timer
  await expect(page.getByText(/Warm-up · about \d+ min/)).toBeVisible()
  await page.getByRole('button', { name: '⏱ Start warm-up' }).click()
  await page.locator('.fixed').getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.fixed').getByText(/easy/)).toBeVisible()
  await page.locator('.fixed').getByRole('button', { name: 'Close', exact: true }).last().click()

  // Then the lifts, with ramp-up sets first; with the rest timer set to "As planned", rest follows the plan.
  await expect(page.getByText(/\+3 warm-up/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Set 1 done', exact: true }).first().click() // first working set (after 3 warm-ups)
  await expect(page.getByRole('timer')).toContainText(/2:[0-9]{2}|1:[0-9]{2}/)
  const today = (await state(page)).logs.find((l: { date: string; sets?: { warmup?: boolean }[] }) => l.date === iso(0) && l.sets)
  expect(today.sets.slice(0, 3).every((x: { warmup?: boolean }) => x.warmup)).toBe(true)
})
