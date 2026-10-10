import { expect, test } from './fixtures'
import { iso, seed, state } from './helpers'
import type { Page } from '@playwright/test'

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip'
const card = (page: Page, name: string) => page.locator('.scroll-mt-4').filter({ has: page.getByRole('button', { name, exact: true }) })
const order = async (c: ReturnType<typeof card>) =>
  (await c.getByRole('button', { name: /^(Set|Drop set|Warm-up set) \d+ options$/ }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!.replace(' options', ''))))

test('a drop set straight after the set you just did, or after any set, on lifts and bodyweight moves', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: BENCH, sets: 3, reps: 8 }, { exerciseId: 'Pushups', sets: 2, reps: 15 }] } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  const bench = card(page, 'Bench Press')
  await bench.getByRole('spinbutton', { name: 'Set 1 lb' }).fill('135')
  await bench.getByRole('spinbutton', { name: 'Set 1 reps' }).fill('8')
  await bench.getByRole('button', { name: 'Set 1 done' }).click()
  // Right after the set just done, about 20% lighter.
  await bench.getByRole('button', { name: '+ Drop set' }).click()
  expect(await order(bench)).toEqual(['Set 1', 'Drop set 1', 'Set 2', 'Set 3'])
  await expect(bench.getByRole('spinbutton', { name: 'Drop set 1 lb' })).toHaveAttribute('placeholder', '110')
  await bench.getByRole('button', { name: 'Drop set 1 done' }).click()
  await expect(bench.getByRole('spinbutton', { name: 'Drop set 1 lb' })).toHaveValue('110')
  // After any set, from that set's menu.
  await bench.getByRole('button', { name: 'Set 2 options' }).click()
  await page.getByRole('button', { name: /^Add a drop set after this set/ }).click()
  expect(await order(bench)).toEqual(['Set 1', 'Drop set 1', 'Set 2', 'Drop set 2', 'Set 3'])
  await expect(bench.getByText(/\+2 drop/)).toBeVisible()
  // A new set goes at the end; the drop sets stay where they are.
  await bench.getByRole('button', { name: '+ Add set' }).click()
  expect(await order(bench)).toEqual(['Set 1', 'Drop set 1', 'Set 2', 'Drop set 2', 'Set 3', 'Set 4'])
  const s = await state(page)
  const logged = s.logs.find((l: { exerciseId: string }) => l.exerciseId === BENCH).sets as { drop?: boolean }[]
  expect(logged.map((x) => (x.drop ? 'D' : 'S')).join('')).toBe('SDSDSS')
  expect(s.overrides[iso(0)][0]).toMatchObject({ sets: 4, dropSets: 2 })

  // Bodyweight moves get them too (reps only: an easier version, to failure).
  const pushups = card(page, 'Push-Up')
  await pushups.getByRole('button', { name: '+ Drop set' }).click()
  await expect(pushups.getByRole('spinbutton', { name: 'Drop set 1 reps' })).toBeVisible()
  await expect(pushups.getByRole('spinbutton', { name: 'Drop set 1 lb' })).toHaveCount(0)
})
