import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Ferro',
        short_name: 'Ferro',
        description: 'Registro de treino: séries, repetições e carga.',
        lang: 'pt-BR',
        theme_color: '#141619',
        background_color: '#141619',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        // TODO: gerar icon-192.png e icon-512.png a partir de favicon.svg para instalação no Android.
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
