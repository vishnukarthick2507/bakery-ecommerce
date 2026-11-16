
import { test, expect, type Page } from '@playwright/test';

const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME || '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || '';
const CUSTOMER_EMAIL = process.env.E2E_CUSTOMER_EMAIL || '';
const CUSTOMER_PASSWORD = process.env.E2E_CUSTOMER_PASSWORD || '';
const CUSTOMER_NAME = process.env.E2E_CUSTOMER_NAME || '';
const CUSTOMER_PHONE = process.env.E2E_CUSTOMER_PHONE || '';
const RUN_ID = process.env.E2E_RUN_ID || '';

function tomorrow(offset = 2) {
  const d = new Date();
  d.setDate(d.getDate() + offset);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

async function adminLogin(page: Page) {
  await page.goto('/admin/login', { waitUntil: 'load' });

  await page.getByPlaceholder(/username/i).fill(ADMIN_USERNAME);
  await page.getByPlaceholder(/password/i).fill(ADMIN_PASSWORD);

  await page.getByRole('button', { name: /^Login$/i }).click();

  await expect(page).toHaveURL(/\/admin(\/)?$/, {
    timeout: 20000,
  });
}

async function customerLogin(page: Page) {
  await page.goto('/account/login', { waitUntil: 'load' });

  // Confirm the correct Password login view is rendered.
  await expect(
    page.getByRole('heading', { name: /Welcome back/i })
  ).toBeVisible({ timeout: 20000 });

  // The email input uses a placeholder, not an associated HTML label.
  const email = page.getByPlaceholder('priya@example.com');

  await expect(email).toBeVisible({ timeout: 20000 });
  await email.fill(CUSTOMER_EMAIL);

  const password = page.locator('input[type="password"]').first();

  await expect(password).toBeVisible({ timeout: 20000 });
  await password.fill(CUSTOMER_PASSWORD);

  const submit = page.getByRole('button', {
    name: /^Sign in$/i,
  });

  await expect(submit).toBeEnabled();
  await submit.click();

  // Confirm successful authentication.
  await expect(
    page.getByRole('heading', { name: /^My account$/i })
  ).toBeVisible({ timeout: 20000 });
}

test.describe.serial('Stage 4 custom cake workflow (isolated E2E)', () => {
  test.setTimeout(180_000);

  test('complete customer-to-admin custom cake workflow', async ({ page }, testInfo) => {
    test.skip(!RUN_ID || !CUSTOMER_PHONE, 'E2E env not configured');

    // 1) Customer submits custom cake request (public UI).
    await page.goto('/custom-cake', { waitUntil: 'load' });

    await expect(page).toHaveURL(/\/custom-cake\/?$/);

    const yourDetailsHeading = page.getByRole('heading', {
      name: /Your details/i,
    });

    const continueBtn = page.getByRole('button', {
      name: /^Continue$/i,
    }).first();

    await expect(yourDetailsHeading).toBeVisible({ timeout: 30000 });
    await expect(continueBtn).toBeVisible();
    await expect(continueBtn).toBeEnabled();

    // Readiness/interactivity diagnostic.
    const readiness = {
      url: page.url(),
      readyState: await page.evaluate(() => document.readyState),
      preClickStepHeading: ((await yourDetailsHeading.textContent()) || '').trim(),
      continueEnabled: await continueBtn.isEnabled(),
    };

    await testInfo.attach('custom-cake-readiness', {
      body: JSON.stringify(readiness, null, 2),
      contentType: 'application/json',
    });

    console.log(`E2E_DIAG custom-cake-readiness ${JSON.stringify(readiness)}`);

    await page.getByLabel(/your name|full name/i).fill(CUSTOMER_NAME);
    await page.getByLabel(/phone number|phone|mobile/i).fill(CUSTOMER_PHONE);

    // Step navigation and interactivity check.
    await continueBtn.click();

    const cakeDetailsHeading = page.getByRole('heading', {
      name: /Cake details/i,
    });

    try {
      await expect(cakeDetailsHeading).toBeVisible({ timeout: 20000 });

      await testInfo.attach('custom-cake-interactivity', {
        body: JSON.stringify({
          ok: true,
          step: 'cake-details',
        }),
        contentType: 'application/json',
      });

      console.log('E2E_DIAG custom-cake-interactivity ok=true step=cake-details');
    } catch (e) {
      const postClick = await page.evaluate(() => {
        const headings = Array.from(
          document.querySelectorAll('main h1, main h2, main h3')
        )
          .map((el) => (el.textContent || '').trim())
          .filter(Boolean);

        const progress = Array.from(
          document.querySelectorAll('[aria-label="Request progress"] li')
        )
          .map((el) => (el.textContent || '').trim())
          .filter(Boolean);

        return {
          headings,
          progress: progress.slice(0, 8),
          url: location.href,
          readyState: document.readyState,
        };
      });

      await testInfo.attach('custom-cake-post-click-diagnostics', {
        body: JSON.stringify({ readiness, postClick }, null, 2),
        contentType: 'application/json',
      });

      console.log(
        `E2E_DIAG custom-cake-interactivity ok=false postClick=${JSON.stringify(postClick)}`
      );

      throw new Error(
        `Custom cake step did not advance after Continue (readiness: load/${readiness.readyState}, preClick="${readiness.preClickStepHeading}", continueEnabled=${readiness.continueEnabled}). Post-click headings=${JSON.stringify(postClick.headings)} progress=${JSON.stringify(postClick.progress)}. Original: ${(e as Error).message}`
      );
    }

    await page.getByLabel(/cake flavour|flavour|flavor/i).fill(
      `Choco-${RUN_ID.slice(-6)}`
    );

    await page.getByLabel(/weight/i).fill('1');

    await page.getByRole('button', { name: /^Continue$/i }).click();

    await expect(
      page.getByRole('heading', { name: /Design & message/i })
    ).toBeVisible({ timeout: 20000 });

    await page.getByLabel(/theme|occasion/i).fill('Birthday');

    await page.getByRole('button', { name: /^Continue$/i }).click();

    // Reference image is optional.
    await expect(
      page.getByRole('heading', { name: /Reference image/i })
    ).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: /^Continue$/i }).click();

    await expect(
      page.getByRole('heading', { name: /Review your request/i })
    ).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: /Submit Request/i }).click();

    await expect(
      page.getByRole('heading', { name: /Request Received/i })
    ).toBeVisible({ timeout: 30000 });

    const bodyText = await page.locator('body').innerText();
    const refMatch = bodyText.match(/CC-\d+-\d+/);

    expect(
      refMatch,
      'Reference number should be shown after submission'
    ).toBeTruthy();

    const referenceNumber = refMatch![0];

    // 2) Admin proposes price and collection date/time.
    await adminLogin(page);

    await page.goto('/admin/custom-cakes', { waitUntil: 'load' });

    await page
      .getByPlaceholder(/name, phone, reference number/i)
      .fill(referenceNumber);

    await page.getByRole('button', { name: /^Refresh$/i }).click();

    const reqCard = page.locator('section', {
      hasText: referenceNumber,
    }).first();

    await expect(reqCard).toBeVisible({ timeout: 20000 });

    await reqCard
      .getByRole('button', { name: /Propose Price & Delivery/i })
      .click();

    const deliveryDate = tomorrow(2);

    await reqCard.locator('input[id^="proposed-price-"]').fill('1250');
    await reqCard.locator('input[id^="proposed-date-"]').fill(deliveryDate);
    await reqCard.locator('input[id^="proposed-time-"]').fill('2:00 PM');

    await reqCard
      .locator('textarea[id^="admin-notes-"]')
      .fill('E2E proposal');

    await reqCard.getByRole('button', { name: /Submit Proposal/i }).click();

    await expect(reqCard.getByText(/Proposed Details/i)).toBeVisible({
      timeout: 20000,
    });

    await expect(
      reqCard.locator('span.text-amber', { hasText: /^Pending$/ })
    ).toBeVisible({ timeout: 20000 });

    // 3) Customer logs in and accepts the proposal.
    await page.context().clearCookies();

    await customerLogin(page);

    await page.goto('/account/custom-cake-requests', {
      waitUntil: 'load',
    });

    await expect(page.getByText(referenceNumber)).toBeVisible({
      timeout: 20000,
    });

    await page.getByText(referenceNumber).first().click();

    await expect(page).toHaveURL(
      /\/account\/custom-cake-requests\//,
      { timeout: 20000 }
    );

    await expect(page.getByText(referenceNumber)).toBeVisible();

    await expect(
      page.getByRole('button', { name: /Accept Proposal/i })
    ).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: /Accept Proposal/i }).click();

    await expect(
      page.getByRole('heading', { name: 'Proposal Accepted' })
    ).toBeVisible({ timeout: 20000 });

    // 4) Admin converts request into an order.
    await page.context().clearCookies();

    await adminLogin(page);

    await page.goto('/admin/custom-cakes', { waitUntil: 'load' });

    await page
      .getByPlaceholder(/name, phone, reference number/i)
      .fill(referenceNumber);

    await page.getByRole('button', { name: /^Refresh$/i }).click();

    const card2 = page.locator('section', {
      hasText: referenceNumber,
    }).first();

    await expect(card2).toBeVisible({ timeout: 20000 });

    await expect(
      card2.getByRole('button', { name: /^Convert to Order$/i })
    ).toBeVisible({ timeout: 20000 });

    await card2
      .getByRole('button', { name: /^Convert to Order$/i })
      .click();

    await expect(
      card2.getByText(/Confirm conversion to order/i)
    ).toBeVisible();

    await expect(
      card2.getByText('PAY_AT_STORE (Pending)', { exact: true })
    ).toBeVisible();

    await card2
      .getByRole('button', { name: /Confirm & Convert/i })
      .click();

    // 5) Verify generated SV order number.
    await expect(card2.getByText(/Order SV-/)).toBeVisible({
      timeout: 30000,
    });

    const card2Text = await card2.innerText();
    const svMatch = card2Text.match(/SV-\d{8}-\d{4}/);

    expect(
      svMatch,
      'Generated SV order number should be displayed'
    ).toBeTruthy();

    const orderNumber = svMatch![0];

    await expect(
      card2.getByRole('link', { name: /View in Admin Orders/i })
    ).toBeVisible();

    process.env.E2E_ORDER_NUMBER = orderNumber;

    console.log(
      `E2E_RESULT orderNumber=${orderNumber} referenceNumber=${referenceNumber}`
    );

    // 5b) Verify order appears in admin orders page.
    await page.goto('/admin/orders', { waitUntil: 'load' });

    const ordersSearch = page
      .getByLabel(/Search orders/i)
      .or(page.getByPlaceholder(/search/i))
      .first();

    await ordersSearch.fill(orderNumber);

    await expect(page.getByText(orderNumber)).toBeVisible({
      timeout: 20000,
    });

    // 6) Verify converted order through the admin API.
    const orderResp = await page.evaluate(async (on) => {
      const r = await fetch(
        `/api/orders?search=${encodeURIComponent(on)}&limit=20`,
        {
          credentials: 'include',
          cache: 'no-store',
        }
      );

      const data = await r.json().catch(() => ({}));

      return {
        ok: r.ok,
        status: r.status,
        data,
      };
    }, orderNumber);

    expect(
      orderResp.ok,
      `Admin order fetch failed: ${JSON.stringify(orderResp)}`
    ).toBeTruthy();

    const orders = Array.isArray((orderResp.data as any).orders)
      ? (orderResp.data as any).orders
      : [];

    const order = orders.find(
      (o: any) => o?.orderNumber === orderNumber
    ) || null;

    expect(
      order,
      `Converted order ${orderNumber} not found in admin orders API response`
    ).toBeTruthy();

    expect(order.paymentMethod).toBe('PAY_AT_STORE');
    expect(order.paymentStatus).toBe('PENDING');
    expect(order.orderStatus).toBe('PLACED');
    expect(order.fulfillmentType).toBe('PICKUP');
    expect(order.userId == null).toBeTruthy();
    expect(order.orderNumber).toBe(orderNumber);

    // 7) Duplicate conversion must not create another order.
    await page.goto('/admin/custom-cakes', { waitUntil: 'load' });

    await page
      .getByPlaceholder(/name, phone, reference number/i)
      .fill(referenceNumber);

    await page.getByRole('button', { name: /^Refresh$/i }).click();

    const card3 = page.locator('section', {
      hasText: referenceNumber,
    }).first();

    await expect(card3).toBeVisible({ timeout: 20000 });

    await expect(
      card3.getByRole('button', { name: /^Convert to Order$/i })
    ).toHaveCount(0);

    // Request must remain converted and reference its existing order.
    await expect(
      card3.getByText(/This custom cake request has already been converted to an order/i)
    ).toBeVisible({ timeout: 20000 });
    await expect(
      card3.getByText(/Converted order exists for this request/i)
    ).toBeVisible({ timeout: 20000 });
    await expect(
      card3.getByRole('link', { name: /View in Admin Orders/i })
    ).toBeVisible({ timeout: 20000 });

    // 8) Guest order tracking using order number and phone.
    await page.context().clearCookies();

    await page.goto('/track', { waitUntil: 'load' });

    await page.getByPlaceholder(/SV-/i).fill(orderNumber);

    await page
      .getByPlaceholder(/Checkout phone number|Guest order phone|phone number used/i)
      .fill(CUSTOMER_PHONE);

    await page.getByRole('button', { name: /Track Order/i }).click();

    await expect(page.getByText(orderNumber)).toBeVisible({
      timeout: 20000,
    });

    await expect(page.getByText('Payment: Pay at Store', { exact: true })).toBeVisible({
      timeout: 20000,
    });

    await expect(page.getByText('Payment Status: Pending', { exact: true })).toBeVisible({
      timeout: 20000,
    });
  });
});

