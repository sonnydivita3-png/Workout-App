import { expect, test } from './fixtures'
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
  await page.locator('nav').getByText('Progress').click()
  await expect(page.getByText('Hard sets per muscle')).toBeVisible()
  // No goal yet: the usual 10 a week, less for smaller muscles. Two bench sets and push-ups this week, one set last week.
  await expect(page.getByLabel('Chest: 3 of 10 sets this week, 1 last week')).toBeVisible()
  await expect(page.getByLabel('Biceps: 0 of 6 sets this week, 0 last week')).toBeVisible()
  await expect(page.getByText(/set your goal in Settings/)).toBeVisible()
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
  await page.locator('nav').getByText('Progress').click()
  await page.getByRole('button', { name: 'Body' }).click()
  await page.getByRole('button', { name: '+ Log' }).click()
  await page.locator('.fixed label', { hasText: 'Waist' }).locator('input').fill('33')
  await page.locator('.fixed').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText(/-1 in since/)).toBeVisible()
  await expect(page.getByText('Progress photos')).toBeVisible()
})

test('weekly targets follow your goal, or your own number, and Settings is a tap away on every tab', async ({ page }) => {
  await seed(page, { logs: [{ date: iso(0), exerciseId: B, sets: [{ weight: 145, reps: 8 }, { weight: 145, reps: 8 }] }] })
  await page.goto('/')
  for (const tab of ['Workouts', 'Progress']) {
    await page.locator('nav').getByText(tab).click()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(page.getByRole('main').getByRole('button', { name: /^Profile, units & equipment/ })).toBeVisible()
  }
  await page.getByRole('main').getByRole('button', { name: /^Profile, units & equipment/ }).click()
  // Two goals at once: the bigger target wins.
  const goals = page.getByRole('group', { name: 'Your goals' })
  await goals.getByRole('button', { name: 'Lose fat' }).click()
  await page.locator('nav').getByText('Progress').click()
  await expect(page.getByLabel('Chest: 2 of 8 sets this week, 0 last week')).toBeVisible()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('main').getByRole('button', { name: /^Profile, units & equipment/ }).click()
  await goals.getByRole('button', { name: 'Build muscle' }).click()
  await expect(goals.getByRole('button', { name: '✓ Lose fat' })).toHaveAttribute('aria-pressed', 'true')
  await page.locator('nav').getByText('Progress').click()
  await expect(page.getByLabel('Chest: 2 of 12 sets this week, 0 last week')).toBeVisible()
  await expect(page.getByText(/Target for lose fat \+ build muscle: 12 a week/)).toBeVisible()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('main').getByRole('button', { name: /^Profile, units & equipment/ }).click()
  await page.getByLabel('Weekly sets per muscle').fill('16')
  await page.locator('nav').getByText('Progress').click()
  await expect(page.getByLabel('Chest: 2 of 16 sets this week, 0 last week')).toBeVisible()
  expect((await state(page)).trainingPrefs).toMatchObject({ goals: ['fatloss', 'muscle'], setTarget: 16 })
})
