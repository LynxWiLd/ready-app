import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));
const buildStamp = new Date().toISOString();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_STAMP__: JSON.stringify(buildStamp)
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt': la versión nueva espera y avisamos al usuario. Con
      // 'autoUpdate' la PWA instalada podía quedarse días con el código viejo.
      registerType: 'prompt',
      // El registro lo hace src/services/pwa.js con virtual:pwa-register.
      injectRegister: null,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Ready — Lector Local-First',
        short_name: 'Ready',
        description: 'Lector de libros y documentos (EPUB, PDF, TXT/Markdown) 100% local.',
        theme_color: '#4f46e5',
        background_color: '#111827',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        // No cachear APIs externas; es una app local-first.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // 'prompt': la versión nueva solo toma el control cuando el usuario
        // acepta el aviso. clientsClaim permite recargar en ese momento.
        skipWaiting: false,
        clientsClaim: true,
        // Lógica de recordatorios y clic en la notificación, en el scope del SW.
        importScripts: ['reminder-sw.js']
      }
    })
  ],
  server: {
    port: 5173,
    open: false
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          epub: ['epubjs'],
          pdf: ['pdfjs-dist'],
          zip: ['jszip']
        }
      }
    }
  }
});
