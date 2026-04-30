import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { coopCoep } from './src/vite-plugins/coop-coep'
import { localDict } from './src/vite-plugins/local-dict'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    coopCoep(),
    localDict(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Word Search - ローカル辞書検索',
        short_name: 'Word Search',
        description:
          '日英オフライン辞書検索アプリ。ワイルドカード・正規表現・イニシャルトーク・数字パターン・単語分割に対応。',
        theme_color: '#1e293b',
        background_color: '#f8fafc',
        lang: 'ja',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,wasm,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Don't cache dict files; those are managed by OPFS
        navigateFallbackDenylist: [/^\/dict\./],
      },
    }),
  ],

  worker: {
    format: 'es',
  },

  resolve: {
    alias: {
      'sql.js': 'sql.js/dist/sql-wasm.js',
    },
  },

  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react')) return 'react';
        },
      },
    },
  },
})
