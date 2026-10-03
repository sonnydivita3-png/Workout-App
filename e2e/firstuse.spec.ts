import { expect, test } from './fixtures'
import { iso, seed, state } from './helpers'

test('extra sets turned into warm-ups count as warm-ups when you finish', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: 'Barbell_Squat', sets: 4, reps: 5 }] } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  // Two more sets, made into warm-ups from the set number menu.
  await page.getByRole('button', { name: '+ Add set' }).click()
  await page.getByRole('button', { name: '+ Add set' }).click()
  for (let k = 0; k < 2; k++) {
    await page.getByRole('button', { name: 'Set 1 options', exact: true }).click()
    await page.getByRole('button', { name: /Make it a warm-up/ }).click()
  }
  await expect(page.getByRole('button', { name: 'Warm-up set 2 options' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Set 4 options', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Set 5 options', exact: true })).toHaveCount(0)
  for (const label of ['Warm-up set 1', 'Warm-up set 2', 'Set 1', 'Set 2', 'Set 3', 'Set 4']) {
    await page.getByLabel(`${label} lb`, { exact: true }).fill(label.startsWith('Warm') ? '95' : '185')
    await page.getByRole('button', { name: `${label} done`, exact: true }).click()
  }
  await page.getByRole('button', { name: '✓ Finish workout' }).click()
  // All six ticked: nothing missing, straight to the summary.
  await expect(page.getByRole('dialog', { name: 'Finish workout?' })).toHaveCount(0)
  await expect(page.getByText('Workout logged ✅')).toBeVisible()
  const log = (await state(page)).logs.find((l: { exerciseId: string }) => l.exerciseId === 'Barbell_Squat')
  expect(log.sets.filter((s: { warmup?: boolean }) => s.warmup)).toHaveLength(2)
})

test('bodyweight sets (0 lb or no weight) count as done and compare by reps', async ({ page }) => {
  await seed(page, {
    overrides: { [iso(0)]: [{ exerciseId: 'Dips_-_Chest_Version', sets: 3, reps: 10 }, { exerciseId: 'Ab_Roller', sets: 3, reps: 12 }] },
    logs: [{ date: iso(-7), exerciseId: 'Dips_-_Chest_Version', sets: [{ weight: 0, reps: 10 }, { weight: 0, reps: 10 }, { weight: 0, reps: 10 }] }],
  })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  // Dips: progression by reps, not "add 5 lb" to nothing.
  await expect(page.getByText(/🎯 Try 11 reps/)).toBeVisible()
  for (const n of [1, 2, 3]) {
    const dips = page.locator('div.rounded-2xl', { hasText: 'Chest Dip' }).first()
    await dips.getByLabel(`Set ${n} lb`).fill('0')
    await dips.getByLabel(`Set ${n} reps`).fill('12')
    await dips.getByRole('button', { name: `Set ${n} done` }).click()
  }
  // Done: the card folds up, showing the sets as reps (not "0×12") and that all three beat last time.
  await expect(page.getByText('3 of 3 sets · 12 reps · 12 reps · 12 reps · ▲ 3 beat last time')).toBeVisible()
  // Ab roller: reps only (no weight column), three sets ticked.
  const ab = page.locator('div.rounded-2xl', { hasText: 'Ab Roller' }).first()
  await expect(ab.getByLabel('Set 1 lb')).toHaveCount(0)
  for (const n of [1, 2, 3]) await ab.getByRole('button', { name: `Set ${n} done` }).click()
  await page.getByRole('button', { name: '✓ Finish workout' }).click()
  await expect(page.getByRole('dialog', { name: 'Finish workout?' })).toHaveCount(0)
  // The exercise rows (the personal-bests card above also names Chest Dip).
  const row = (name: string) => page.locator('li', { hasText: name }).last()
  await expect(page.getByRole('region', { name: 'New personal bests' })).toContainText('Chest Dip: 12 reps in a set (was 10)')
  await expect(row('Chest Dip')).toContainText('better')
  await expect(row('Ab Roller')).toContainText('first time')
  await expect(page.getByText('skipped')).toHaveCount(0)
  await page.getByRole('button', { name: 'Done', exact: true }).click()

  // Progress → Exercises: dips done with bodyweight chart reps, and every session lists its sets.
  await page.locator('nav').getByText('Progress').click()
  await page.getByRole('button', { name: 'Exercises', exact: true }).click()
  await page.getByRole('button', { name: /Chest Dip/ }).first().click()
  await expect(page.getByRole('button', { name: 'Best set' })).toBeVisible()
  await expect(page.getByText('12 reps', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('10 reps', { exact: true }).first()).toBeVisible()
})
