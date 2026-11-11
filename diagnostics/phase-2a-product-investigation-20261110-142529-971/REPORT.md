# Phase 2A — Product detail and image investigation

Date: 2026-11-10. **Read-only investigation; no repair performed.**

## Summary

- **CONFIRMED — Product detail failure is not isolated to chocolate-chip-cookies.** Four real slugs (Chocolate Chip Cookies, Glazed Donut, Chocolate Donut, Chicken Roll) each return HTTP 200 from both backend and frontend slug endpoints with a valid product object, but the server-rendered detail routes all produce the generic “Something went wrong” page. Browser navigation showed the detail UI requests `/api/products` (catalogue) rather than `/api/products/slug/<slug>`; direct navigation also only showed catalogue GETs. This implicates the server-side detail fetch path, not missing product data, route matching, or the slug controller. The report does not claim the precise runtime exception: the component catches and suppresses it, and no server logs were read.
- **CONFIRMED — The first catalogue product has no image in its API data.** Product is Chocolate Chip Cookies, ID `6adee81a2d9598353eb3a568`, slug `chocolate-chip-cookies`; its `images` array is empty. The catalogue mapper substitutes `/placeholder.svg`, and the product card renders that placeholder. This is data absence (confirmed in the running API), not evidence of an invalid stored URL or unavailable asset. Local files with similar names exist, but no URL is stored in this product record and selecting one would be speculative.
- **CONFIRMED — Frontend proxy URL route is working for slug requests.** The frontend URL `/api/products/slug/<slug>` returns the same HTTP 200 payload as backend `/api/products/slug/<slug>` for all four tested products.

## Environment and preservation

- Repository: `C:\Users\Admin\Documents\bakery-ecommerce`; branch `main`; HEAD `5e6b13f762d338a4b497f64139607c58df7a25a8`.
- Initial Git status: 195 entries. Snapshot stored in `%TEMP%\bb-phase2a-status-before.txt`; original modifications/untracked files were preserved.
- Backend `/health`, backend `/api/products`, frontend `/api/products`: HTTP 200. No services restarted, stopped, or launched.
- Final status comparison is recorded separately below after audit evidence is finalized. New evidence is confined to this Phase 2A directory.
- API response artifact contains storefront product fields only; no private customer data or credentials were requested.

## A. Product detail data flow

1. Live backend GET `/api/products` returned 21 active products. The target record is present with ID, slug, name, description, price, category, stock, availability, active flag and an empty `images` array. See `target-product.json` and `backend-products-redacted.json`.
2. The detail route is `app/products/[slug]/page.tsx:36-76`. It awaits `params.slug`, calls `getProductBySlug`, displays generic error UI only if that call throws, and calls `notFound()` only when it returns null.
3. `lib/api/index.ts:115-151` trims/lowercases the slug and GETs `/api/products/slug/<encoded slug>`. It converts 400/404 to null, non-2xx or JSON/type mismatch to `ApiError`, then maps a valid payload.
4. `next.config.mjs:27-33` rewrites `/api/:path*` to the configured backend URL. In this live run, direct GETs to both `http://localhost:5000/api/products/slug/<slug>` and `http://localhost:3000/api/products/slug/<slug>` returned matching product ID/name/slug and HTTP 200. Thus endpoint wiring itself is not the cause.
5. `backend/src/server.ts:73` mounts product routes at `/api/products`. `backend/src/routes/productRoutes.ts:21-28` registers GET `/`, GET `/slug/:slug`, and GET `/:id`. `backend/src/controllers/productController.ts:171-207` normalizes and validates slug, queries active product by slug, returns 404 if absent and HTTP 200 JSON when found.
6. `lib/api/map-backend-product.ts:69-81,83-123` validates required base fields, then maps `_id` to `id`, preserves slug/name/description, builds one default variant, and supplies safe defaults for optional fields. No evidence that an absent optional field invalidates the observed endpoint payload.
7. Browser observation (`browser-detail-comparison.json`, `client-navigation-detail.json`) records the generic error for all four detail slugs. During navigation the browser captured three GETs to `/api/products` (200), and no `/api/products/slug/...` request. Detail HTML has no `<img>` because the error branch is rendered.

### Failure classification

- **CONFIRMED:** The detail-page lookup throws even though the slug endpoint independently returns a valid record. It is not a product-specific missing-slug/404 problem, and the browser proxy GET itself is valid.
- **LIKELY:** A server-side Next.js runtime restriction or URL construction issue for relative `fetch('/api/...')` in `lib/api/index.ts:125` causes the throw. `fetchBackendProducts()` at line 64 uses the same relative-URL pattern; the observed detail navigation’s three catalogue GETs and successful rendered catalogue suggest runtime differences/cache/route behavior need closer instrumentation. This is a lead, not a proven root cause.
- **UNCONFIRMED:** Exact exception, whether it is solely caused by the relative URL, and whether Next rewrites behave as expected for server component fetches. No server exception log or unmasked stack was captured. The page intentionally hides caught exception details (`app/products/[slug]/page.tsx:44-69`).

