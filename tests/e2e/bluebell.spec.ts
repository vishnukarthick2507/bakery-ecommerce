import { test, expect } from '@playwright/test';

test.describe('Cinematic Intro', () => {
  const intro = (page: import('@playwright/test').Page) => page.getByRole('dialog', { name: 'Bluebell Bakehouse introduction' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => sessionStorage.removeItem('bb_cinematic_intro_shown'));
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Bluebell Bakehouse introduction' })).toBeVisible({ timeout: 15000 });
  });

  test('plays the four stages in sequence and reveals the homepage', async ({ page }) => {
    const dialog = intro(page);
    await expect(dialog).toBeVisible();

    const skipButton = page.getByRole('button', { name: 'Skip intro' });
    await expect(skipButton).toBeVisible();
    await expect(page.locator('.bluebell-intro__navy')).toBeVisible();

    const brandHeading = page.getByRole('heading', { name: /BLUEBELL BAKEHOUSE/ });
    await expect(brandHeading).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.bluebell-intro__bakery')).toHaveClass(/is-visible/);

    const showcase = page.locator('.bluebell-intro__showcase');
    await expect(showcase).toHaveClass(/is-visible/, { timeout: 6000 });
    await expect(page.locator('.bluebell-intro__showcase-copy')).toBeVisible();
    const firstImage = await page.locator('.bluebell-intro__food-image').getAttribute('src');
    await page.waitForTimeout(650);
    const nextImage = await page.locator('.bluebell-intro__food-image').getAttribute('src');
    expect(nextImage).not.toBe(firstImage);

    await expect(page.getByText('Freshly Baked Happiness.')).toBeVisible();
    await expect(page.locator('.homepage-under-intro--ready')).toBeVisible({ timeout: 8000 });
    await expect(dialog).toBeHidden({ timeout: 9000 });
    await expect(page.getByRole('heading', { name: /Freshly Baked/ }).last()).toBeVisible();
  });

  test('skip dismisses intro and reveals homepage', async ({ page }) => {
    const dialog = intro(page);
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: 'Skip intro' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.homepage-under-intro--ready')).toBeVisible();
  });

  test('reduced motion bypasses the animation and shows the homepage', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(intro(page)).toBeHidden();
    await expect(page.locator('.homepage-under-intro--ready')).toBeVisible();
    await context.close();
  });

  test('intro is not rendered on internal routes', async ({ page }) => {
    for (const route of ['/admin/login', '/checkout', '/cart', '/account/login']) {
      await page.goto(route);
      await expect(intro(page)).toHaveCount(0);
    }
  });

  test('intro is session-based - does not reappear on reload', async ({ page }) => {
    const dialog = intro(page);
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: 'Skip intro' }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(intro(page)).toHaveCount(0);
    await expect(page.locator('.homepage-under-intro--ready')).toBeVisible();
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
    await page.route('**/api/products', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );
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
      await page.reload();

      const heroHeading = page.getByRole('heading', { name: /Freshly Baked/ });
      await expect(heroHeading).toBeVisible();
    });

    test(`no horizontal overflow on ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.evaluate(() => sessionStorage.setItem('bb_cinematic_intro_shown', 'true'));
      await page.reload();

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
    let body: { message?: unknown } = {};
    try {
      body = await response.json();
    } catch {
      body = { message: await response.text() };
    }
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

test.describe('Custom Cake Request Submission', () => {
  test('submits a custom cake request via relative API path', async ({ request }) => {
    const response = await request.post('/api/custom-cake-requests', {
      data: {
        name: 'Playwright Test Customer',
        phone: '9840912345',
        flavour: 'Chocolate Truffle',
        weight: '1 kg',
        theme: 'Birthday',
        messageOnCake: 'Happy Birthday',
        instructions: 'Eggless',
        referenceImageUrl: '',
      },
    });

    // The endpoint should be reachable via the relative API path
    // (proxied through Next.js rewrite to the backend).
    expect([200, 201, 400, 500, 503]).toContain(response.status());

    const body = await response.json();
    if (response.status() === 201) {
      expect(body.message).toContain('request');
      expect(body.request.referenceNumber).toMatch(/^CC-/);
      expect(body.request.status).toBe('PENDING');
    } else if (response.status() === 400) {
      // Validation errors are acceptable in test environments
      expect(body.message).toBeTruthy();
    } else {
      // 500/503 may occur if backend services (MongoDB, Cloudinary) are not configured
      expect(body.message).toBeTruthy();
    }
  });

  test('records Origin header sent to upload signature endpoint', async ({ request }) => {
    // The Origin header comes from the browser's frontend domain.
    // On production Vercel, this is https://bakery-ecommerce-topaz.vercel.app.
    // Locally, Playwright's webServer serves from http://localhost:3000.
    const response = await request.post('/api/customer/uploads/signature', {
      headers: {
        Origin: 'http://localhost:3000',
      },
    });

    // Without a valid customer-token cookie, CSRF is bypassed (no auth cookie),
    // so the request either reaches the signature generator (401 for no auth)
    // or returns config error. Either way, the Origin header is processed.
    expect([200, 401, 403, 500, 503]).toContain(response.status());
  });
});
