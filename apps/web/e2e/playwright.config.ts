import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { getE2eBaseUrl, getE2eDatabaseUrl } from './e2e-db.helper';

const repoRoot = path.resolve(__dirname, '../../..');
const e2eBaseUrl = getE2eBaseUrl();
const e2eDatabaseUrl = getE2eDatabaseUrl();

process.env.E2E_BASE_URL = e2eBaseUrl;
process.env.E2E_DATABASE_URL = e2eDatabaseUrl;

export default defineConfig({
  testDir: './',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: e2eBaseUrl,
    trace: 'on-first-retry',
    serviceWorkers: 'allow',
  },
  webServer: [
    {
      command: 'node scripts/e2e-api-server.mjs',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: false,
      cwd: repoRoot,
      env: {
        ...process.env,
        E2E_DATABASE_URL: e2eDatabaseUrl,
        E2E_API_PORT: '3001',
        E2E_WEB_PORT: '4201',
      },
      timeout: 60000,
    },
    {
      command: 'node scripts/serve-dist.mjs',
      url: e2eBaseUrl,
      reuseExistingServer: false,
      cwd: repoRoot,
      env: {
        ...process.env,
        PORT: '4201',
        API_PORT: '3001',
      },
      timeout: 15000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          args: ['--disable-lcd-text', '--disable-gpu'],
        },
      },
    },
  ],
});