HTTP 200 on the HTML route reflects successful rendering of the error branch; it is not proof that product lookup succeeded.

## B. First catalogue image

- Exact first item: Chocolate Chip Cookies, ID `6adee81a2d9598353eb3a568`, slug `chocolate-chip-cookies`.
- Live backend record `images: []`; `target-product.json` preserves the observed safe product fields.
- `lib/api/map-backend-product.ts:20,83-86` uses `/placeholder.svg` when there is no nonempty image URL.
- `components/product/product-card.tsx:39-52` renders `product.image` (or placeholder) through `next/image`; its onError handler also switches to placeholder if loading fails.
- `next.config.mjs:16-25` permits remote images from `res.cloudinary.com`, and keeps Next image optimization enabled. This does not affect the observed item because the record has no remote URL.
- GET `http://localhost:3000/images/glazed-donut.jpg` (a known real URL from the second product record) returned HTTP 200, `image/jpeg`, 180601 bytes. No invented target image URL was probed.
- **CONFIRMED:** Missing database/API image array results in the mapped placeholder; no URL exists to classify as inaccessible. **UNCONFIRMED:** Whether an intended local image should be associated with this product—the repository contains similarly named files but no authoritative mapping in the record.

## C. Regression comparison

- Slug API results: Chocolate Chip Cookies, Glazed Donut, Chocolate Donut, Chicken Roll all HTTP 200 via backend and frontend proxy and return matching IDs/names/slugs.
- Browser detail routes for all four returned HTTP 200 but the same error UI. This is a systemic frontend detail lookup failure, not limited to cookies, image-empty products, or one category.
- Catalogue data includes products with and without image URLs; endpoint comparison confirms valid URLs on other products. A broad category-by-category detail sweep was not performed; four samples span cookies, donuts and rolls.

## Network / console evidence

- Safe GET checks only; no POST/PUT/PATCH/DELETE.
- `slug-endpoint-comparison.json`: backend and frontend proxy slug GET status/payload summary for four products.
- `browser-detail-comparison.json`: browser detail response, rendered heading/body, images, request failures and console errors for four routes. No browser page exceptions or failed network requests were observed there.
- `next-server-detail-observation.json`: direct navigation shows catalogue GET requests 200; no detail slug request observed in browser Network (detail fetch is server-side).
- `image-get.json`: actual returned image URL status/content type/size.
- No credentials, cookies, or customer records requested or included.

## Minimal repair proposals (not implemented)

1. **Product detail:** Adjust the server-side API access so the detail lookup uses a server-valid absolute backend URL or a shared server fetch helper consistent with the existing Next rewrite semantics. Preserve slug-based lookup, 404/not-found semantics and error handling. First capture the exact server exception in a safe development diagnostic to verify which variant is appropriate.
2. **Missing image:** Confirm the intended image mapping with the owner/catalogue source, then populate the product’s image field through an explicitly authorized data operation or the project’s approved asset pipeline. Do not infer from filenames and do not hard-code an arbitrary file.

## Regression tests after separately authorized repair

- Unit test mapper handling for nonempty image URL, empty array, and omitted images.
- API integration tests: slug GET returns the matching active product; unknown slug returns 404; API and proxy responses match.
- Browser/e2e detail tests for at least cookies, donut, roll and cake products, asserting product name, price, availability, image/fallback, and no generic error.
- Verify catalogue first card image loads (or intentional placeholder behavior) with no broken-image network request.
- Re-run frontend catalogue/detail and safe backend GET smoke checks; ensure no write endpoints invoked.

## Unresolved questions

- What exact exception is thrown by server-side detail data access? It is caught without logging in the page, and was not extracted from the Next process logs.
- Which approved asset, if any, should be associated with Chocolate Chip Cookies? Current Mongo-backed record has no image value.
- Should the product record itself be corrected, or is there a canonical static asset mapping expected in code/data? Owner confirmation is needed.

## Evidence files created

- `REPORT.md` — this analysis.
- `backend-products-redacted.json`, `target-product.json`, `first-products.json` — read-only API product records/selected first items.
- `slug-get-results.json`, `slug-endpoint-comparison.json` — safe GET status and field summary.
- `image-get.json` — safe GET response metadata for an actual catalog image URL.
- `browser-detail-comparison.json`, `client-navigation-detail.json`, `next-server-detail-observation.json` — browser/network observations.
- `detail-<slug>.png` — error UI screenshots for the four actual product slugs.

No application, configuration, database, or image files were modified. Stop here pending explicit repair authorization.