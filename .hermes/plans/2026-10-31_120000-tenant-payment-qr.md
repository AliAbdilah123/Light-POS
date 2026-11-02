# Tenant Payment QR Implementation Plan

> **For Hermes:** Implement only after explicit approval, task-by-task with tests first.

**Goal:** Let a tenant Admin configure that tenant’s payment QR, while allowing a global Superadmin to configure any selected tenant; all other roles are denied.

**Architecture:** Store one optional QR image per tenant in SQLite, upload it through a dedicated tenant-scoped API, and serve it from an authenticated endpoint. Authorization is enforced on the server from the authenticated session and selected tenant—not from frontend visibility. Reuse the existing Admin shell, tenant selector, CSRF protection, and `canAccess` scope checks.

**Tech Stack:** React 18, TypeScript, Node HTTP server, SQLite, Vitest/Testing Library, Node test runner.

---

## Confirmed requirements

- Tenant Admin can add, replace, view, and remove only their own tenant’s payment QR.
- Global Superadmin can do the same for any explicitly selected tenant.
- Manager, Cashier, Kitchen, Display, custom profiles, and unauthenticated users cannot mutate payment QR configuration.
- Superadmin must select a concrete tenant; mutation is unavailable in the aggregate `all` view.
- Server authorization is authoritative; hiding UI controls is only a usability measure.

## Assumptions for approval

- “Payment QR” means a tenant-owned **static QR image** displayed during QRIS checkout; this does not verify provider payment status.
- MVP stores one current image per tenant and does not keep version history.
- Accepted formats: PNG, JPEG, or WebP; maximum 2 MB; the server verifies file signatures rather than trusting MIME headers.
- Cashiers may view the configured QR during checkout, but cannot configure it.

## Proposed data and API

### SQLite

Add a narrow table rather than putting binary content in shared POS JSON state:

```sql
CREATE TABLE IF NOT EXISTS tenant_payment_qr (
  business_id TEXT PRIMARY KEY REFERENCES tenants(id),
  mime TEXT NOT NULL,
  bytes BLOB NOT NULL,
  updated_by TEXT NOT NULL REFERENCES users(id),
  updated_at TEXT NOT NULL
);
```

### Endpoints

- `GET /api/payment-qr?business=<id>` — authenticated users scoped to the tenant receive metadata (`configured`, `mime`, `updatedAt`).
- `GET /api/payment-qr/image?business=<id>&v=<updatedAt>` — authenticated tenant users receive image bytes with `nosniff` and private cache headers.
- `PUT /api/payment-qr?business=<id>` — Admin for that tenant or global Superadmin; CSRF required; raw image body, allowlisted content type, ≤2 MB, magic-byte validation.
- `DELETE /api/payment-qr?business=<id>` — same authorization and CSRF requirements.

Authorization predicate:

```js
const canManagePaymentQr = (user, business) =>
  business !== 'all' && canAccess(user, business) &&
  (user.role === 'admin' || canAccessAll(user));
```

Do not grant this through editable custom-profile capabilities in MVP: the requirement is role-bound Admin/Superadmin only.

## Implementation tasks

### Task 1: Add backend storage and validation

**Files:**
- Modify: `server/app.mjs`
- Test: `server/app.node.test.mjs`

1. Add failing schema tests for the new table.
2. Add failing unit cases for valid PNG/JPEG/WebP signatures, spoofed MIME, unsupported MIME, empty body, and >2 MB body.
3. Add the table to `initializeSchema` and minimal byte-signature validator.
4. Run `npm run test:backend`; expect all tests to pass.
5. Commit: `feat: add tenant payment QR storage`.

### Task 2: Add tenant-scoped read and mutation endpoints

**Files:**
- Modify: `server/app.mjs`
- Test: `server/app.node.test.mjs`

