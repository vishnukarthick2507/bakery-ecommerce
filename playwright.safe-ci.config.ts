import { defineConfig, devices } from '@playwright/test';

// Frontend-only browser regression suite. The selected specs use synthetic data
// and intercept their API dependencies; deliberately do not start the backend.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: [
    'custom-cake-form-navigation.spec.ts',
    'cart-consistency.spec.ts',
    'customer-admin-isolation.spec.ts',
    'checkout-delivery-address-validation.spec.ts',
  ],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
