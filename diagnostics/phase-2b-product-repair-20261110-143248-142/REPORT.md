# Phase 2B — Targeted product repair report

Date: 2026-11-10. Repository `C:\Users\Admin\Documents\bakery-ecommerce`, branch `main`, HEAD `5e6b13f762d338a4b497f64139607c58df7a25a8`.

## Root cause and repair

**CONFIRMED root cause:** Server-side Node `fetch` does not resolve a relative path such as `/api/products/slug/chocolate-chip-cookies`. The isolated diagnostic calling the actual `getProductBySlug` function intercepted native fetch and recorded `Failed to parse URL from /api/products/slug/chocolate-chip-cookies`. The helper caught the native exception and threw `ApiError('Unable to reach the product API.')`; the product route caught that and rendered its generic error UI. API parsing/mapping were not reached. The backend and frontend proxy slug endpoints independently returned matching HTTP 200 records.

**Fix:** In `lib/api/index.ts`, add a small API URL resolver: browser execution keeps the same relative `/api/...` path, while server execution resolves it against `BACKEND_INTERNAL_URL`, `NEXT_PUBLIC_API_URL`, or the existing development fallback `http://localhost:5000`. Apply it to both shared GET functions (catalogue and slug detail), since both were relying on a relative URL in server execution. The existing server rewrite/config remains untouched. Existing API validation, mapping, not-found behavior, cache setting, and route error UI remain unchanged.

**Image handling:** No image/data change was made. The API record still has `images: []`, and the mapper/card/detail already fall back to `/placeholder.svg`. Similar-name files in `public/images` are not explicitly associated by product data or an authoritative mapping; no replacement was assigned. The current real product image remains an owner-confirmation requirement. Existing product name alt text is retained in card and detail markup.

## Files changed

- `lib/api/index.ts` — only authorized application source edit; makes server-side API request URLs absolute while preserving browser-relative proxy calls.
- No backend, product, image, environment, configuration, cart, or account files changed.

Initial candidate file inspection found pre-existing modifications in `lib/api/map-backend-product.ts`; its existing changes were preserved and it was not edited. Other unrelated modifications and untracked artifacts were preserved.

## Verification

- `pnpm exec tsc --noEmit`: PASS (exit 0; no diagnostics).
- `pnpm build`: PASS. Next 16.3.3 compiled, TypeScript passed, and all 36 static pages generated. Existing warnings remain for unsupported `sitemap`/`robots` keys in `next.config.mjs` and deprecated `middleware` convention; not changed in this scope.
- Existing Playwright `tests/e2e/bluebell.spec.ts`: BLOCKED/TIMED OUT. Two invocations exceeded the execution command window before test output; no pass is claimed. Existing Playwright config also defines POST authentication endpoint tests, so it was not appropriate to run the full suite without narrowing to safe read-only tests.
- Browser verification after fix: PASS for all four real detail paths, all HTTP 200 with the expected product heading and live product description/price/status. Screenshots: `detail-chocolate-chip-cookies-desktop.png`, `detail-glazed-donut-desktop.png`, `detail-chocolate-donut-desktop.png`, `detail-chicken-roll-desktop.png`.
- First catalogue product renders `http://localhost:3000/placeholder.svg`, image has `alt="Chocolate Chip Cookies"`, loaded (`naturalWidth=1200`). Catalogue returned HTTP 200 and rendered the product cards. A compact visible count was not captured in this Phase 2B browser JSON; separate API verification is recorded below.
- Backend GET `/api/products`: 21 products; all four backend slug GETs returned HTTP 200 before browser regression checks. No backend process was restarted. Service listener rechecks did not identify port 5000 PID, although GET checks succeeded.
- Two additional usable products (Chocolate Donut and Chicken Roll) were added in isolated browser localStorage only; no order/payment/network write occurred. Browser context was discarded. Product identity in cart write was Chocolate Donut ID `6adee81a2d9598353eb3a566`, variant `<ID>-default`; state evidence `cart-local-state.json`.
- Desktop screenshots were captured at 1440x900. Cookie detail mobile screenshot at 390x844; document/body widths both 390 (no horizontal overflow). Catalogue mobile screenshot at 390x844.
- Detail browser contexts: no console errors, failed requests, or HTTP errors. Catalogue browser navigation generated two `net::ERR_ABORTED` optimized-image requests for other cards as navigation/loading ended; these were not broken image responses for the cookie placeholder. Details in `browser-verification.json`.

## Remaining image need and unresolved points

- Chocolate Chip Cookies still needs an approved, correct product image supplied/mapped by the owner. No database change or image assignment was authorized.
- Existing Node process behavior observed by browser is now correct for detail data; build passes. Playwright suite did not complete within tool execution window. Browser-rendered stock values for some products differed from direct API state in the earlier observation; this report does not claim those inventory displays were repaired or audited.

## Evidence files

- `runtime-lookup-diagnostic.ts`, `runtime-lookup-diagnostic.log` — isolated reproduction of actual native fetch exception; no app code alteration.
- `browser-verification.json` — route, product image, console/network, and responsive observations.
- `chocolate-cookie-api-image-state.json` — safe GET evidence of the target empty image array.
- `cart-local-state.json` — isolated cart identity evidence.
- `detail-*-desktop.png`, `detail-cookie-mobile.png`, `catalogue-mobile.png`, `cart-local-test.png` — screenshots.
- `typecheck.log`, `playwright-tests.log`, `tsx-attempt-errors.log`, `playwright-report-index.html` — validation/test-run evidence. Playwright report reflects an incomplete/timed-out run and is not a pass.

## Git preservation

Fresh baseline immediately before edits contained **210 entries** (rather than the previously cited 209); one new item was `?? playwright-report/index.html`, created by the first timed-out Playwright attempt after the snapshot. It was moved intact into this new evidence directory as `playwright-report-index.html` (not deleted), preserving its contents. Thus a raw line comparison shows one removal at the original path and 18 additions, but the file itself is preserved in the audit folder. The saved baseline is `%TEMP%\bb-phase2b-status-before.txt`; comparison is `git-status-delta.txt`. The authorized source delta is limited to `lib/api/index.ts`; other added files are Phase 2B evidence. Nothing was staged or committed.

No further work performed. Stop pending additional authorization.