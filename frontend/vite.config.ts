import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8443,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8444',
        changeOrigin: true,
      },
      // WebSocket proxy: /ws/api/v1/... → ws://localhost:8444/api/v1/...
      '/ws/api': {
        target: 'ws://localhost:8444',
        ws: true,
        rewrite: (path) => path.replace(/^\/ws/, ''),
      },
    },
  },
})
