import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { coopCoep } from './src/vite-plugins/coop-coep'
import { localDict } from './src/vite-plugins/local-dict'

export default defineConfig({
  base: '/',
  plugins: [react(), coopCoep(), localDict()],

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