1. Write a role/scope matrix test: own-tenant Admin allowed; other-tenant Admin denied; Superadmin selected tenant allowed; aggregate `all` denied; every other role denied; invalid CSRF denied.
2. Test upload, replacement, metadata read, image response headers/body, deletion, and missing-image behavior.
3. Implement the four routes using parameterized SQLite statements and the existing session, CSRF, `canAccess`, and `canAccessAll` helpers.
4. Write an audit entry on add/replace/remove without recording image bytes.
5. Run `npm run test:backend`; expect pass.
6. Commit: `feat: secure tenant payment QR API`.

### Task 3: Add Admin configuration UI

**Files:**
- Create: `src/pages/AdminPaymentQrPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/styles.css`
- Test: `src/App.test.tsx`

1. Add failing UI tests for route visibility, selected-tenant requirement, image preview, file validation, replace confirmation, removal, and accessible status/error feedback.
2. Add an Admin navigation item and route such as `/admin/payment-qr`; Superadmin reuses the Admin shell.
3. Build one card using existing `PageHead`, `Card`, `Button`, and alert styles: current status/preview, file input, Replace/Remove actions.
4. Hide the nav/action surface for non-Admin roles, but rely on API denial for security.
5. Disable configuration when Superadmin has `all` selected and explain “Select one tenant to configure its payment QR.”
6. Run `npm test -- --run src/App.test.tsx`; expect pass.
7. Commit: `feat: add tenant payment QR settings`.

### Task 4: Show configured QR at QRIS checkout

**Files:**
- Modify: the existing checkout/payment component discovered from `src/pages/OrderEntry.tsx`
- Test: `src/App.test.tsx`

1. Add failing tests: QRIS displays the selected tenant’s configured image; Cash does not; absent image gives a clear unavailable state and cannot falsely complete a QR payment.
2. Fetch metadata/image for the active tenant and render with meaningful alt text.
3. Keep current order/payment semantics unchanged; this image is display-only and not payment confirmation.
4. Run frontend tests and typecheck.
5. Commit: `feat: show tenant QR during QRIS checkout`.

### Task 5: Documentation, changelog, and full verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `FEATURE_LEDGER.md` and/or `features/administration.md`
- Modify: `scripts/public-e2e.mjs` if needed

1. Record the feature and explicit static-QR limitation.
2. Run `npm test`, `npm run test:backend`, `npm run typecheck`, `npm run lint`, and `npm run build`.
3. Rebuild/restart the app and deploy the built artifact.
4. Public E2E with real sessions: Admin own tenant succeeds; Admin cross-tenant is denied by API; Superadmin configures two different selected tenants; Manager cannot access route/API; Cashier sees only the configured QR at QRIS checkout; removal survives reload.
5. Inspect browser console/network for errors and verify image headers.
6. Commit and push only after all checks pass.

## Acceptance criteria

- One tenant’s QR never appears for another tenant.
- Direct API calls cannot bypass role, tenant scope, CSRF, size, MIME, or magic-byte checks.
- Superadmin cannot mutate while viewing `all`; selecting a tenant makes the action available.
- Admin can upload, replace, and remove their tenant’s QR, with persistence after restart/reload.
- Non-authorized roles receive HTTP 403 on mutations.
- Checkout displays the active tenant QR only for QRIS and does not claim that payment was verified.
- Changelog updated; build deployed; public E2E passes before READY.

## Risks and deliberate cuts

- SQLite BLOB is the shortest reliable path for one small image per tenant. Move to object storage only when file count/size or CDN delivery warrants it.
- Static QR cannot prove settlement. Provider-backed QRIS generation, expiration, webhook verification, reconciliation, and idempotent settlement are explicitly out of scope.
- No history/versioning in MVP; add only when audit/compliance requires restoring old QR images.

## Open questions for approval

1. Confirm this is a static uploaded QR image, not provider-generated dynamic QRIS.
2. Should Cashiers be blocked from completing a QRIS order when no QR is configured, or may they use an external/offline QR?
3. Is one QR per tenant sufficient, or is one QR per outlet/register required?

## Implementation gate

This document is planning only. Approval of assumptions or answers to open questions does not authorize implementation or deployment; proceed only after an explicit instruction to implement.
