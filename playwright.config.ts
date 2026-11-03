import { defineConfig } from '@playwright/test'

// Locally (or in a sandbox with its own Chromium) set PW_CHROMIUM to that browser's path; CI installs one.
const executablePath = process.env.PW_CHROMIUM || undefined
// Several checkouts testing at once each serve their build on their own port (PW_PORT).
const port = Number(process.env.PW_PORT) || 4173

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: `http://localhost:${port}`, viewport: { width: 400, height: 900 }, launchOptions: { executablePath } },
  webServer: { command: `npm run build && npx vite preview --port ${port} --strictPort`, url: `http://localhost:${port}`, reuseExistingServer: true, timeout: 180_000 },
})