test.describe('Stage 4 custom cake proposal decline (isolated E2E)', () => {
  test.setTimeout(180_000);

  test('customer declines a proposal and persisted status is updated', async ({ page }, testInfo) => {
    test.skip(!RUN_ID || !CUSTOMER_PHONE, 'E2E env not configured');

    // 1) Customer submits custom cake request.
    await page.goto('/custom-cake', { waitUntil: 'load' });

    await expect(page).toHaveURL(/\/custom-cake\/?$/);

    const yourDetailsHeading = page.getByRole('heading', {
      name: /Your details/i,
    });

    const continueBtn = page.getByRole('button', {
      name: /^Continue$/i,
    }).first();

    await expect(yourDetailsHeading).toBeVisible({ timeout: 30000 });
    await expect(continueBtn).toBeVisible();
    await expect(continueBtn).toBeEnabled();

    const readiness = {
      url: page.url(),
      readyState: await page.evaluate(() => document.readyState),
      preClickStepHeading: ((await yourDetailsHeading.textContent()) || '').trim(),
      continueEnabled: await continueBtn.isEnabled(),
    };

    await testInfo.attach('custom-cake-readiness-decline', {
      body: JSON.stringify(readiness, null, 2),
      contentType: 'application/json',
    });

    await page.getByLabel(/your name|full name/i).fill(CUSTOMER_NAME);

    await page
      .getByLabel(/phone number|phone|mobile/i)
      .fill(CUSTOMER_PHONE);

    await continueBtn.click();

    const cakeDetailsHeading = page.getByRole('heading', {
      name: /Cake details/i,
    });

    await expect(cakeDetailsHeading).toBeVisible({ timeout: 20000 });

    await page.getByLabel(/cake flavour|flavour|flavor/i).fill(
      `Decline-${RUN_ID.slice(-6)}`
    );

    await page.getByLabel(/weight/i).fill('1');

    await page.getByRole('button', { name: /^Continue$/i }).click();

    await expect(
      page.getByRole('heading', { name: /Design & message/i })
    ).toBeVisible({ timeout: 20000 });

    await page.getByLabel(/theme|occasion/i).fill('Birthday');

    await page.getByRole('button', { name: /^Continue$/i }).click();

    await expect(
      page.getByRole('heading', { name: /Reference image/i })
    ).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: /^Continue$/i }).click();

    await expect(
      page.getByRole('heading', { name: /Review your request/i })
    ).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: /Submit Request/i }).click();

    await expect(
      page.getByRole('heading', { name: /Request Received/i })
    ).toBeVisible({ timeout: 30000 });

    const bodyText = await page.locator('body').innerText();
    const refMatch = bodyText.match(/CC-\d+-\d+/);

    expect(
      refMatch,
      'Reference number should be shown after submission'
    ).toBeTruthy();

    const referenceNumber = refMatch![0];

    // 2) Admin proposes price and delivery date/time.
    await adminLogin(page);

    await page.goto('/admin/custom-cakes', { waitUntil: 'load' });

    await page
      .getByPlaceholder(/name, phone, reference number/i)
      .fill(referenceNumber);

    await page.getByRole('button', { name: /^Refresh$/i }).click();

    const reqCard = page.locator('section', {
      hasText: referenceNumber,
    }).first();

    await expect(reqCard).toBeVisible({ timeout: 20000 });

    await reqCard
      .getByRole('button', { name: /Propose Price & Delivery/i })
      .click();

    const deliveryDate = tomorrow(3);

    await reqCard.locator('input[id^="proposed-price-"]').fill('900');
    await reqCard.locator('input[id^="proposed-date-"]').fill(deliveryDate);
    await reqCard.locator('input[id^="proposed-time-"]').fill('3:00 PM');

    await reqCard
      .locator('textarea[id^="admin-notes-"]')
      .fill('E2E decline proposal');

    await reqCard.getByRole('button', { name: /Submit Proposal/i }).click();

    await expect(reqCard.getByText(/Proposed Details/i)).toBeVisible({
      timeout: 20000,
    });

    // 3) Customer logs in and declines the proposal.
    await page.context().clearCookies();

    await customerLogin(page);

    await page.goto('/account/custom-cake-requests', {
      waitUntil: 'load',
    });

    await expect(page.getByText(referenceNumber)).toBeVisible({
      timeout: 20000,
    });

    await page.getByText(referenceNumber).first().click();

    await expect(page).toHaveURL(
      /\/account\/custom-cake-requests\//,
      { timeout: 20000 }
    );

    await expect(page.getByText(referenceNumber)).toBeVisible();

    await expect(
      page.getByRole('button', { name: /^Decline$/i })
    ).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: /^Decline$/i }).click();

    await expect(
      page.getByRole('heading', { name: /Proposal Declined/i })
    ).toBeVisible({ timeout: 20000 });

    // 4) Verify persisted status through the real backend.
    const requestId = new URL(page.url()).pathname
      .split('/')
      .filter(Boolean)
      .pop();

    expect(
      requestId,
      'Request id should be present in detail URL'
    ).toBeTruthy();

    const reqResp = await page.evaluate(async (id) => {
      const r = await fetch(
        `/api/custom-cake-requests/${encodeURIComponent(id)}`,
        {
          credentials: 'include',
          cache: 'no-store',
        }
      );

      const data = await r.json().catch(() => ({}));

      return {
        ok: r.ok,
        status: r.status,
        data,
      };
    }, requestId as string);

    expect(
      reqResp.ok,
      `Customer request fetch failed: ${JSON.stringify(reqResp)}`
    ).toBeTruthy();

    const persisted = (reqResp.data as any).request;

    expect(
      persisted,
      'Persisted request should be returned by backend'
    ).toBeTruthy();

    expect(persisted.referenceNumber).toBe(referenceNumber);
    expect(persisted.customerConfirmed).toBe('DECLINED');
    expect(persisted.status).toBe('CONTACTED');
  });
});
