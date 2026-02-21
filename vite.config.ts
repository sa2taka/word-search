import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { coopCoep } from './src/vite-plugins/coop-coep'

export default defineConfig({
  plugins: [react(), coopCoep()],

  worker: {
    format: 'es',
  },

  resolve: {
    alias: {
      'sql.js': 'sql.js/dist/sql-wasm.js',
    },
  },

  optimizeDeps: {
    exclude: ['sql.js'],
  },

  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})
