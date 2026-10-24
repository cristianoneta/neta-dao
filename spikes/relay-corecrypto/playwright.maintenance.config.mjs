import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'workspace-maintenance.spec.mjs',
  timeout: 30000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4179',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'python3 -m http.server 4179 --bind 127.0.0.1 --directory ../..',
    url: 'http://127.0.0.1:4179/index.html',
    reuseExistingServer: false
  }
});
