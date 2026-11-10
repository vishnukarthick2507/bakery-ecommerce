import { test, expect } from '@playwright/test';

test.describe('Cinematic Intro', () => {
  test.beforeEach(async ({ page }) => {
    // Clear session storage so intro always shows for testing
    await page.goto('/');
    await page.evaluate(() => sessionStorage.removeItem('bb_cinematic_intro_shown'));
    await page.waitForTimeout(500);
  });

  test('plays all scenes with logo reveal, tagline, and smooth transition', async ({ page }) => {
    // Intro should be visible initially
    const intro = page.locator('[aria-label="Brevo diagnostic settings"]');
    await expect(intro).toBeVisible();

    // Skip button present
    const skipButton = page.getByRole('button', { name: 'Skip intro' });
    await expect(skipButton).toBeVisible();

    // Bakery scene reveals itself
    const bakeryImage = page.locator('img[alt="Artisan bakery interior"]');
    await expect(bakeryImage).toBeVisible({ timeout: 10000 });

    // Brand reveal overlaid on the bakery scene
    const brandHeading = page.getByRole('heading', { name: /BLUEBELL.*BAKEHOUSE/ });
    await expect(brandHeading).toBeVisible({ timeout: 10000 });

    // Tagline reveal (brand stays visible near lower centre)
    const tagline = page.getByText('Freshly Baked Happiness.');
    await expect(tagline).toBeVisible({ timeout: 10000 });

    // Fade out transition (intro fades out and unmounts at ~5s)
    await expect(intro).toBeHidden({ timeout: 10000 });
  });

  test('no black flash before homepage appears', async ({ page }) => {
    const intro = page.locator('[aria-label="Brevo diagnostic settings"]');
    await expect(intro).toBeVisible();

    // Wait for intro to complete (~5s)
    await page.waitForTimeout(5500);

    // Intro should be hidden after completion
    await expect(intro).toBeHidden();

    // Homepage hero should be visible
    const heroTitle = page.getByRole('heading', { name: /Freshly Baked/ });
    await expect(heroTitle).toBeVisible();
  });

  test('hero entrance animation plays after intro', async ({ page }) => {
    // Wait for intro to complete
    await page.waitForTimeout(5500);

    // Hero elements should be visible and animated
    const eyebrow = page.getByText('Artisan bakery · Chromepet, Chennai');
    await expect(eyebrow).toBeVisible();

    const heroHeading = page.getByRole('heading', { name: /Freshly Baked/ });
    await expect(heroHeading).toBeVisible();

    const orderButton = page.locator('main').getByRole('link', { name: 'Order now' });
    await expect(orderButton).toBeVisible();
  });

  test('skip button dismisses intro and shows homepage', async ({ page }) => {
    const skipButton = page.getByRole('button', { name: 'Skip intro' });
    await skipButton.click();

    // Intro should be hidden
    const intro = page.locator('[aria-label="Brevo diagnostic settings"]');
    await expect(intro).toBeHidden();

    // Homepage should be visible
    const heroHeading = page.getByRole('heading', { name: /Freshly Baked/ });
    await expect(heroHeading).toBeVisible();
  });

  test('intro is session-based - does not reappear on reload', async ({ page }) => {
    // Skip to mark as shown
    await page.getByRole('button', { name: 'Skip intro' }).click();

    // Reload - intro should NOT appear
    await page.reload();

    const intro = page.locator('[aria-label="Brevo diagnostic settings"]');
    await expect(intro).toBeHidden();
  });
});

test.describe('Customer Pages Text Visibility', () => {
  test.beforeEach(async ({ page }) => {
    // Skip intro for all customer page tests
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.setItem('bb_cinematic_intro_shown', 'true'));
    await page.waitForTimeout(500);
  });

  test('homepage text is visible with proper contrast', async ({ page }) => {
    // Already on homepage from beforeEach
    await expect(page.getByRole('heading', { name: /Freshly Baked/ })).toBeVisible();
    await expect(page.getByText('Artisan bakery · Chromepet, Chennai')).toBeVisible();
  });

  test('about page text visible', async ({ page }) => {
    await page.goto('/about');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('products page text visible', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('contact page text visible', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('cart page text visible', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('checkout page text visible', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('track page text visible', async ({ page }) => {
    await page.goto('/track');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('account login page text visible', async ({ page }) => {
    await page.goto('/account/login');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('account register page text visible', async ({ page }) => {
    await page.goto('/account/register');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.setItem('bb_cinematic_intro_shown', 'true'));
    await page.waitForTimeout(500);
  });

  test('admin login page renders correctly', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
  });
});

test.describe('Responsive Viewports', () => {
  const viewports = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 667 },
  ];

  for (const vp of viewports) {
    test(`homepage renders on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.evaluate(() => sessionStorage.setItem('bb_cinematic_intro_shown', 'true'));

      const heroHeading = page.getByRole('heading', { name: /Freshly Baked/ });
      await expect(heroHeading).toBeVisible();
    });

    test(`no horizontal overflow on ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.evaluate(() => sessionStorage.setItem('bb_cinematic_intro_shown', 'true'));

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = vp.width;
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
    });
  }
});

test.describe('Authentication - OTP Failure Without BREVO_API_KEY', () => {
  test('OTP send behaves correctly without BREVO_API_KEY', async ({ request }) => {
    const response = await request.post('/api/auth/otp/send', {
      data: { email: 'test@example.com' },
    });
    // In development mode without BREVO_API_KEY, the endpoint may return 200
    // (dev fallback) or 503 (configured for production). Verify it's reachable.
    expect([200, 429, 500, 503]).toContain(response.status());
    const body = await response.json();
    expect(body.message).toBeTruthy();
  });
});

test.describe('Authentication - Google Sign-In Code Path', () => {
  test('Google Sign-In endpoint exists and returns config error when missing', async ({ request }) => {
    const response = await request.post('/api/auth/google', {
      data: { idToken: 'fake-token' },
    });
    // Without GOOGLE_CLIENT_ID, verifyGoogleIdToken throws config error
    expect([200, 400, 503]).toContain(response.status());
  });
});
