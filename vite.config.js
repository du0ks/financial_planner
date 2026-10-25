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
        name: 'Prosperity',
        short_name: 'Prosperity',
        description: 'Personal finances across accounts, cards, currencies and gold',
        theme_color: '#07050e',
        background_color: '#07050e',
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
        // /next/ is the new app (web/), with its own service worker: never cache it here or answer it with this page.
        globIgnores: ['next/**'],
        navigateFallbackDenylist: [/\/next\//],
        runtimeCaching: [
          {
            // Historical rates never change once published; today's are refreshed when online.
            urlPattern: /^https:\/\/(cdn\.jsdelivr\.net\/npm\/@fawazahmed0|[\w.-]*currency-api\.pages\.dev)\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'fx-rates',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
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
