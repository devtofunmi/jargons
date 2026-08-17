import { defineConfig } from 'vitest/config'

// Minimal, app-plugin-free config for unit tests. Kept separate from
// vite.config.ts so Vitest doesn't spin up the TanStack Start / Nitro stack.
//
// `node` stays the default environment — the pure-function tests don't need a
// DOM. A component test opts in per file with a `@vitest-environment jsdom`
// docblock.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
