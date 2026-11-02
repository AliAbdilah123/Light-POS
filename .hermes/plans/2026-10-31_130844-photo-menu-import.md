# Photo Menu Bulk Import Implementation Plan

> **For Hermes:** Implement only after explicit approval, task-by-task, with tests before production code.

**Goal:** Let an authorized admin upload one or more menu photos, have the backend extract menu items with AI, review and correct every draft item in the frontend, then save the approved items to the tenant menu catalog in one intentional action.

**Architecture:** Add a dedicated import workflow inside the existing `/admin/menu` catalog, reusing its menu schema and validation. Photos go to bounded `POST /api/ai/menu-parsing`; the backend calls Hermes using backend-only `HERMES_URL` and `HERMES_SECRET` environment variables and returns strict draft JSON. Extraction never mutates the catalog. The frontend owns the editable review draft, and `POST /api/menu` accepts an array for single or bulk transactional creation.

**Tech Stack:** Existing React/TypeScript/Vite frontend, Node HTTP backend, SQLite, native multipart/FormData, and the Hermes provider configured by environment. No new dependency unless the current Node runtime cannot safely parse the chosen upload shape.

---

## Executive recommendation

Build the smallest safe three-step flow:

1. **Upload** — admin selects up to 5 JPEG/PNG/WebP photos and starts extraction.
2. **Review** — show editable rows for `name`, `description`, `category`, and `price`; allow add, remove, and correction; flag missing or suspicious values.
3. **Save** — validate the entire draft, show a summary, then create all accepted menu items in one transaction.

AI output is a suggestion only. Do not silently save, overwrite, infer recipes/ingredients, create bundles, or create variations in MVP.

## Current implementation baseline

- `src/pages/AdminMenuPage.tsx` owns `/admin/menu`, creates single items/bundles, and validates name, description, category, positive price, ingredients, bundle composition, and variations.
- `src/domain.ts` defines `MenuItem` and immutable `MenuVersion`; a new item starts at version 1.
- `src/store.tsx` currently saves catalog changes through the generic revisioned `/api/state` mutation.
- `server/app.mjs` enforces tenant access, CSRF, role/capability rules, revision conflicts, audit entries, and SQLite transactions.
- `server/receiptUpload.mjs` already demonstrates bounded JPEG/PNG/WebP multipart ingestion, MIME allowlisting, magic-byte checks, parser isolation, and strict structured-response validation.
- `src/App.test.tsx` already tests menu creation, bundles, variations, and repeated creation. `server/app.node.test.mjs` covers authentication, tenant boundaries, mutation authorization, and upload behavior.

## Confirmed product flow

`photo upload → backend AI extraction → editable parsed menu review → final save`

## MVP decisions

- Entry point: secondary **Import from photos** action on **Menu catalog**.
- Permissions: reuse `manageCatalog`; admin and superadmin only under current role policy.
- Tenant: import is always scoped to the currently selected business; never allow `all`.
- Files: 1–5 images, JPEG/PNG/WebP, maximum 5 MB each and 20 MB total.
- Draft fields: name, description, category, price. Each row has include/remove controls.
- AI does not infer ingredients, cost, bundle composition, variations, availability, or archival status.
- New records only. Possible duplicates are warned about but never overwritten automatically.
- Saving is atomic: all valid included rows save, or none save.
- Original photos are temporary request inputs in MVP and are not persisted after extraction.
- The AI provider is Hermes. Its URL and secret come only from backend environment variables `HERMES_URL` and `HERMES_SECRET`; neither value is returned to the frontend, state, logs, or audit events. Missing configuration returns an honest unavailable response.

## Proposed API contracts

### `POST /api/ai/menu-parsing?business=<tenant>`

- Auth: session + CSRF + `manageCatalog` + tenant access.
- Body: `multipart/form-data`, repeated `photos` fields.
- Response `200`:

```json
{
  "items": [
    {
      "sourcePhoto": 0,
      "sourceLabel": "IMG_1042.jpg",
      "name": "Es Kopi Susu Aren",
      "description": "",
      "category": "Coffee",
      "price": 36000,
      "warnings": ["Description was not visible"]
    }
  ]
}
```

- Errors: `400` malformed upload, `403` denied tenant/capability/CSRF, `413` too large, `415` unsupported or spoofed image, `422` no menu items found, `503` provider unavailable, `504` provider timeout, `502` malformed provider output.

