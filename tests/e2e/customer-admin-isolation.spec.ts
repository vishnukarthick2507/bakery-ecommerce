import { expect, test } from '@playwright/test'

const SYNTHETIC_CUSTOMER = {
  id: 'synthetic-customer-id',
  name: 'Synthetic Customer',
  email: 'synthetic-customer@example.test',
  phone: '9000000000',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

async function expectAdminLoginRedirect(
  page: import('@playwright/test').Page,
  path: string,
) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/admin\/login$/)
  await expect(page.getByRole('heading', { name: /admin login/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^login$/i })).toBeVisible()
}

async function expectNoProtectedAdminDashboard(page: import('@playwright/test').Page) {
  await expect(page.getByRole('heading', { name: /^admin dashboard$/i })).toHaveCount(0)
  await expect(page.getByText('Manage your bakery orders and business operations.')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /view store/i })).toHaveCount(0)
}

async function expectNoProtectedAdminProductsUi(page: import('@playwright/test').Page) {
  await expect(
    page.getByRole('heading', { level: 1, name: /^products$/i }),
  ).toHaveCount(0)
  await expect(page.getByText('Manage products, prices, stock and availability.')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /\+ add product/i })).toHaveCount(0)
}

async function expectNoProtectedAdminOrdersUi(page: import('@playwright/test').Page) {
  await expect(
    page.getByRole('heading', { level: 1, name: /^orders$/i }),
  ).toHaveCount(0)
  await expect(page.getByText('View and manage customer orders.')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /refresh orders/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^active orders$/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^archived orders$/i })).toHaveCount(0)
}

async function expectCustomerProductsRouteUsable(page: import('@playwright/test').Page) {
  await page.goto('/products', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/products(?:\?.*)?$/)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await expect(page.locator('text=Application error')).toHaveCount(0)
  await expect(page.locator('text=Unhandled Runtime Error')).toHaveCount(0)
}

test.describe('Customer/admin isolation (mocked customer UI session)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock only the minimum customer-facing auth response needed to simulate an
    // app-perceived authenticated customer. No cookies or tokens are set.
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: SYNTHETIC_CUSTOMER }),
      })
    })
  })

  test('mocked customer session cannot access /admin and customer route remains usable', async ({ page }) => {
    await expectAdminLoginRedirect(page, '/admin')
    await expectNoProtectedAdminDashboard(page)
    await expectCustomerProductsRouteUsable(page)
  })

  test('mocked customer session cannot access /admin/products and customer route remains usable', async ({ page }) => {
    await expectAdminLoginRedirect(page, '/admin/products')
    await expectNoProtectedAdminProductsUi(page)
    await expectCustomerProductsRouteUsable(page)
  })

  test('mocked customer session cannot access /admin/orders and customer route remains usable', async ({ page }) => {
    await expectAdminLoginRedirect(page, '/admin/orders')
    await expectNoProtectedAdminOrdersUi(page)
    await expectCustomerProductsRouteUsable(page)
  })

  test('customer route continuity: /account/landing remains usable after admin redirect under mocked customer session', async ({ page }) => {
    await expectAdminLoginRedirect(page, '/admin')
    await expectNoProtectedAdminDashboard(page)

    // /account/landing calls /api/auth/me client-side and may redirect to /account
    // when a customer user is present; both outcomes are customer-facing (no admin UI).
    await page.goto('/account/landing', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/account(\/landing)?(?:\?.*)?$/)
    await expect(page).not.toHaveURL(/\/admin(?:\/|$)/)
    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('text=Application error')).toHaveCount(0)
    await expect(page.locator('text=Unhandled Runtime Error')).toHaveCount(0)
  })
})

test.describe('Unauthenticated control (supplementary)', () => {
  test('unauthenticated access redirects admin routes and keeps admin login public', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    try {
      await expectAdminLoginRedirect(page, '/admin')
      await expectNoProtectedAdminDashboard(page)

      await expectAdminLoginRedirect(page, '/admin/products')
      await expectNoProtectedAdminProductsUi(page)

      await expectAdminLoginRedirect(page, '/admin/orders')
      await expectNoProtectedAdminOrdersUi(page)

      await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/admin\/login$/)
      await expect(page.getByRole('heading', { name: /admin login/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /^login$/i })).toBeVisible()
    } finally {
      await context.close()
    }
  })
})
