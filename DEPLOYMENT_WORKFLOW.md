# Autonomous Development & Deployment Workflow — S.V. Sweets & Bakers

This document defines the complete autonomous development and deployment workflow
for the Bluebell Bakehouse / S.V. Sweets & Bakers bakery e-commerce project.

## Safety Constraints (Non-Negotiable)

- **No production deployment without explicit user approval.**
- **No production database modification without explicit user approval.**
- **No live payment transactions (Razorpay) without explicit user approval.**
- **No DNS, domain, or production credential changes without explicit user approval.**
- **No purchasing of subscriptions or paid API credits without explicit user approval.**
- **No `.env` files, API keys, JWT secrets, database credentials, or payment credentials committed to Git.**
- All deployment configuration files (`.github/workflows/`, `render.yaml`, `vercel.json`) contain **no secrets** — secrets are injected via platform dashboards (Vercel/Render environment variables) or local `.env` files only.

---

## Phase 1 — Requirement Analysis & Task Planning

**Trigger:** User provides a feature request, bug report, or improvement.

**Steps:**
1. **Parse the request** — identify scope (frontend, backend, database, infrastructure).
2. **Inspect existing implementation** — read relevant files under `app/`, `components/`, `backend/src/`, `backend/tests/`, `tests/e2e/`.
3. **Identify dependencies & regressions** — trace imports, shared models, middleware, routes, MCP-connected services.
4. **Assign agents** — route to the appropriate specialized agent (Project Architect, Frontend Engineer, Backend Engineer, Database Engineer, QA Engineer, Security Engineer, DevOps Engineer).
5. **Prepare implementation plan** — document files to change, tests to add/ update, security review checklist, deployment impact.
6. **Present plan to user** — wait for approval before implementation.

**Output:** `IMPLEMENTATION_PLAN.md` (per-task), agent assignments, file list, risk assessment.

---

## Phase 2 — Frontend & Backend Implementation

**Trigger:** User approves the implementation plan.

**Steps (autonomous, per agent):**

### Frontend Engineer (Next.js 16, React 19, Tailwind 4)
- Work under `app/` and `components/`.
- Follow AGENTS.md Next.js 16 breaking-changes notice.
- Responsive design (mobile/tablet/desktop).
- No hardcoded secrets in frontend files.
- Run `npx tsc --noEmit` (frontend typecheck).

### Backend Engineer (Express 5, TypeScript, Mongoose)
- Work under `backend/src/` (controllers, routes, models, middleware, services).
- Validate input with Zod schemas.
- Use database transactions for order/payment mutations.
- Never expose credentials in error responses (`redactSecrets` pattern).
- Run `npx tsc --noEmit` (backend typecheck).

### Database Engineer (MongoDB)
- Inspect existing schemas in `backend/src/models/`.
- Use read-only MongoDB MCP server for production inspection only.
- No production migrations without approval.
- Use `mongodb-memory-server` for test database.

### Security Engineer
- Review authN/authZ for all route/controller changes.
- Verify rate limiting on sensitive endpoints.
- Confirm no secrets logged or exposed.
- Verify Razorpay webhook signature validation.

---

## Phase 3 — Automated Testing

### Backend (Vitest 5 + Supertest)
- Location: `backend/tests/` (29 test files, 395 tests passing).
- Command: `cd backend && npx vitest run`
- Config: `backend/vitest.config.ts` (node env, globals, `fileParallelism: false`, `maxWorkers: 1`)
- Test database: `mongodb-memory-server` (never production Atlas)

### Frontend TypeScript
- Command: `npx tsc --noEmit` (project root)
- Config: `tsconfig.json` (strict, `@/*` paths)

### Playwright End-to-End (1.65.0)
- Location: `tests/e2e/` (`bluebell.spec.ts`, `screenshots.spec.ts`)
- Config: `playwright.config.ts` (baseURL `http://localhost:3000`, Chromium + mobile-chrome)
- WebServer: starts frontend (`pnpm run dev`:3000) + backend (`npm run dev` in `./backend`:5000)
- Command: `npx playwright test`

### CI Test Execution (GitHub Actions)
- `.github/workflows/ci.yml` runs on push/PR to `main`:
  1. Install pnpm
  2. Frontend typecheck (`tsc --noEmit`)
  3. Backend typecheck (`tsc --noEmit` in `./backend`)
  4. Backend tests (`vitest run` in `./backend`)
  5. Playwright E2E (requires dev servers — runs in CI with `webServer` or start commands)

**Fail-fast:** Any test failure blocks the PR/merge.

---

## Phase 4 — Security & Regression Review

**Checklist (Security Engineer):**
- [ ] No `.env` values, API keys, JWT secrets, DB credentials, Razorpay credentials in code or logs.
- [ ] Rate limiting applied to sensitive endpoints (auth, OTP, order tracking).
- [ ] Razorpay webhook signature verified.
- [ ] JWT token version rotation respected.
- [ ] Authorization checks on all admin routes.
- [ ] Input validation with Zod on all request bodies.
- [ ] Error messages do not leak internals.

**Regression review:**
- [ ] Existing test suite passes (395 backend tests).
- [ ] Playwright E2E passes.
- [ ] TypeScript clean on frontend and backend.
- [ ] Status transition rules unchanged (or intentionally updated with tests).

---

## Phase 5 — Git Commits & Pull Request Preparation

