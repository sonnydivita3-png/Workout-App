import { defineConfig } from '@playwright/test'

// Locally (or in a sandbox with its own Chromium) set PW_CHROMIUM to that browser's path; CI installs one.
const executablePath = process.env.PW_CHROMIUM || undefined

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:4173', viewport: { width: 400, height: 900 }, launchOptions: { executablePath } },
  webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 180_000 },
})
