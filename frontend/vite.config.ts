/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    // Bind every interface rather than the loopback default. Node's resolution of
    // "localhost" here yields the IPv6 loopback only, so 127.0.0.1 gets no answer and a
    // browser that prefers IPv4 (Safari, sometimes Chrome) fails to load the page at all.
    // This also makes the dev server reachable from a phone or tablet on the same network.
    host: true,
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
