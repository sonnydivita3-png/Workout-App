import { expect, test } from './fixtures'
import { iso, seed, state } from './helpers'

const DIP = 'Dips_-_Chest_Version'
const LUNGE = 'Dumbbell_Lunges'

test('0 lb on a weighted lift asks if it’s bodyweight; yes logs reps only, now and next time', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: DIP, sets: 3, reps: 10 }] } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  const ask = page.getByRole('group', { name: 'Bodyweight exercise?' })
  await expect(ask).toHaveCount(0)
  await page.getByRole('spinbutton', { name: 'Set 1 lb' }).fill('0')
  await expect(ask).toContainText('0 lb: is Chest Dip a bodyweight exercise?')
  await page.getByRole('spinbutton', { name: 'Set 1 reps' }).fill('12')
  await page.getByRole('button', { name: 'Set 1 done' }).click()
  await ask.getByRole('button', { name: 'Yes, bodyweight' }).click()
  // Reps only from here: no weight box, and the 0 lb set is a bodyweight set.
  await expect(ask).toHaveCount(0)
  await expect(page.getByRole('spinbutton', { name: 'Set 1 lb' })).toHaveCount(0)
  await expect(page.getByRole('spinbutton', { name: 'Set 1 reps' })).toHaveValue('12')
  let s = await state(page)
  expect(s.exerciseModes).toEqual({ [DIP]: 'reps' })
  expect(s.logs.find((l: { exerciseId: string }) => l.exerciseId === DIP).sets[0]).toMatchObject({ weight: null, reps: 12, done: true })
  // Remembered: still reps only after a reload, and it can be switched back under ⋯.
  await page.reload()
  await page.locator('nav').getByText('Workouts').click()
  await expect(page.getByRole('spinbutton', { name: 'Set 2 reps' })).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: 'Set 2 lb' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Chest Dip options' }).click()
  await page.getByRole('button', { name: 'Track with weight' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Set 2 lb' })).toBeVisible()
  s = await state(page)
  expect(s.exerciseModes).toEqual({ [DIP]: 'weight' })
})

test('“no, it’s weighted” keeps the weight and doesn’t ask again', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: LUNGE, sets: 3, reps: 10 }] } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  const ask = page.getByRole('group', { name: 'Bodyweight exercise?' })
  await page.getByRole('spinbutton', { name: 'Set 1 lb' }).fill('0')
  await ask.getByRole('button', { name: 'No, it’s weighted' }).click()
  await expect(ask).toHaveCount(0)
  await page.getByRole('spinbutton', { name: 'Set 2 lb' }).fill('0')
  await expect(ask).toHaveCount(0)
  await expect(page.getByRole('spinbutton', { name: 'Set 1 lb' })).toHaveValue('0')
  expect((await state(page)).exerciseModes).toEqual({ [LUNGE]: 'weight' })
  // Any lift can be switched to bodyweight by hand, too.
  await page.getByRole('button', { name: 'Dumbbell Lunges options' }).click()
  await page.getByRole('button', { name: 'Track as bodyweight (reps only)' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Set 1 lb' })).toHaveCount(0)
  await expect(page.getByText(/Quads · bodyweight · 3 × 10/)).toBeVisible()
})
