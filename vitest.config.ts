import { defineConfig } from 'vitest/config'

// Minimal, app-plugin-free config for unit tests. Kept separate from
// vite.config.ts so Vitest doesn't spin up the TanStack Start / Nitro stack.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
