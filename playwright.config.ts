import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.MORO_E2E_PORT ?? '4187');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('MORO_E2E_PORT must be an integer from 1024 to 65535.');
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], ...(process.env.PLAYWRIGHT_CHANNEL === 'chrome' ? { channel: 'chrome' } : {}) },
  }],
  webServer: {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    command: `npm run build && npm exec vite preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
  },
});
