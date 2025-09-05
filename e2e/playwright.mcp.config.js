import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../e2e-mcp',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3000',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  webServer: {
    command: 'node server.js',
    port: 3000,
    reuseExistingServer: true,
    env: {
      OPENAI_API_KEY: 'sk-dummy-key-for-e2e-tests',
      SQLITE_DB_PATH: './data/e2e-playwright.db',
      EMBED_STRATEGY: 'never',
    },
  },
});