The provider prompt must request JSON only and state: preserve source language/spelling, return integer IDR amounts, do not invent hidden text, use empty strings/null plus warnings when uncertain.

### `POST /api/menu`

```json
[
  {
    "name": "Es Kopi Susu Aren",
    "description": "Espresso, milk, and palm sugar",
    "category": "Coffee",
    "price": 36000
  }
]
```

- Tenant remains the authenticated request's current business context. A one-element array creates one menu; a larger array bulk-creates menus.
- Revalidates permission, tenant access, item count, strings, and positive integer prices.
- Rejects duplicate names within the submitted batch; returns warnings for existing active catalog names before confirmation or a structured `409` if policy requires explicit acknowledgement.
- Creates standard item records with version 1, empty ingredients, `availability: "available"`, `archived: false`, `cost: 0`, and a generated icon.
- Commits catalog write and one tenant audit event in one SQLite transaction.
- Returns created IDs and refreshed catalog/revision or enough data for `reload()`.

## Frontend UX and states

### Upload

- Modal or focused panel opened from **Import from photos**.
- Drag/drop and file picker; keyboard-operable remove buttons; thumbnail, filename, size, and rejection reason.
- Disable extraction until valid files exist.
- Explain accepted formats and limits before selection.

### Processing

- Keep selected filenames visible.
- Show progress text such as “Reading 3 photos…”; disable duplicate submissions.
- Provide cancel if request cancellation is supported; otherwise allow closing without mutating the catalog.

### Review

- Editable table on desktop and stacked cards on mobile.
- Per item: include checkbox, name, description, category, price, source filename, warnings, remove.
- “Add item” allows correcting a missed menu without another AI call.
- Category uses editable text with suggestions from existing tenant categories, not a new category table.
- Mark empty required fields and non-positive/non-integer prices inline.
- Highlight exact normalized-name matches against existing active menus; user must remove or rename them in MVP.
- Preserve draft edits if final save fails.

### Save result

- CTA: **Save N menu items**.
- Confirmation summarizes item count and tenant.
- Success closes the importer, reloads catalog, and displays a success notice.
- Failure leaves edits intact and reports whether the cause is validation, conflict, permission, or server/provider failure.

## Implementation tasks

### Task 1: Define extraction and commit validators

**Files:**
- Create: `server/menuImport.mjs`
- Create: `server/menuImport.node.test.mjs`

1. Write failing tests for accepted image signatures, file count/size limits, strict provider JSON, required draft fields, integer IDR price normalization, and rejection of unknown keys/oversized strings.
2. Implement minimal native validators and a provider-result normalizer.
3. Verify: `node --test server/menuImport.node.test.mjs`.

### Task 2: Add the server-side Hermes provider adapter

**Files:**
- Modify: `server/menuImport.mjs`
- Test: `server/menuImport.node.test.mjs`

1. Test missing `HERMES_URL`, missing `HERMES_SECRET`, timeout, non-2xx response, malformed JSON, empty extraction, and secret-free errors/logs.
2. Call Hermes at `HERMES_URL`, authenticate with `HERMES_SECRET`, use a bounded timeout, and send validated images in the Hermes-supported vision request shape.
3. Validate the normalized result before returning it.
4. Verify the focused test file.

### Task 3: Add menu parsing endpoint

**Files:**
- Modify: `server/app.mjs`
- Test: `server/app.node.test.mjs`

1. Add failing tests for auth, CSRF, `manageCatalog`, tenant isolation, multipart errors, file limits, magic-byte spoofing, provider errors, and successful extraction.
2. Route `POST /api/ai/menu-parsing` through the reusable validator and Hermes provider adapter.
3. Verify: `npm run test:backend`.

### Task 4: Add generic atomic menu creation endpoint

**Files:**
- Modify: `server/app.mjs`
- Test: `server/app.node.test.mjs`

1. Test one-element single creation, multi-element bulk creation, empty/oversized arrays, duplicate submitted names, existing-name conflict, invalid-item rollback, stale revision/concurrent catalog update, tenant isolation, and audit metadata.
2. In `BEGIN IMMEDIATE`, reload current tenant state, validate every array item, append version-1 item records, increment revision, and record one audit event.
3. Return created IDs and new revision/data.
4. Verify backend tests.

### Task 5: Build the upload/review UI

