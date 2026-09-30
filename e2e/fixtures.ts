import { test as base, expect } from '@playwright/test'

/** Every test also fails if the page throws an uncaught error along the way. */
export const test = base.extend({
  page: async ({ page }, provide) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await provide(page)
    expect(errors, 'uncaught errors in the page').toEqual([])
  },
})
export { expect }
