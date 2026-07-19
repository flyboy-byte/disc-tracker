// @ts-check
const { defineConfig } = require('@playwright/test');

// Dev-only test config — the shipped Flask app has no build step and doesn't depend on
// this file at all. Run with `npm run test:ui` (needs `npm install` once, and the Python
// venv from the main README active so `python3 app.py` can start).
module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5757',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'python3 app.py',
    url: 'http://localhost:5757/pick',
    reuseExistingServer: true,
    timeout: 15000,
  },
});
