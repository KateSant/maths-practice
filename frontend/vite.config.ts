/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    // Proxying /api in development means the browser sees a single origin, exactly
    // as it will behind Caddy in production. No CORS, in either environment.
    proxy: {
      '/api': { target: 'http://localhost:8081', changeOrigin: true },
    },
  },
  test: {
    // The current tests cover pure logic, so no DOM environment is needed.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
