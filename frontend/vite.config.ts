/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 5174 because that is the origin registered under "Authorised JavaScript origins" on the
    // Google OAuth client - see docs/google-signin.md. Google refuses sign-in from any other
    // origin, and the button renders either way, so the only symptom is a console error after
    // a click:
    //     [GSI_LOGGER]: The given origin is not allowed for the given client ID.
    // That is easy to misread as an app bug. If this port ever changes, add the new origin in
    // the Google Cloud Console as well, or register both.
    port: 5174,
    // Fail loudly rather than silently moving to 5174 when the port is taken. A different
    // port still serves the app, so the only symptom would be Google sign-in refusing to
    // work, which is a miserable thing to debug.
    strictPort: true,
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
