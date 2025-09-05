// Playwright config (ESM, since repo uses type: module)
// Minimal scaffolding for e2e UI layout checks only.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './',
  testMatch: '**/*.spec.js',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3000',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  webServer: {
    command: 'node ../server.js',
    port: 3000,
    reuseExistingServer: true,
    env: {
      // Use a dummy key to satisfy server startup validation (no external calls in tests)
      OPENAI_API_KEY: 'sk-dummy-key-for-e2e-tests',
      // Isolate e2e DB from dev data
      SQLITE_DB_PATH: './data/e2e-playwright.db',
      // Disable background embedding loop
      EMBED_STRATEGY: 'never',
    },
  },
});

