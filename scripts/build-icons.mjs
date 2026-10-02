// Regenerates every brand image from the Durata mark: app icons, favicons and iOS launch screens.
// Usage: node scripts/build-icons.mjs   (needs Chromium; set PW_CHROMIUM if Playwright can't find it)
import { chromium } from '@playwright/test'
import fs from 'fs'

const LIME = '#c8ff3e'
const BG = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1458"/><stop offset="1" stop-color="#0d0a15"/></linearGradient><radialGradient id="r" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="${LIME}" stop-opacity=".2"/><stop offset="1" stop-color="${LIME}" stop-opacity="0"/></radialGradient>`

/** The D: a solid bowl, and a straight side of `dots` dots (a full tank). Drawn in a 512 box. */
function mark(dots = 6, stroke = 44) {
  const r = stroke / 2 - 1
  const bowl = `<path d="M196 130H244A126 126 0 0 1 244 382H196" fill="none" stroke="${LIME}" stroke-width="${stroke}" stroke-linecap="round"/>`
  const circles = Array.from({ length: dots }, (_, i) => `<circle cx="144" cy="${(382 - (i * 252) / (dots - 1)).toFixed(1)}" r="${r}"/>`).join('')
  return `${bowl}<g fill="${LIME}">${circles}</g>`
}

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${BG}</defs><rect width="512" height="512" fill="url(#g)"/><rect width="512" height="512" fill="url(#r)"/>${mark()}</svg>`
// Favicon: bigger mark, thicker strokes and fewer dots so it still reads at 16px; rounded like a tab icon.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${BG}</defs><rect width="512" height="512" rx="112" fill="url(#g)"/><g transform="translate(256 256) scale(1.32) translate(-262 -256)">${mark(4, 56)}</g></svg>`
// The mark alone, cropped, for the loading screen.
const bare = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="118 104 280 304">${mark()}</svg>`

fs.writeFileSync('public/icon.svg', icon)
fs.writeFileSync('public/favicon.svg', favicon)

// iOS launch screens (portrait): CSS width, height, pixel ratio.
const SCREENS = [
  [440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [375, 812, 3],
  [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2], [320, 568, 2],
  [1024, 1366, 2], [834, 1194, 2], [820, 1180, 2], [810, 1080, 2], [768, 1024, 2], [744, 1133, 2],
]
const font = fs.readFileSync('node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2').toString('base64')
const splashHtml = (w) => `<html><head><style>
@font-face { font-family: B; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 200 800; }
html, body { margin: 0; height: 100%; }
body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${Math.round(w * 0.06)}px;
  background: radial-gradient(60% 45% at 50% 42%, rgba(200,255,62,.16), transparent), linear-gradient(160deg, #2a1458, #0d0a15 70%); }
svg { width: ${Math.round(Math.min(w, 600) * 0.3)}px; }
p { margin: 0; font: 700 ${Math.round(Math.min(w, 600) * 0.07)}px B; letter-spacing: .32em; padding-left: .32em; color: ${LIME}; }
</style></head><body>${bare}<p>DURATA</p></body></html>`

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined })
const page = await browser.newPage()
async function png(svg, n, path) {
  await page.setViewportSize({ width: n, height: n })
  await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${n}" height="${n}" `)}</body>`)
  return page.screenshot({ path, omitBackground: true })
}
await png(icon, 512, 'public/pwa-512.png')
await png(icon, 192, 'public/pwa-192.png')
await png(icon, 180, 'public/apple-touch-icon.png')

// favicon.ico: 16, 32 and 48 px PNGs in one file, for browsers without SVG favicons.
const sizes = [16, 32, 48]
const pngs = []
for (const n of sizes) pngs.push(await png(favicon, n))
const head = Buffer.alloc(6 + 16 * sizes.length)
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4)
let offset = head.length
sizes.forEach((n, i) => {
  const e = 6 + 16 * i
  head.writeUInt8(n, e); head.writeUInt8(n, e + 1); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6)
  head.writeUInt32LE(pngs[i].length, e + 8); head.writeUInt32LE(offset, e + 12)
  offset += pngs[i].length
})
fs.writeFileSync('public/favicon.ico', Buffer.concat([head, ...pngs]))

fs.mkdirSync('public/splash', { recursive: true })
const links = []
for (const [w, h, dpr] of SCREENS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr })
  const p = await ctx.newPage()
  await p.setContent(splashHtml(w))
  await p.evaluate(() => document.fonts.ready)
  const name = `splash/${w * dpr}x${h * dpr}.jpg`
  await p.screenshot({ path: `public/${name}`, type: 'jpeg', quality: 85 })
  await ctx.close()
  links.push(`    <link rel="apple-touch-startup-image" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" href="./${name}" />`)
}
await browser.close()
// Swap the launch-screen links in index.html (the mark in its loading screen is hand-copied from `bare`).
const html = fs.readFileSync('index.html', 'utf8').replace(/(    <!-- iOS launch screens.*-->\n)(    <link rel="apple-touch-startup-image".*\n)*/, `$1${links.join('\n')}\n`)
fs.writeFileSync('index.html', html)
console.log(`Wrote icons, favicons and ${SCREENS.length} launch screens.`)
