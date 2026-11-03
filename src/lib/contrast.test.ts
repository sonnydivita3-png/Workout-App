import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Text contrast, checked against the theme colours in index.css (WCAG 2 contrast ratio). Grey secondary text is
 * mostly small (12–14px), so it gets more than the 4.5:1 minimum, especially in the dark theme.
 */
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
const block = (selector: string) => css.slice(css.indexOf(selector), css.indexOf('}', css.indexOf(selector)))
const token = (src: string, name: string) => new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(src)![1]

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }

describe('text contrast', () => {
  it('dark theme: grey text is easy to read on cards and on input boxes', () => {
    const dark = block(':root[data-theme="dark"] {')
    const card = token(dark, 'surface')
    const input = token(dark, 'neutral-100')
    expect(ratio(token(dark, 'neutral-400'), card)).toBeGreaterThanOrEqual(7)
    expect(ratio(token(dark, 'neutral-500'), card)).toBeGreaterThanOrEqual(9)
    expect(ratio(token(dark, 'neutral-600'), card)).toBeGreaterThanOrEqual(11)
    expect(ratio(token(dark, 'neutral-700'), card)).toBeGreaterThanOrEqual(13)
    // Suggested weights and reps in the set boxes (placeholders) are neutral-400 on neutral-100.
    expect(ratio(token(dark, 'neutral-400'), input)).toBeGreaterThanOrEqual(5.5)
    // Chevrons, dividers and disabled text: visible, if quiet.
    expect(ratio(token(dark, 'neutral-300'), card)).toBeGreaterThanOrEqual(3)
  })
  it('light theme: grey text passes on white cards and input boxes', () => {
    const light = block('@theme {')
    expect(ratio(token(light, 'neutral-400'), '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(ratio(token(light, 'neutral-400'), token(light, 'neutral-100'))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(token(light, 'neutral-500'), '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })
  it('light theme: "▲ improved" green and "Delete" red read as small text on cards and on the page', () => {
    const light = block('@theme {')
    const page = token(light, 'page')
    for (const c of ['green-600', 'green-800', 'red-600']) {
      expect(ratio(token(light, c), '#ffffff')).toBeGreaterThanOrEqual(4.5)
      expect(ratio(token(light, c), page)).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('every vibe, both themes: the accent ink reads as text on cards and the page, and text on the accent reads too', () => {
    const light = block('@theme {')
    const dark = block(':root[data-theme="dark"] {')
    const vibes = ['lime', 'pink', 'violet', 'orange', 'blue']
    for (const v of vibes) {
      const l = block(`:root[data-accent="${v}"] {`)
      const d = block(`:root[data-theme="dark"][data-accent="${v}"] {`)
      for (const [vibe, bgs] of [[l, [token(light, 'surface'), token(light, 'page')]], [d, [token(dark, 'surface'), token(dark, 'page')]]] as const) {
        // The ink: wordmark, chart lines, focus rings.
        for (const bg of bgs) expect(ratio(token(vibe, 'accent-ink'), bg), v).toBeGreaterThanOrEqual(4.5)
        // Labels on accent buttons and chips.
        expect(ratio(token(vibe, 'on-accent'), token(vibe, 'accent')), v).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})
