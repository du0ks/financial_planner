import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/financial_planner/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'vite.svg'],
      manifest: {
        name: 'Prosperity Planner',
        short_name: 'Prosperity',
        description: 'Advanced Personal Financial Tracker',
        theme_color: '#064e3b', // Deep emerald
        background_color: '#000000', // Matches splash screen
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.gold-api\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'gold-api-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          }
        ]
      }
    })
  ]
});
