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

test('a saved warm-up shows next to its choices, warm-up sets come first for lifting, and − removes the warm-up time', async ({ page }) => {
  await seed(page, { genPrefs: { warmup: ['cardio'], rest: 'normal' } })
  await openRandomizer(page)
  const sheet = page.locator('.fixed')
  await sheet.getByRole('button', { name: 'Strength', exact: true }).click()
  // Warm-up choices come before the time, with warm-up sets first for lifting.
  const chips = sheet.getByRole('button', { name: /^(Warm-up sets|Easy cardio|Mobility)$/ })
  await expect(chips.first()).toHaveText('Warm-up sets')
  const warmBox = (await sheet.getByRole('button', { name: 'Warm-up sets', exact: true }).boundingBox())!
  const timeBox = (await sheet.getByText('Time for each part').boundingBox())!
  expect(warmBox.y).toBeLessThan(timeBox.y)
  // The saved easy cardio has its own time row, which says what it is and can be taken out.
  await expect(sheet.getByText('easy cardio · − to remove')).toBeVisible()
  await sheet.getByRole('button', { name: 'Less Warm-up time' }).click()
  await expect(sheet.getByText('Time for each part')).toBeHidden()
  await expect(sheet.getByRole('button', { name: 'Easy cardio', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await sheet.getByRole('button', { name: 'Warm-up sets', exact: true }).click()
  await sheet.getByRole('button', { name: 'Quads', exact: true }).click()
  await sheet.getByRole('button', { name: /^Generate/ }).click()
  await expect(sheet.getByText(/\+\d warm-up sets/).first()).toBeVisible()
})

test('warm-up moves show a demo on the card and in the timer, and the warm-up can be marked done', async ({ page }) => {
  await page.clock.install()
  const warm = (exerciseId: string) => ({ exerciseId, sets: 1, seconds: 30, warmup: true, block: 'warmup', blockLabel: 'Warm-up' })
  await seed(page, { overrides: { [iso(0)]: [warm('Arm_Circles'), warm('Cat_Stretch'), { exerciseId: 'Barbell_Squat', sets: 3, reps: 5 }] } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()

  // Each move has a demo that really loads (bundled with the app, allowed by the security policy).
  const thumb = page.getByRole('img', { name: 'How to do Arm Circles' })
  await expect(thumb).toBeVisible()
  await expect.poll(() => thumb.locator('img').first().evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Show how to do Cat Stretch (cat-cow)' }).click()
  await expect(page.locator('.fixed').getByRole('img', { name: 'How to do Cat Stretch (cat-cow)' })).toBeVisible()
  await page.locator('.fixed').getByRole('button', { name: 'Close', exact: true }).click()

  // The timer shows the move being done, then the next one during the switch.
  await page.getByRole('button', { name: '⏱ Start warm-up' }).click()
  const timer = page.locator('.fixed')
  await expect(timer.getByRole('img', { name: 'How to do Arm Circles' })).toBeVisible()
  await timer.getByRole('button', { name: 'Start' }).click()
  await page.clock.runFor(32_000)
  await expect(timer.getByText('Next: Cat Stretch (cat-cow)')).toBeVisible()
  await expect(timer.getByRole('img', { name: 'How to do Cat Stretch (cat-cow)' })).toBeVisible()
  // At the end it offers to mark the warm-up done, which folds the card.
  await page.clock.runFor(60_000)
  await timer.getByRole('button', { name: '✓ Mark warm-up done' }).click()
  await expect(page.getByText('✓ Warm-up')).toBeVisible()
  await expect(page.getByRole('button', { name: '⏱ Start warm-up' })).toHaveCount(0)
  expect((await state(page)).warmupsDone).toEqual([iso(0)])

  // Opened again, it can be undone.
  await page.getByRole('button', { name: 'Open warm-up' }).click()
  await page.getByRole('button', { name: 'Done ✓ · tap to undo' }).click()
  await expect(page.getByRole('button', { name: '✓ Warm-up done' })).toBeVisible()
  expect((await state(page)).warmupsDone).toEqual([])
})