**Steps (autonomous):**
1. Stage only intentional changes (never `.env*`, `node_modules/`, `.next/`, `.vercel/`, `diagnostics/` artifacts).
2. Commit with conventional message format: `type(scope): description`.
   - Example: `feat(orders): add WhatsApp notification on status change`
3. Create a feature branch from `main`.
4. Prepare PR description: summary, files changed, test results, security notes, deployment notes.
5. **Do not push or merge without user approval.** Leave the branch ready for user to push.

**Never perform:**
- `git push --force`
- `git reset --hard` on shared branches
- Deleting important files or data

---

## Phase 6 — Vercel Frontend Deployment Preparation

**Existing integration:** `.vercel/repo.json` links project `bakery-ecommerce` (org `team_CWu6Av7JRWv91YfWsmAqUFbs`), directory `.`.

**Safe local configuration:**
- `vercel.json` — build settings, routes, headers, environment variable references (no values).
- Frontend build: `pnpm build` (`next build`).
- Output: `.next/` (gitignored).

**Environment variables needed in Vercel dashboard (user configures):**
- `NEXT_PUBLIC_API_URL` → Render backend URL
- `NEXT_PUBLIC_SITE_URL` → Vercel URL
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` → Google OAuth
- `BACKEND_INTERNAL_URL` → Render backend internal URL
- `JWT_SECRET` → shared secret

**Deployment trigger:** Push to `main` (Vercel auto-deploys if connected to GitHub).

**Do not:** Trigger a Vercel deployment without user approval.

---

## Phase 7 — Render Backend Deployment Preparation

**Existing integration:** Backend at `https://bakery-ecommerce-txuz.onrender.com`. No `render.yaml` exists (dashboard-configured).

**Safe local configuration:**
- `render.yaml` — Infrastructure-as-Code defining the backend service (no secrets).
- Backend start: `cd backend && npx tsx src/server.ts` (or `npm run start`).
- Health check: `GET /health` (already implemented in `server.ts`).
- Build command: `npm install` (or `pnpm install` with `--filter backend`).

**Environment variables needed in Render dashboard (user configures):**
- `MONGODB_URI` → MongoDB Atlas connection string
- `PORT` → `5000`
- `CORS_ORIGIN` → Vercel frontend URL
- `JWT_SECRET` → shared secret (32+ chars)
- `OTP_SECRET` → OTP signing secret
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `ADMIN_NOTIFICATION_EMAIL` (optional)

**Deployment trigger:** Push to `main` (Render auto-deploys if connected to GitHub).

**Do not:** Trigger a Render deployment or modify production database without user approval.

---

## Phase 8 — Post-Deployment Health Checks & Reporting

**Health check endpoints:**
- Frontend: `https://bakery-ecommerce-topaz.vercel.app` (GET `/`)
- Backend: `https://bakery-ecommerce-txuz.onrender.com/health` (returns `{status, service, database}`)

**Health check script (`scripts/health-check.mjs`):**
1. Ping frontend homepage — expect 200.
2. Ping backend `/health` — expect `status: "ok"`, `database: "connected"`.
3. Ping backend `/` — expect 200.
4. Report results (pass/fail per endpoint).

**Post-deployment report includes:**
- Deployment status (frontend/backend).
- Health check results.
- Test results (backend unit/integration, Playwright E2E).
- Files changed, PR link (if created).
- Any warnings or required follow-ups.

**Do not:** Run health checks against production without user approval (counts as production interaction).

---

## Configuration Files to Create (Safe — No Secrets)

| File | Purpose | Status |
|------|---------|--------|
| `.github/workflows/ci.yml` | GitHub Actions CI: typecheck + tests + Playwright | To create |
| `render.yaml` | Render backend infrastructure-as-code | To create |
| `vercel.json` | Vercel frontend build config | To create |
| `scripts/health-check.mjs` | Post-deployment health check script | To create |
| `scripts/prep-deploy.mjs` | Pre-deployment validation script | To create |
| `package.json` (root) | Add CI/test/deploy-prep scripts | To update |

---

## What Remains (Requires User Approval or Action)

1. **GitHub Actions secrets** — if CI needs to deploy to Vercel/Render, add `VERCEL_TOKEN`, `RENDER_API_KEY`, etc. in GitHub repository settings (not committed).
2. **Vercel environment variables** — configure in Vercel dashboard (`NEXT_PUBLIC_API_URL`, `JWT_SECRET`, etc.).
3. **Render environment variables** — configure in Render dashboard (`MONGODB_URI`, `JWT_SECRET`, Razorpay keys, Brevo keys, Cloudinary keys).
4. **Render `render.yaml` activation** — import `render.yaml` into Render dashboard or connect via Render's GitHub integration.
5. **Production deployment approval** — user must explicitly approve any push-to-main that triggers Vercel/Render auto-deploy.
6. **WhatsApp API credentials** — if WhatsApp notifications are implemented, provider credentials needed (Twilio/Msg91/Meta Cloud API).
7. **MongoDB read-only user** — for database inspection via MCP, a dedicated read-only Atlas user may be needed.

---

## Next Steps

1. Review this implementation plan.
2. Approve which safe local components to configure (CI configs, deployment configs, scripts).
3. Provide your first development task to begin the autonomous workflow.
4. When ready, approve production deployment separately.