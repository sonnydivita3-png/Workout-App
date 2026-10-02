import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const APP_VERSION = process.env.VITE_APP_VERSION?.slice(0, 7) || 'dev'

/** version.json next to the app: phones compare it with the version they're running to know an update is out. */
const versionFile = (): Plugin => ({
  name: 'version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: APP_VERSION, builtAt: new Date().toISOString() }) })
  },
})

// BASE_PATH is set by the Pages deploy (e.g. "/workout-app/"); relative paths work everywhere else.
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  plugins: [
    react(),
    tailwindcss(),
    versionFile(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg', 'favicon.svg', 'favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Durata',
        short_name: 'Durata',
        description: 'Minimal weekly workout tracker',
        theme_color: '#0d0a15',
        background_color: '#0d0a15',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { importScripts: ['sw-notify.js'], globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        // Always fetched fresh: it's how the app finds out it's out of date.
        globIgnores: ['version.json'],
      },
    }),
  ],
})
