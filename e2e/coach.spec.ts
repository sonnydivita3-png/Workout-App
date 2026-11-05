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
  for (const q of ['How long have you been training?', 'Which days can you train?', 'How long is a session?', 'What kinds of workout do you enjoy?', 'Any cardio you like?', 'Any areas you want extra work on?', 'Where do you train?']) {
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
  await trainer.getByRole('button', { name: 'Start my plan' }).click()

  const card = page.getByRole('region', { name: 'Your trainer' })
  await expect(card).toContainText('Lose 20 lb')
  await expect(card).toContainText(/Week 1 of \d+/)
  const s = await state(page)
  expect(s.coach.answers.goals.map((g: { kind: string }) => g.kind)).toEqual(['lose', 'move'])
  expect(s.programs.some((p: { title: string }) => p.title === 'Trainer: Lose weight + Move better')).toBe(true)
  expect(Object.keys(s.overrides).length).toBeGreaterThan(20)

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
