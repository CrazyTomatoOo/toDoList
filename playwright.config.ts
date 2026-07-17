import { defineConfig } from '@playwright/test'

process.env.E2E_TEST = '1'

export default defineConfig({
  testDir: './src/__tests__/e2e',
  testMatch: /.*\.spec\.ts/,
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: 'list',
  outputDir: './.sisyphus/test-results',
})
