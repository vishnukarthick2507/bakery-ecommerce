import { expect, test, type Page, type Route } from '@playwright/test'

const CART_KEY = 'sv-sweets-cart-v1'

const MOCK_PRODUCTS = [
  {
    _id: '6afccbda175fa4fb28f69450',
    name: 'Classic Chocolate Cake',
    slug: 'classic-chocolate-cake',
    description: 'Rich chocolate cake',
    price: 650,
    category: 'cakes',
    images: ['/placeholder.svg'],
    stock: 20,
    availability: 'AVAILABLE_NOW',
    active: true,
  },
  {
    _id: '6afccbda175fa4fb28f69453',
    name: 'Chocolate Brownie',
    slug: 'chocolate-brownie',
    description: 'Fudgy brownie',
    price: 120,
    category: 'brownies',
    images: ['/placeholder.svg'],
    stock: 20,
    availability: 'AVAILABLE_NOW',
    active: true,
  },
]

async function mockProductsApi(page: Page, opts?: { fail?: boolean; empty?: boolean; delayMs?: number }) {
  await page.route('**/api/products', async (route: Route) => {
    if (opts?.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs))
    if (opts?.fail) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'fail' }) })
      return
    }
    if (opts?.empty) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PRODUCTS) })
  })
}

async function seedCartStorage(page: Page, value: unknown) {
  await page.addInitScript(([key, v]) => {
    window.localStorage.setItem(key as string, JSON.stringify(v))
  }, [CART_KEY, value] as const)
}

function classicLine(variantId = '6afccbda175fa4fb28f69450-default', quantity = 1) {
  return { productId: '6afccbda175fa4fb28f69450', variantId, quantity }
}
function brownieLine(variantId = '6afccbda175fa4fb28f69453-default', quantity = 1) {
  return { productId: '6afccbda175fa4fb28f69453', variantId, quantity }
}

