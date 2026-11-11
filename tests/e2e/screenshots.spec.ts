import { test, expect } from '@playwright/test';

test.describe('Visual Screenshots', () => {
  test('capture cinematic intro scenes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Scene 1 - Bakery atmosphere
    await expect(page.locator('[aria-label="Brevo diagnostic settings"]')).toBeVisible();
    await page.screenshot({ path: 'screenshot-scene1-bakery.png', fullPage: true });

    // Wait for scene 2
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'screenshot-scene2-croissant.png', fullPage: true });

    // Wait for scene 3 (brand reveal)
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshot-scene3-brand.png', fullPage: true });

    // Wait for scene 4 (tagline)
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshot-scene4-tagline.png', fullPage: true });

    // Wait for intro to complete
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshot-homepage-after-intro.png', fullPage: true });
  });

  test('capture admin login page', async ({ page }) => {
    await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: 'screenshot-admin-login.png', fullPage: true });
  });

  test('capture responsive layouts', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.setItem('bb_cinematic_intro_shown', 'true'));
    await page.screenshot({ path: 'screenshot-desktop-homepage.png', fullPage: true });

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.setItem('bb_cinematic_intro_shown', 'true'));
    await page.screenshot({ path: 'screenshot-tablet-homepage.png', fullPage: true });

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.setItem('bb_cinematic_intro_shown', 'true'));
    await page.screenshot({ path: 'screenshot-mobile-homepage.png', fullPage: true });
  });
});
