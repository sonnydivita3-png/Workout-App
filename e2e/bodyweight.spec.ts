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

test('making a bodyweight move weighted asks what adds the weight, and files it under that equipment', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: 'Pullups', sets: 3, reps: 8 }] } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  const ask = page.getByRole('group', { name: 'What adds the weight?' })
  await expect(ask).toHaveCount(0)
  await page.getByRole('button', { name: 'Pull-Up options' }).click()
  await page.getByRole('button', { name: 'Track with weight' }).click()
  await expect(ask).toContainText('What adds the weight to Pull-Up?')
  // Free weights asks which; Back returns to Machine, Free weights, Cable.
  await ask.getByRole('button', { name: 'Free weights' }).click()
  await expect(ask).toContainText('Which free weight?')
  await ask.getByRole('button', { name: 'Back' }).click()
  await ask.getByRole('button', { name: 'Free weights' }).click()
  await ask.getByRole('button', { name: 'Dumbbell' }).click()
  await expect(ask).toHaveCount(0)
  expect((await state(page)).exerciseGear).toEqual({ Pullups: 'Dumbbell' })

  // Saved there: the exercise list shows it under Dumbbell, not Bodyweight.
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.getByText('Add an exercise').click()
  const picker = page.locator('.fixed')
  await picker.getByPlaceholder(/search/i).fill('pull-up')
  await picker.getByRole('button', { name: /^Equipment filter/ }).click()
  await picker.getByRole('group', { name: 'Equipment' }).getByRole('button', { name: /^Dumbbell \d+$/ }).click()
  await expect(picker.getByRole('button', { name: /^Pull-Up\b/ })).toBeVisible()
  await picker.getByRole('button', { name: /^Equipment filter/ }).click()
  await picker.getByRole('group', { name: 'Equipment' }).getByRole('button', { name: /^Bodyweight \d+$/ }).click()
  await expect(picker.getByRole('button', { name: /^V-Bar Pullup\b/ })).toBeVisible()
  await expect(picker.getByRole('button', { name: /^Pull-Up\b/ })).toHaveCount(0)
  await picker.getByRole('button', { name: 'Done' }).click()

  // Back to bodyweight: it files under bodyweight again, and making it weighted asks again.
  await page.getByRole('button', { name: 'Pull-Up options' }).click()
  await page.getByRole('button', { name: 'Track as bodyweight (reps only)' }).click()
  expect((await state(page)).exerciseGear).toEqual({})
  await page.getByRole('button', { name: 'Pull-Up options' }).click()
  await page.getByRole('button', { name: 'Track with weight' }).click()
  await ask.getByRole('button', { name: 'Machine' }).click()
  expect((await state(page)).exerciseGear).toEqual({ Pullups: 'Machine' })
})

test('“Later” hides the question for now; an exercise that already has equipment never asks', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: 'Bench_Dips', sets: 3, reps: 10 }, { exerciseId: 'Dumbbell_Lunges', sets: 3, reps: 10 }] }, exerciseModes: { Bench_Dips: 'weight', Dumbbell_Lunges: 'weight' } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  const ask = page.getByRole('group', { name: 'What adds the weight?' })
  await expect(ask).toHaveCount(1)
  await expect(ask).toContainText('Bench Dips')
  await ask.getByRole('button', { name: 'Later' }).click()
  await expect(ask).toHaveCount(0)
  expect((await state(page)).exerciseGear ?? {}).toEqual({})
})
