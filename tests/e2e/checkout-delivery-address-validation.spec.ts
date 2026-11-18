import { expect, test, type Page } from '@playwright/test'

const CART_KEY = 'sv-sweets-cart-v1'
const PRODUCT_ID = '6afccbda175fa4fb28f69450'
const VARIANT_ID = `${PRODUCT_ID}-default`

const MOCK_PRODUCTS = [
  {
    _id: PRODUCT_ID,
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
]

const MOCK_SETTINGS = {
  settings: {
    onlineOrdersEnabled: true,
    deliveryEnabled: true,
    pickupEnabled: true,
    closedMessage: '',
    reopenAt: null,
    codMaxAmount: null,
  },
}

async function seedCart(page: Page) {
  await page.addInitScript(
    ({ key, item }) => {
      window.localStorage.setItem(key, JSON.stringify([item]))
    },
    { key: CART_KEY, item: { productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 1 } },
  )
}

async function mockApis(page: Page) {
  await page.route('**/api/products**', async (route) => {
    await route.fulfill({ json: MOCK_PRODUCTS })
  })
  await page.route('**/api/settings**', async (route) => {
    await route.fulfill({ json: MOCK_SETTINGS })
  })
  await page.route('**/api/auth/me**', async (route) => {
    await route.fulfill({ status: 401, json: { message: 'Unauthorized' } })
  })
}

async function goToFulfilment(page: Page) {
  await mockApis(page)
  await seedCart(page)
  await page.goto('/checkout')

  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Customer details' })).toBeVisible()

  await page.getByPlaceholder('Enter your name').fill('Test Customer')
  await page.getByPlaceholder('Enter your email address').fill('test@example.com')
  await page.getByPlaceholder('Enter your phone number').fill('9876543210')

  await page.getByRole('button', { name: /Continue/ }).click()
  await expect(page.getByRole('heading', { name: 'Delivery or pickup' })).toBeVisible()
}

function fulfilmentCard(page: Page) {
  return page.locator('div').filter({ has: page.getByRole('heading', { name: 'Delivery or pickup' }) }).first()
}

async function clickFulfilmentContinue(page: Page) {
  const card = fulfilmentCard(page)
  await card.getByRole('button', { name: /Continue/ }).click()
}

async function selectPickup(page: Page) {
  await page.getByRole('button', { name: /Pickup/i }).first().click()
}

async function selectDelivery(page: Page) {
  await page.getByRole('button', { name: /Delivery/i }).first().click()
}

test.describe('Checkout fulfilment delivery address validation (4B+9)', () => {
  test('Scenario 1: Delivery with all address fields empty is blocked with field errors', async ({ page }) => {
    await goToFulfilment(page)
    await selectDelivery(page)

    await clickFulfilmentContinue(page)

    await expect(page.getByRole('heading', { name: 'Delivery or pickup' })).toBeVisible()
    await expect(page.getByText('Schedule your order')).toHaveCount(0)
    await expect(page.getByText('Please enter your delivery address.')).toBeVisible()
    await expect(page.getByText('Please enter your city.')).toBeVisible()
    await expect(page.getByText('Please enter your pincode.')).toBeVisible()
  })

  test('Scenario 2: Delivery with partial address is blocked with errors for missing fields', async ({ page }) => {
    await goToFulfilment(page)
    await selectDelivery(page)

    await page.getByPlaceholder('Enter your complete delivery address').fill('123 Partial Street')
    await clickFulfilmentContinue(page)

    await expect(page.getByRole('heading', { name: 'Delivery or pickup' })).toBeVisible()
    await expect(page.getByText('Schedule your order')).toHaveCount(0)
    await expect(page.getByText('Please enter your delivery address.')).toHaveCount(0)
    await expect(page.getByText('Please enter your city.')).toBeVisible()
    await expect(page.getByText('Please enter your pincode.')).toBeVisible()
  })

  test('Scenario 3: Delivery with valid address allows progression to schedule', async ({ page }) => {
    await goToFulfilment(page)
    await selectDelivery(page)

    await page.getByPlaceholder('Enter your complete delivery address').fill('123 Test Street')
    await page.getByPlaceholder('City').fill('Chennai')
    await page.getByPlaceholder('Pincode').fill('600001')
    await clickFulfilmentContinue(page)

    await expect(page.getByRole('heading', { name: 'Schedule your order' })).toBeVisible()
  })

  test('Scenario 4: Pickup with empty delivery fields allows progression', async ({ page }) => {
    await goToFulfilment(page)
    await selectPickup(page)

    await expect(page.getByPlaceholder('Enter your complete delivery address')).toHaveCount(0)
    await clickFulfilmentContinue(page)

    await expect(page.getByRole('heading', { name: 'Schedule your order' })).toBeVisible()
  })

  test('Scenario 5: Pickup to Delivery with empty address is blocked', async ({ page }) => {
    await goToFulfilment(page)
    await selectPickup(page)
    await selectDelivery(page)

    await clickFulfilmentContinue(page)

    await expect(page.getByRole('heading', { name: 'Delivery or pickup' })).toBeVisible()
    await expect(page.getByText('Schedule your order')).toHaveCount(0)
    await expect(page.getByText('Please enter your delivery address.')).toBeVisible()
    await expect(page.getByText('Please enter your city.')).toBeVisible()
    await expect(page.getByText('Please enter your pincode.')).toBeVisible()
  })

  test('Scenario 6: Delivery to Pickup allows progression without delivery-address requirements', async ({ page }) => {
    await goToFulfilment(page)
    await selectDelivery(page)

    await page.getByPlaceholder('Enter your complete delivery address').fill('123 Test Street')
    await page.getByPlaceholder('City').fill('Chennai')
    await page.getByPlaceholder('Pincode').fill('600001')

    await selectPickup(page)
    await expect(page.getByPlaceholder('Enter your complete delivery address')).toHaveCount(0)
    await clickFulfilmentContinue(page)

    await expect(page.getByRole('heading', { name: 'Schedule your order' })).toBeVisible()
  })

  test('Correcting fields clears relevant errors and switching to pickup clears delivery errors', async ({ page }) => {
    await goToFulfilment(page)
    await selectDelivery(page)

    await clickFulfilmentContinue(page)
    await expect(page.getByText('Please enter your delivery address.')).toBeVisible()
    await expect(page.getByText('Please enter your city.')).toBeVisible()
    await expect(page.getByText('Please enter your pincode.')).toBeVisible()

    await page.getByPlaceholder('Enter your complete delivery address').fill('123 Corrected Street')
    await expect(page.getByText('Please enter your delivery address.')).toHaveCount(0)
    await expect(page.getByText('Please enter your city.')).toBeVisible()
    await expect(page.getByText('Please enter your pincode.')).toBeVisible()

    await selectPickup(page)
    await selectDelivery(page)
    await expect(page.getByText('Please enter your delivery address.')).toHaveCount(0)
    await expect(page.getByText('Please enter your city.')).toHaveCount(0)
    await expect(page.getByText('Please enter your pincode.')).toHaveCount(0)

    await clickFulfilmentContinue(page)
    await expect(page.getByRole('heading', { name: 'Schedule your order' })).toHaveCount(0)
  })

  test('Existing step navigation remains intact (back to details, schedule back to fulfilment)', async ({ page }) => {
    await goToFulfilment(page)

    await fulfilmentCard(page).getByRole('button', { name: /← Back/ }).click()
    await expect(page.getByRole('heading', { name: 'Customer details' })).toBeVisible()

    await page.getByRole('button', { name: /Continue/ }).click()
    await expect(page.getByRole('heading', { name: 'Delivery or pickup' })).toBeVisible()

    await selectDelivery(page)
    await page.getByPlaceholder('Enter your complete delivery address').fill('123 Test Street')
    await page.getByPlaceholder('City').fill('Chennai')
    await page.getByPlaceholder('Pincode').fill('600001')
    await clickFulfilmentContinue(page)
    await expect(page.getByRole('heading', { name: 'Schedule your order' })).toBeVisible()

    await page.getByRole('button', { name: /← Back/ }).click()
    await expect(page.getByRole('heading', { name: 'Delivery or pickup' })).toBeVisible()
  })
})
