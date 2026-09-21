import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// Em produção o site vive em https://kowalsq.github.io/gym/. Em dev fica na raiz.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/gym/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Ferro',
        short_name: 'Ferro',
        description: 'Registro de treino: séries, repetições e carga.',
        lang: 'pt-BR',
        theme_color: '#141619',
        background_color: '#141619',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Rotas do app caem no index; nada de rede é necessário depois do primeiro acesso.
        navigateFallback: command === 'build' ? '/gym/index.html' : '/index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
