import { expect, test } from './fixtures'
import { iso, openSettings, seed, state } from './helpers'
import type { Page } from '@playwright/test'

const form = (page: Page, title: string) => page.locator('.fixed').filter({ has: page.getByRole('heading', { name: title }) })
const chip = (f: ReturnType<typeof form>, group: string, name: string) => f.getByRole('group', { name: group }).getByRole('button', { name, exact: true })

test('your own exercise: made from the exercise list, logged like any other, changed later; names already in the list are caught', async ({ page }) => {
  await seed(page)
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: 'Add exercises' }).click()
  const picker = page.locator('.fixed').filter({ has: page.getByRole('heading', { name: 'Add exercise' }) })
  await picker.getByRole('button', { name: '+ Custom exercise' }).click()

  const make = form(page, 'New exercise')
  const save = make.getByRole('button', { name: 'Save exercise' })
  await expect(save).toBeDisabled()
  await make.getByLabel('Name').fill('Landmine Press')
  await expect(make.getByText('Pick a body part')).toBeVisible()
  await chip(make, 'Body part', 'Shoulders').click()
  await expect(save).toBeDisabled()
  await chip(make, 'Equipment', 'Barbell').click()
  await expect(chip(make, 'Log it with', 'Weight × reps')).toHaveAttribute('aria-pressed', 'true')
  await save.click()
  await expect(make).toHaveCount(0)

  // It's added straight away, and listed under the body part with its equipment.
  await expect(picker.getByRole('button', { name: /^Landmine Press.*Added/ })).toBeDisabled()
  await picker.getByRole('group', { name: 'Body part' }).getByRole('button', { name: 'Shoulders', exact: true }).click()
  await picker.getByPlaceholder(/search/i).fill('landmine')
  await expect(picker.getByRole('button', { name: /^Landmine Press/ })).toBeVisible()
  await picker.getByRole('button', { name: 'Equipment filter: any' }).click()
  await picker.getByRole('group', { name: 'Equipment' }).getByRole('button', { name: /^Barbell/ }).click()
  await expect(picker.getByRole('button', { name: /^Landmine Press/ })).toBeVisible()
  const saved = (await state(page)).custom[0]
  expect(saved).toMatchObject({ name: 'Landmine Press', kind: 'strength', mode: 'weight', group: 'Shoulders', equipment: 'Barbell', custom: true })

  // Change it from the list (✎).
  await picker.getByRole('button', { name: 'Edit Landmine Press' }).click()
  const edit = form(page, 'Edit exercise')
  await edit.getByLabel('Name').fill('Landmine Push Press')
  await edit.getByRole('button', { name: 'Save changes' }).click()
  await expect(edit).toHaveCount(0)
  await picker.getByPlaceholder(/search/i).fill('')

  // A name the list already has: say so, and offer that one instead.
  await picker.getByRole('button', { name: '+ Custom exercise' }).click()
  await make.getByLabel('Name').fill('bench press')
  await expect(make.getByText('“Bench Press” is already in the list.')).toBeVisible()
  await chip(make, 'Body part', 'Chest').click()
  await chip(make, 'Equipment', 'Barbell').click()
  await expect(save).toBeDisabled()
  await make.getByRole('button', { name: 'Use it' }).click()
  await expect(make).toHaveCount(0)
  await picker.getByRole('button', { name: 'Done' }).click()

  // Logged like any lift.
  const card = page.locator('.scroll-mt-4').filter({ has: page.getByRole('button', { name: 'Landmine Push Press', exact: true }) })
  await card.getByRole('spinbutton', { name: 'Set 1 lb' }).fill('65')
  await card.getByRole('spinbutton', { name: 'Set 1 reps' }).fill('10')
  await expect.poll(async () => (await state(page)).logs.find((l: { exerciseId: string }) => l.exerciseId === saved.id)?.sets[0]).toMatchObject({ weight: 65, reps: 10 })
  await expect(page.getByRole('button', { name: 'Bench Press', exact: true })).toBeVisible()
  expect((await state(page)).custom).toHaveLength(1)
})

test('settings: your own exercises listed, changed and deleted; one you have logged stays in your history', async ({ page }) => {
  const zercher = { id: 'custom-z', name: 'Sandbag Zercher Carry', kind: 'strength', mode: 'weight', group: 'Quads', equipment: 'Other', custom: true }
  const typo = { id: 'custom-t', name: 'Typo Pres', kind: 'strength', mode: 'weight', group: 'Chest', equipment: 'Barbell', custom: true }
  await seed(page, { custom: [zercher, typo], favorites: ['custom-z'], logs: [{ date: iso(-1), exerciseId: 'custom-z', sets: [{ weight: 135, reps: 8 }] }] })
  await page.goto('/')
  await openSettings(page, 'Workouts')
  const list = page.getByRole('list', { name: 'Your own exercises' })
  await expect(list.getByRole('button', { name: 'Edit Sandbag Zercher Carry' })).toContainText('Quads · Other · weight × reps')

  // Nothing uses this one: gone completely.
  await list.getByRole('button', { name: 'Edit Typo Pres' }).click()
  const edit = form(page, 'Edit exercise')
  await edit.getByRole('button', { name: 'Delete exercise' }).click()
  await expect(edit.getByText('Delete it?', { exact: true })).toBeVisible()
  await edit.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(list.getByRole('button', { name: 'Edit Typo Pres' })).toHaveCount(0)
  expect((await state(page)).custom.map((e: { id: string }) => e.id)).toEqual(['custom-z'])

  // Logged: it stays a lift, and deleting only hides it.
  await list.getByRole('button', { name: 'Edit Sandbag Zercher Carry' }).click()
  await expect(edit.getByText('Logged on 1 day, so it stays a lifting exercise.')).toBeVisible()
  await expect(chip(edit, 'Body part', 'Cardio')).toBeDisabled()
  await edit.getByRole('button', { name: 'Delete exercise' }).click()
  await expect(edit.getByText('Delete it? Your history keeps it.')).toBeVisible()
  await edit.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(list.getByRole('button', { name: /^Edit/ })).toHaveCount(0)
  const s = await state(page)
  expect(s.custom).toEqual([{ ...zercher, retired: true }])
  expect(s.favorites).toEqual([])

  // A new one from Settings.
  await list.getByRole('button', { name: '+ New exercise' }).click()
  const make = form(page, 'New exercise')
  await make.getByLabel('Name').fill('Rucking')
  await chip(make, 'Body part', 'Cardio').click()
  await expect(make.getByRole('group', { name: 'Log it with' })).toHaveCount(0)
  await chip(make, 'Equipment', 'Outdoor').click()
  await make.getByRole('button', { name: 'Save exercise' }).click()
  await expect(list.getByRole('button', { name: 'Edit Rucking' })).toContainText('Cardio · Outdoor · time and distance')

  // History still has the deleted one; the exercise list doesn't.
  await page.locator('nav').getByText('Progress').click()
  await page.getByRole('button', { name: 'Exercises' }).click()
  await expect(page.getByText('Sandbag Zercher Carry', { exact: true })).toBeVisible()
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: 'Add exercises' }).click()
  await page.getByPlaceholder(/search/i).fill('zercher')
  await expect(page.getByRole('button', { name: /^Zercher Squats/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Sandbag Zercher Carry/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Create “zercher”/ })).toBeVisible()
})
