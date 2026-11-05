import { expect, test } from '@playwright/test'
import { iso, seed, state } from './helpers'

test('the trainer: goals, one question a screen, a plan as long as they take, and a weekly check-in', async ({ page }) => {
  await seed(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Build my plan' }).click()
  const trainer = page.getByRole('dialog', { name: 'Your trainer' })
  const next = () => trainer.getByRole('button', { name: 'Next', exact: true }).click()
  await trainer.getByRole('button', { name: 'Let’s start' }).click()

  // Two goals at once: losing weight leads.
  await expect(trainer.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await trainer.getByRole('button', { name: /^Lose weight/ }).click()
  await trainer.getByRole('button', { name: /^Move better/ }).click()
  await expect(trainer.getByRole('button', { name: /^Lose weight/ })).toContainText('1st')
  await next()

  await expect(trainer.getByLabel('Your weight now')).toHaveValue('180')
  await trainer.getByLabel('How much to lose').fill('20')
  await next()
  await expect(trainer.getByRole('heading', { name: 'What does moving better mean for you?' })).toBeVisible()
  await next() // posture and mobility, as suggested
  await expect(trainer.getByRole('heading', { name: 'How long have you been training?' })).toBeVisible()
  await next() // new to training
  // Free every day: the trainer picks the days, with rest days between.
  await expect(trainer.getByRole('heading', { name: 'Which days are you free to train?' })).toBeVisible()
  await next()
  await expect(trainer.getByRole('heading', { name: 'How many days a week should you train?' })).toBeVisible()
  await expect(trainer.getByRole('radio', { name: '3 ★' })).toHaveAttribute('aria-checked', 'true')
  await expect(trainer).toContainText('Your training days: Mon, Wed, Fri')
  await next()
  await trainer.getByRole('radio', { name: '90 min' }).click()
  await next()
  // Cardio: two-a-days, morning cardio and evening weights.
  await expect(trainer.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await trainer.getByRole('radio', { name: /^Two-a-days/ }).click()
  await next()
  await trainer.getByRole('radiogroup', { name: 'Cardio sessions a week' }).getByRole('radio', { name: '3' }).click()
  await trainer.getByRole('radiogroup', { name: 'Cardio minutes' }).getByRole('radio', { name: '30 min' }).click()
  await next()
  for (const q of ['Any cardio you like?', 'What kinds of workout do you enjoy?', 'Any areas you want extra work on?', 'Where do you train?']) {
    await expect(trainer.getByRole('heading', { name: q })).toBeVisible()
    await next()
  }
  // How weight change works, before any weight timeline.
  await expect(trainer.getByRole('heading', { name: 'How weight change works' })).toBeVisible()
  await expect(trainer).toContainText('plans and counts the training side only')
  await expect(trainer.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await trainer.getByLabel('I understand Durata covers the training side only').check()
  await next()

  await expect(trainer.getByRole('heading', { name: 'Your plan' })).toBeVisible()
  await expect(trainer).toContainText(/Lose 20 lb/)
  await expect(trainer).toContainText(/About \d+ weeks · about [\d.]+ lb a week from training/)
  await expect(trainer).toContainText(/Move better: posture, mobility/)
  await expect(trainer).toContainText(/cardio AM · .+ PM/)
  await trainer.getByRole('button', { name: 'Start my plan' }).click()

  const card = page.getByRole('region', { name: 'Your trainer' })
  await expect(card).toContainText('Lose 20 lb')
  await expect(card).toContainText(/Week 1 of \d+/)
  const s = await state(page)
  expect(s.coach.answers.goals.map((g: { kind: string }) => g.kind)).toEqual(['lose', 'move'])
  expect(s.programs.some((p: { title: string }) => p.title === 'Trainer: Lose weight + Move better')).toBe(true)
  expect(Object.keys(s.overrides).length).toBeGreaterThan(20)
  // Rest days stay rest days; lifting days are split into a morning and an evening session.
  const days = Object.entries(s.overrides as Record<string, { session?: string; minutes?: number }[]>).filter(([d]) => d >= iso(0)).slice(0, 14)
  expect(days.filter(([, items]) => items.length === 0).length).toBeGreaterThanOrEqual(4)
  const split = days.filter(([, items]) => items.some((p) => p.session === 'am'))
  expect(split.length).toBeGreaterThanOrEqual(4)
  for (const [, items] of split) expect(items.some((p) => p.session === 'pm')).toBe(true)

  // A check-in: progress for each goal, energy and soreness, then what changes and why.
  await card.getByRole('button', { name: 'Check in early' }).click()
  const check = page.getByRole('dialog', { name: /check-in/ })
  await check.getByLabel('Weigh-in').fill('178')
  await check.getByRole('radiogroup', { name: 'How does moving feel?' }).getByRole('radio', { name: '4 of 5' }).click()
  await check.getByRole('button', { name: 'Review my week' }).click()
  await expect(check.getByRole('heading', { name: 'What changes, and why' })).toBeVisible()
  await check.getByRole('button', { name: 'Save and update my plan' }).click()
  const after = await state(page)
  expect(after.coach.checkins).toHaveLength(1)
  expect(after.coach.checkins[0]).toMatchObject({ weightLb: 178, moveScore: 4 })
  expect(after.bodyweight.some((b: { date: string; lb: number }) => b.date === iso(0) && b.lb === 178)).toBe(true)

  // Stopping takes its workouts off the calendar.
  await card.getByRole('button', { name: 'Stop plan' }).click()
  await expect(page.getByRole('button', { name: 'Build my plan' })).toBeVisible()
  expect((await state(page)).coach).toBeNull()
})
