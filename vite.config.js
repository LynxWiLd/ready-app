import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
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
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024
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
