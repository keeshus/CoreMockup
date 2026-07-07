import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3102',
    headless: true,
  },
  webServer: [
    {
      command: 'node mock-llm/index.js',
      port: 3099,
      cwd: '..',
      timeout: 10000,
      reuseExistingServer: true,
    },
    {
      command: 'node mock-mcp/index.js',
      port: 3098,
      cwd: '..',
      timeout: 10000,
      reuseExistingServer: true,
    },
    {
      command: 'npx nodemon --env-file=.env backend/index.js',
      port: 3101,
      cwd: '..',
      timeout: 15000,
      reuseExistingServer: true,
    },
    {
      command: 'npm run frontend:dev',
      port: 3102,
      cwd: '..',
      timeout: 30000,
      reuseExistingServer: true,
    },
  ],
});
