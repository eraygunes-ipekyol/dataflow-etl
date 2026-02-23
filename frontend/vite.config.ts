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
    port: 8462,
    host: 'localhost',
    proxy: {
      '/api': {
        target: 'http://localhost:8362',
        changeOrigin: true,
      },
      // WebSocket proxy: /ws/api/v1/... → ws://localhost:8362/api/v1/...
      '/ws/api': {
        target: 'ws://localhost:8362',
        ws: true,
        rewrite: (path) => path.replace(/^\/ws/, ''),
      },
    },
  },
})
