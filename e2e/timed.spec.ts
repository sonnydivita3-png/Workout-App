import { expect, test } from './fixtures'
import { iso, seed, state } from './helpers'
import type { Page } from '@playwright/test'

const card = (page: Page, name: string) => page.locator('.scroll-mt-4').filter({ has: page.getByRole('button', { name, exact: true }) })

test('any lift can be done for time: curls for 30 seconds keep their weight, with a timer, and switch back', async ({ page }) => {
  await seed(page, {
    overrides: { [iso(0)]: [{ exerciseId: 'Dumbbell_Bicep_Curl', sets: 2, reps: 10 }] },
    logs: [{ date: iso(-3), exerciseId: 'Dumbbell_Bicep_Curl', sets: [{ weight: 20, reps: 10 }, { weight: 20, reps: 10 }] }],
  })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: 'Dumbbell Curl options' }).click()
  await page.getByRole('button', { name: 'Track by time (seconds)' }).click()
  const curl = card(page, 'Dumbbell Curl')
  await expect(curl.getByRole('spinbutton', { name: 'Set 1 lb' })).toHaveAttribute('placeholder', '–')
  await expect(curl.getByRole('spinbutton', { name: 'Set 1 seconds' })).toBeVisible()
  await expect(curl.getByRole('button', { name: 'Time set 1' })).toBeVisible()
  // Last time's weight, for 30 seconds; last time's reps still read as reps.
  await expect(curl.getByTitle('Target for set 1')).toContainText('20×30s')
  await expect(curl.getByText('Last time: 20×10 · 20×10')).toBeVisible()
  await curl.getByRole('button', { name: 'Set 1 done' }).click()
  await expect.poll(async () => (await state(page)).logs.find((l: { date: string }) => l.date === iso(0))?.sets[0]).toMatchObject({ weight: 20, seconds: 30, done: true })
  await expect(curl.getByRole('spinbutton', { name: 'Set 1 seconds' })).toHaveValue('30')

  await page.getByRole('button', { name: 'Dumbbell Curl options' }).click()
  await page.getByRole('button', { name: 'Track with weight' }).click()
  await expect(curl.getByRole('spinbutton', { name: 'Set 2 reps' })).toBeVisible()
  expect((await state(page)).exerciseModes).toEqual({ Dumbbell_Bicep_Curl: 'weight' })
})

test('build a circuit: 30 seconds each of curls, lunges and skater hops, round after round, with its timer', async ({ page }) => {
  await seed(page)
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.getByRole('button', { name: /^Timed workout/ }).click()
  const sheet = page.locator('.fixed').filter({ has: page.getByRole('heading', { name: 'Build a timed workout' }) })
  await expect(sheet.getByRole('button', { name: 'Circuit', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(sheet.getByLabel('Work (sec)')).toHaveValue('30')
  for (const [q, name] of [['dumbbell curl', /^Dumbbell Curl/], ['walking lunge', /^Walking Lunge/], ['skater', /^Skater Hops/]] as const) {
    await sheet.getByRole('button', { name: '+ Add movement' }).click()
    const picker = page.locator('.fixed').filter({ has: page.getByRole('heading', { name: 'Add exercise' }) })
    await picker.getByPlaceholder(/search/i).fill(q)
    await picker.getByRole('button', { name }).first().click()
  }
  await expect(sheet.getByText('3 rounds of 3 moves · 30s on / 15s off · about 8 min')).toBeVisible()
  await sheet.getByRole('button', { name: 'Add to this day' }).click()

  await expect(page.getByText('HIIT circuit · 3 rounds · 30s on / 15s off · 1 min rest between rounds')).toBeVisible()
  const items = (await state(page)).overrides[iso(0)]
  expect(items.map((p: { exerciseId: string }) => p.exerciseId)).toEqual(['Dumbbell_Bicep_Curl', 'Bodyweight_Walking_Lunge', 'Lateral_Bound'])
  expect(items[0]).toMatchObject({ sets: 3, note: '30s on / 15s off' })
  await page.getByRole('button', { name: '⏱ Start circuit timer' }).click()
  await expect(page.getByText('Round 1 of 3 · move 1 of 3')).toBeVisible()
})