**Files:**
- Create: `src/components/MenuPhotoImport.tsx`
- Modify: `src/pages/AdminMenuPage.tsx`
- Modify: `src/styles.css`
- Test: `src/App.test.tsx`

1. Test opening from Menu catalog, accessible file input, invalid local file feedback, extraction loading/error states, editable parsed rows, add/remove/include behavior, inline validation, duplicate warning, and responsive semantic structure.
2. Implement one contained component; do not refactor the existing single-menu modal.
3. Use existing `Button`, `Input`, `Modal`, and theme tokens.
4. Ensure stale extraction responses cannot replace a newer selection (AbortController or request token).
5. Verify focused frontend tests.

### Task 6: Wire final save and recovery

**Files:**
- Modify: `src/components/MenuPhotoImport.tsx`
- Modify: `src/store.tsx` only if a shared authenticated request/reload helper is required
- Test: `src/App.test.tsx`

1. Test confirmation, tenant name/count, disabled invalid submit, one request only, success reload, preserved edits after `409`/`500`, and no catalog mutation before save.
2. Send edited included rows as an array to `POST /api/menu` with CSRF; the existing manual single-menu form can reuse the same endpoint with a one-element array.
3. Reload state on success; keep review state on failure.

### Task 7: Documentation, changelog, and full verification

**Files:**
- Modify: `features/administration.md`
- Modify: `CHANGELOG.md`
- Modify: `scripts/public-e2e.mjs`

1. Document configuration, limits, user flow, and failure behavior.
2. Log the feature in the project changelog.
3. Add public E2E: login as admin, open importer, upload fixture image against a configured deterministic test parser, edit a result, save, refresh, and verify the menu persists.
4. Run `npm test`, `npm run test:backend`, `npm run typecheck`, `npm run lint`, and `npm run build`.
5. After approved implementation: restart backend, deploy built artifact, and run `npm run test:e2e:public` against the public app. READY only after public E2E passes.

## Acceptance scenarios

1. Admin imports a clear one-page menu, fixes one price, saves, refreshes, and sees every approved item.
2. Multi-photo import keeps source labels and combines drafts without duplicate submission.
3. A blurry photo can return warnings or “no items found” without changing the catalog.
4. Spoofed MIME, oversized file, excessive file count, malformed provider JSON, timeout, and unavailable provider produce safe, specific errors.
5. Required fields and positive integer IDR prices are enforced in UI and backend.
6. Duplicate rows cannot overwrite an existing menu.
7. Cross-tenant parsing and menu creation are denied.
8. A menu creation failure creates zero menu items and preserves the editable frontend draft.
9. `POST /api/menu` creates one menu from a one-element array and creates many atomically from a larger array.
10. Photos, `HERMES_URL`, and `HERMES_SECRET` never appear in catalog state, audit text, logs, or client-visible configuration.

## Risks and tradeoffs

- **OCR ambiguity:** manual review is mandatory; warnings are preserved per row.
- **Long provider latency:** bound timeout and input count; async durable jobs are postponed unless real latency makes synchronous extraction unreliable.
- **Generic state conflicts:** generic `POST /api/menu` avoids sending menu creation through the whole `/api/state` payload and gives single and bulk creation the same atomic contract.
- **Duplicate detection:** normalized exact-name matching is intentionally conservative; fuzzy matching is postponed to avoid false positives.
- **Image retention:** not retaining originals minimizes privacy/storage scope but removes later extraction audit. Add retention only with an explicit policy.

## Postponed scope

- Recipes, ingredients, costs, bundles, variations, modifiers, taxes, and availability extraction.
- PDF input, camera capture, crop/rotate tools, OCR bounding boxes, and background job dashboard.
- Automatic category creation rules, fuzzy merge, overwrite/update existing menu, and per-item confidence scoring unless the provider can supply calibrated values.
- Persisting original photos or extraction history; the editable import draft remains frontend-only in MVP.

## Open questions for approval

1. Should MVP accept multiple photos (recommended: up to 5) or exactly one photo per import?
2. Should exact duplicate menu names be blocked (recommended) or allowed after explicit confirmation?
3. Should the AI be asked for descriptions when they are not printed? Recommended: **no**—leave blank and require user correction.

## Implementation gate

This document is planning only. Do not modify, deploy, or migrate the application until the user explicitly approves implementation. Approval of individual policy answers updates this plan but is not deployment permission.
