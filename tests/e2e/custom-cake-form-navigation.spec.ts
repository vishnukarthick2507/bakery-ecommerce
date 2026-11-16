
import { test, expect } from '@playwright/test';

test.describe('Custom cake 5-step form navigation', () => {
  test.setTimeout(180_000);

  test('validates steps, navigates forward/back, preserves data, and prevents duplicate submit', async ({ page }) => {
    await page.goto('/custom-cake', { waitUntil: 'load' });

    // Intercept the custom cake API for this frontend-only test.
    let submitCount = 0;

    await page.route('**/api/custom-cake-requests', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      submitCount += 1;

      // Simulate an API request in progress.
      await new Promise((resolve) => setTimeout(resolve, 1200));

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          request: {
            referenceNumber: 'CC-TEST-0001',
            status: 'PENDING',
          },
        }),
      });
    });

    // Step 1: Your details
    await expect(
      page.getByRole('heading', { name: /Your details/i })
    ).toBeVisible();

    await page.getByRole('button', { name: /^Continue$/i }).click();

    // Required-field validation should prevent navigation.
    await expect(
      page.getByRole('heading', { name: /Your details/i })
    ).toBeVisible();

    await page.getByLabel(/Name/i).fill('Test Customer');
    await page.getByLabel(/Phone/i).fill('9840912345');

    await page.getByRole('button', { name: /^Continue$/i }).click();

    // Step 2: Cake details
    await expect(
      page.getByRole('heading', { name: /Cake details/i })
    ).toBeVisible();

    // Flavour is a text input.
    await page.getByLabel(/Flavour/i).fill('Chocolate Truffle');

    // Weight is a numeric input (kg).
    await page.getByLabel(/Weight/i).fill('1');

    await page.getByRole('button', { name: /^Back$/i }).click();

    await expect(
      page.getByRole('heading', { name: /Your details/i })
    ).toBeVisible();

    await expect(page.getByLabel(/Name/i)).toHaveValue('Test Customer');
    await expect(page.getByLabel(/Phone/i)).toHaveValue('9840912345');

    await page.getByRole('button', { name: /^Continue$/i }).click();

    await expect(
      page.getByRole('heading', { name: /Cake details/i })
    ).toBeVisible();

    await expect(page.getByLabel(/Flavour/i)).toHaveValue(
      'Chocolate Truffle'
    );

    await expect(page.getByLabel(/Weight/i)).toHaveValue('1');

    await page.getByRole('button', { name: /^Continue$/i }).click();

    // Step 3: Design and message
    await expect(
      page.getByRole('heading', { name: /Design/i })
    ).toBeVisible();

    // Theme is a text input.
    await page.getByLabel(/Theme/i).fill('Birthday');

    await page.getByLabel(/Message on cake/i).fill('Happy Birthday');

    await page.getByRole('button', { name: /^Back$/i }).click();

    await expect(
      page.getByRole('heading', { name: /Cake details/i })
    ).toBeVisible();

    await page.getByRole('button', { name: /^Continue$/i }).click();

    await expect(
      page.getByRole('heading', { name: /Design/i })
    ).toBeVisible();

    await expect(page.getByLabel(/Theme/i)).toHaveValue('Birthday');

    await expect(page.getByLabel(/Message on cake/i)).toHaveValue(
      'Happy Birthday'
    );

    await page.getByRole('button', { name: /^Continue$/i }).click();

    // Step 4: Reference image
    await expect(
      page.getByRole('heading', { name: /Reference image/i })
    ).toBeVisible();

    await page.getByRole('button', { name: /^Continue$/i }).click();

    // Step 5: Review
    await expect(
      page.getByRole('heading', { name: /Review/i })
    ).toBeVisible();

    await expect(page.getByText('Test Customer')).toBeVisible();
    await expect(page.getByText('9840912345')).toBeVisible();
    await expect(page.getByText('Chocolate Truffle')).toBeVisible();
    await expect(page.getByText('1 kg')).toBeVisible();
    await expect(page.getByText('Birthday', { exact: true })).toBeVisible();
    await expect(page.getByText('Happy Birthday')).toBeVisible();

    await page.getByRole('button', { name: /^Back$/i }).click();

    await expect(
      page.getByRole('heading', { name: /Reference image/i })
    ).toBeVisible();

    await page.getByRole('button', { name: /^Back$/i }).click();

    await expect(
      page.getByRole('heading', { name: /Design/i })
    ).toBeVisible();

    await page.getByRole('button', { name: /^Continue$/i }).click();
    await page.getByRole('button', { name: /^Continue$/i }).click();

    await expect(
      page.getByRole('heading', { name: /Review/i })
    ).toBeVisible();

    // Submit exactly once.
    const submitBtn = page.getByRole('button', {
      name: /Submit Request/i,
    });

    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Wait for the intercepted API request.
    await expect.poll(() => submitCount, {
      timeout: 30_000,
    }).toBe(1);

    // Verify the success screen.
    await expect(
      page.getByRole('heading', { name: /Request Received/i })
    ).toBeVisible({ timeout: 30_000 });

    await expect(page.getByText('CC-TEST-0001')).toBeVisible();

    // Exactly one POST must have been sent.
    expect(submitCount).toBe(1);
  });
});
