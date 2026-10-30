import { test as base, expect } from '@playwright/test'

/**
 * Every test also fails if the page throws an uncaught error along the way, or the security policy blocks anything
 * (a script, style, image, font or request the app needs).
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy|Refused to (load|connect|execute|apply)/i.test(m.text())) errors.push(m.text()) })
    await provide(page)
    expect(errors, 'uncaught errors in the page').toEqual([])
  },
})
export { expect }