test.describe('Cart consistency (Stage 4B+2C)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => sessionStorage.setItem('bb_cinematic_intro_shown', 'true'))
  })

  test('reconciliation: valid product/variant kept and renders correctly', async ({ page }) => {
    await mockProductsApi(page)
    await seedCartStorage(page, [classicLine(undefined, 2)])
    await page.goto('/cart')
    await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible()
    await expect(page.getByText('2 items in your cart.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Classic Chocolate Cake' })).toBeVisible()
    await expect(page.getByText('Subtotal').locator('..').getByText('₹1,300')).toBeVisible()
  })

  test('reconciliation: unknown product, unknown variant, legacy default, malformed removed on successful load', async ({ page }) => {
    await mockProductsApi(page)
    await seedCartStorage(page, [
      classicLine(undefined, 1),
      { productId: '000000000000000000000000', variantId: '000000000000000000000000-default', quantity: 1 }, // unknown product
      { productId: '6afccbda175fa4fb28f69450', variantId: 'nope', quantity: 1 }, // unknown variant
      { productId: '6afccbda175fa4fb28f69450', variantId: 'default', quantity: 2 }, // legacy
      { bad: true }, // malformed
      'oops',
    ])
    await page.goto('/cart')
    await expect(page.getByText('1 item in your cart.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Classic Chocolate Cake' })).toHaveCount(1)
    await expect(page.locator('header')).not.toContainText('Cart2')
    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), CART_KEY)
    expect(stored).toEqual([classicLine(undefined, 1)])
  })

  test('mixed valid/invalid: no phantom badge/count/rows/subtotal', async ({ page }) => {
    await mockProductsApi(page)
    await seedCartStorage(page, [
      classicLine(undefined, 2),
      brownieLine(undefined, 2),
      { productId: '6afccbda175fa4fb28f69453', variantId: 'default', quantity: 3 },
      { productId: 'deadbeefdeadbeefdeadbeef', variantId: 'default', quantity: 5 },
    ])
    await page.goto('/cart')
    await expect(page.getByText('4 items in your cart.')).toBeVisible()
    await expect(page.getByLabel('Open cart, 4 items').filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Classic Chocolate Cake' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Chocolate Brownie' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Classic|Brownie/ })).toHaveCount(2)
    await expect(page.getByText('Subtotal').locator('..').getByText('₹1,540')).toBeVisible()
  })

  test('invalid-only cart becomes empty state with no phantom count', async ({ page }) => {
    await mockProductsApi(page)
    await seedCartStorage(page, [
      { productId: '6afccbda175fa4fb28f69450', variantId: 'default', quantity: 2 },
      { productId: '000000000000000000000000', variantId: '000000000000000000000000-default', quantity: 1 },
      null,
    ])
    await page.goto('/cart')
    await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible()
    await expect(page.getByText('4 items in your cart.')).toHaveCount(0)
    await expect(page.getByText(/\b\d+ items? in your cart\./)).toHaveCount(0)
    // header cart button exists but must not show a non-zero badge/count
    await expect(page.getByLabel('Open cart, 0 items').filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByLabel(/Open cart, [1-9]/)).toHaveCount(0)
    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), CART_KEY)
    expect(stored).toEqual([])
  })

  test('empty cart stored remains empty', async ({ page }) => {
    await mockProductsApi(page)
    await seedCartStorage(page, [])
    await page.goto('/cart')
    await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible()
  })

  test('catalogue request failure does not destroy valid stored cart entries', async ({ page }) => {
    await mockProductsApi(page, { fail: true })
    await seedCartStorage(page, [classicLine(undefined, 2), brownieLine(undefined, 1)])
    await page.goto('/cart')
    await expect(page.getByRole('heading', { name: 'Unable to load your cart' })).toBeVisible()
    await expect(page.getByText('Your saved cart items are kept in this browser.')).toBeVisible()
    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), CART_KEY)
    expect(stored).toEqual([classicLine(undefined, 2), brownieLine(undefined, 1)])
  })

  test('catalogue returns empty list reconciles to empty (no phantom)', async ({ page }) => {
    await mockProductsApi(page, { empty: true })
    await seedCartStorage(page, [classicLine(undefined, 1)])
    await page.goto('/cart')
    await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible()
    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), CART_KEY)
    expect(stored).toEqual([])
  })

  test('products loading keeps stored data intact (not discarded) and shows loading state', async ({ page }) => {
    await mockProductsApi(page, { delayMs: 1500 })
    await seedCartStorage(page, [classicLine(undefined, 2)])
    await page.goto('/cart')
    await expect(page.getByText('Loading your cart…')).toBeVisible()
    const storedDuring = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), CART_KEY)
    expect(storedDuring).toEqual([classicLine(undefined, 2)])
    await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible()
    await expect(page.getByText('2 items in your cart.')).toBeVisible()
  })

  test('Remove button has stable item-specific accessible name and removes correct row', async ({ page }) => {
    await mockProductsApi(page)
    await seedCartStorage(page, [classicLine(undefined, 1), brownieLine(undefined, 1)])
    await page.goto('/cart')
    const brownieRemove = page.getByRole('button', { name: 'Remove Chocolate Brownie from cart' })
    await expect(brownieRemove).toBeVisible()
    await expect(brownieRemove).toHaveText('Remove')
    await brownieRemove.click()
    await expect(page.getByRole('link', { name: 'Chocolate Brownie' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Classic Chocolate Cake' })).toBeVisible()
    await expect(page.getByText('1 item in your cart.')).toBeVisible()
  })

  test('UI interaction regression: add, qty changes, expected ₹1660, remove, empty, persistence/navigation', async ({ page }) => {
    test.setTimeout(120000)
    await mockProductsApi(page)

    // Add Classic Chocolate Cake (card add) and go to cart
    await page.goto('/products')
    await page.getByRole('button', { name: /Add Classic Chocolate Cake, Standard, ₹650 to cart/i }).click()
    await page.goto('/cart')
    await expect(page.getByText('1 item in your cart.')).toBeVisible()

    // Increase Classic to 2
    await page.getByRole('button', { name: 'Increase Classic Chocolate Cake quantity' }).click()
    await expect(page.getByText('Subtotal').locator('..').getByText('₹1,300')).toBeVisible()

    // Add Chocolate Brownie
    await page.goto('/products')
    await page.getByRole('button', { name: /Add Chocolate Brownie, Standard, ₹120 to cart/i }).click()
    await page.goto('/cart')
    await expect(page.getByText('3 items in your cart.')).toBeVisible()

    // Increase Brownie to 3
    const incBrownie = page.getByRole('button', { name: 'Increase Chocolate Brownie quantity' })
    await incBrownie.click()
    await incBrownie.click()
    await expect(page.getByText('Subtotal').locator('..').getByText('₹1,660')).toBeVisible()
    await expect(page.locator('span.text-xl.font-bold', { hasText: '₹1,660' })).toBeVisible()
    await expect(page.getByText('5 items in your cart.')).toBeVisible()

    // Decrease brownie by 1
    await page.getByRole('button', { name: 'Decrease Chocolate Brownie quantity' }).click()
    await expect(page.getByText('Subtotal').locator('..').getByText('₹1,540')).toBeVisible()

    // Remove brownie
    await page.getByRole('button', { name: 'Remove Chocolate Brownie from cart' }).click()
    await expect(page.getByRole('link', { name: 'Chocolate Brownie' })).toHaveCount(0)
    await expect(page.getByText('Subtotal').locator('..').getByText('₹1,300')).toBeVisible()

    // Persistence: refresh and navigate away/back
    await page.reload()
    await expect(page.getByRole('link', { name: 'Classic Chocolate Cake' })).toBeVisible()
    await expect(page.getByText('2 items in your cart.')).toBeVisible()
    await page.goto('/products')
    await page.goto('/cart')
    await expect(page.getByText('Subtotal').locator('..').getByText('₹1,300')).toBeVisible()

    // Remove remaining cake -> empty
    await page.getByRole('button', { name: 'Remove Classic Chocolate Cake from cart' }).click()
    await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible()
    await expect(page.getByLabel('Open cart, 0 items').filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByLabel(/Open cart, [1-9]/)).toHaveCount(0)

    // Empty persistence
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible()
    await expect(page.getByLabel(/Open cart, [1-9]/)).toHaveCount(0)
  })
})
