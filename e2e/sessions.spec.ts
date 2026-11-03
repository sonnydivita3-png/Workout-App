import { expect, test } from '@playwright/test'
import { iso, seed, state } from './helpers'

// Two-a-days: a run in the morning, weights in the evening, split by hand on the day.
const SQUAT = 'Barbell_Squat'
const PUSHUP = 'Pushups'

test('a day split into morning and evening: each session has its own time, Finish and reminder', async ({ page }) => {
  await seed(page, {
    bodyweight: [{ date: '2026-01-01', lb: 180 }],
    overrides: { [iso(0)]: [{ exerciseId: SQUAT, sets: 3, reps: 5 }, { exerciseId: PUSHUP, sets: 3, reps: 12 }, { exerciseId: 'running', sets: 1, minutes: 30, distance: 3 }] },
    // The morning run is already logged.
    logs: [{ date: iso(0), exerciseId: 'running', cardio: { distance: 3, minutes: 30 } }],
  })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: 'Day options' }).click()
  await page.getByRole('button', { name: /^Morning & evening/ }).click()

  // It starts with the cardio in the morning and the lifting in the evening.
  const sheet = page.getByRole('dialog', { name: 'Morning & evening' })
  await expect(sheet.getByRole('radiogroup', { name: /When to do Running/ }).getByRole('radio', { name: 'Morning' })).toHaveAttribute('aria-checked', 'true')
  await expect(sheet.getByRole('radiogroup', { name: /When to do Push-Up/ }).getByRole('radio', { name: 'Evening' })).toHaveAttribute('aria-checked', 'true')
  await sheet.getByRole('button', { name: 'Split into two sessions' }).click()

  // Two sections, each with its time and calories, and each finished on its own.
  const morning = page.getByRole('region', { name: 'Morning' })
  const evening = page.getByRole('region', { name: 'Evening' })
  await expect(morning).toContainText(/~\d+ min · ≈ \d+ active cal/)
  await expect(evening).toContainText(/~\d+ min · ≈ \d+ active cal/)
  await expect(morning.locator('.scroll-mt-4')).toHaveCount(1) // the run
  await expect(evening.locator('.scroll-mt-4')).toHaveCount(2) // the lifts
  await expect(page.getByRole('button', { name: '✓ Finish workout' })).toHaveCount(0)

  await morning.getByRole('button', { name: '✓ Finish morning' }).click()
  await expect(page.getByText(/· Morning$/)).toBeVisible()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(morning.getByRole('button', { name: /Morning complete/ })).toBeVisible()
  await expect(evening.getByRole('button', { name: '✓ Finish evening' })).toBeVisible()

  const s = await state(page)
  expect(s.finishedDays).toEqual([`${iso(0)}:am`])
  expect((s.overrides[iso(0)] as { exerciseId: string; session?: string }[]).map((p) => [p.exerciseId, p.session])).toEqual([[SQUAT, 'pm'], [PUSHUP, 'pm'], ['running', 'am']])

  // Home says what's next.
  await page.locator('nav').getByText('Home').click()
  await expect(page.getByRole('heading', { name: 'This evening' })).toBeVisible()

  // Each session has its own reminder time.
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('main').getByRole('button', { name: /^Notifications/ }).click()
  // (They show with the daily reminder on: the test setup has it off.)
  await expect(page.getByText('On two-session days')).toHaveCount(0)
  await page.getByRole('switch', { name: 'Daily reminder' }).click()
  await expect(page.getByText('On two-session days')).toBeVisible()
  await page.getByLabel('Morning reminder time').fill('06:15')
  expect((await state(page)).notifPrefs).toMatchObject({ daily: true, amTime: '06:15' })
})

test('back to one session', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: SQUAT, sets: 3, reps: 5, session: 'pm' }, { exerciseId: 'running', sets: 1, minutes: 30, session: 'am' }] } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await expect(page.getByRole('region', { name: 'Morning' })).toBeVisible()
  await page.getByRole('button', { name: 'Day options' }).click()
  await page.getByRole('button', { name: /^Morning & evening/ }).click()
  await page.getByRole('button', { name: 'Back to one session' }).click()
  await expect(page.getByRole('region', { name: 'Morning' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '✓ Finish workout' })).toBeVisible()
  expect((await state(page)).overrides[iso(0)].some((p: { session?: string }) => p.session)).toBe(false)
})
