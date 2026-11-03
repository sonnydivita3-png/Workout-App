/** A choice chip: the accent when picked. `hit` gives it a 44 px tap area without making a row of them taller. */
export const chipBtn = (on: boolean) => `hit rounded-full px-3 py-1.5 text-sm ${on ? 'bg-accent font-medium text-on-accent' : 'bg-neutral-100 text-neutral-600'}`

/**
 * Bring a card to the top of the screen, just below where a banner (toast) shows, so the exercise after a finished one
 * is in view and not under a banner. (Cards keep their scroll-mt-4 class: the e2e tests find cards by it.)
 */
export function scrollToTop(el: HTMLElement | null) {
  if (!el) return
  window.scrollTo({ top: Math.max(0, window.scrollY + el.getBoundingClientRect().top - 80), behavior: 'smooth' })
}
