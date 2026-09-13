# Light POS Order Customization, Catalog History, and Held Orders Implementation Plan

> **For Hermes:** Execute this plan sequentially with Codex (`gpt-5.6-sol`, medium) on a new feature branch; verify each task before starting the next.

**Goal:** Make ordering customization consistent, expose safe menu history/archive controls, and provide a complete held-order picker and restore flow.

**Architecture:** Keep the existing React/store/localStorage architecture. Reuse the accessible `Modal` and existing cart/order reducers; extract only one shared customization form if needed to guarantee add/edit parity. No new dependency, backend, or schema unless inspection proves notes are dropped by an existing reducer.

**Tech Stack:** React 18, TypeScript, Vitest/Testing Library, Vite, existing CSS and store.

---

## Problems captured from the request
1. Every available menu click in New Order must open customization rather than directly add plain items.
2. Customization needs an item notes field.
3. Clicking an order line must open an edit form visually identical to the add customization modal.
4. Menu Catalog buttons should not display “version” wording.
5. Clicking a catalog menu should show its historical versions.
6. Destructive actions such as menu archival need confirmation.
7. Menu Catalog needs an archive filter defaulting to non-archived menus.
8. New Order should show only a held-order count; clicking opens all held orders. Selecting one restores it, with replacement confirmation when an active order exists, then closes the modal.

## Current evidence from code inspection
- `src/pages/OrderEntry.tsx` currently opens customization only when `item.variations?.length`; plain items are added immediately.
- Add customization stores variations and quantity but has no notes input. The current line-edit modal only edits note/modifier and does not mirror the add UI.
- Held orders are computed already, but the page header resumes only `held[0]`; replacement uses `window.confirm` rather than the app modal.
- `src/pages/AdminMenuPage.tsx` owns version creation, archive action, and catalog rendering in one component.
- `src/domain.ts` already models `MenuVersion`, `CartLine.note`, versions, and archived menus, so no schema expansion is expected.
- Existing `Modal` already implements focus management; preserve it.

## Confirmed interpretation
“Clicking a menu in Menu Catalog opens historical versions” means clicking the menu card/primary menu affordance opens a read-only history modal listing every saved version, while explicit Edit/Archive controls remain separate and stop propagation. A historical row shows its version number as metadata; only button labels lose the word “version”.

## Ordered implementation plan

### Task 1: Lock behavior with failing interaction tests
**Files:** Modify `src/App.test.tsx` (or create focused page tests only if current setup requires it).

Add failing tests for: plain and variable menu clicks opening Customize; notes saved during add; order-line click reopening the same fields with current quantity/variations/note; catalog defaults to active-only and archive filter switches Active/Archived/All; menu click opens ordered historical versions; archive requires cancel/confirm; held count opens all held orders; restore closes modal; active-cart replacement cancel preserves both states and confirm replaces/restores/removes the held order.

Run `npm test -- --run` and verify only the new assertions fail for missing behavior before proceeding.

### Task 2: Unify add and edit customization
**Files:** Modify `src/pages/OrderEntry.tsx`; modify `src/store.tsx` only if the current update action cannot atomically persist quantity, selections, and note; modify `src/styles.css` only for existing-class parity.

- Open Customize for every available menu click; preserve unavailable behavior and long-press/Shift+Enter details.
- Use one customization form/render path for add and edit modes: variation groups (when present), quantity, Notes, calculated price, and contextual submit label.
- Initialize edit mode from the selected cart line and update that exact line rather than adding a duplicate.
- Keep required variation validation and quantity minimum 1.
- Preserve notes through held-order save/restore.

Run focused tests, then full tests; do not begin Task 3 until green.

### Task 3: Add catalog archive filtering and history disclosure
**Files:** Modify `src/pages/AdminMenuPage.tsx`; minimally modify `src/styles.css` if existing filter/card classes are insufficient.

- Add an accessible Active / Archived / All filter, default Active.
- Render filtered menu cards without changing stored data.
- Remove “version” from action-button text; retain concise actions such as Edit and History. Version identifiers remain in history content.
- Open a read-only history modal from menu-card click, newest first, showing version number/date/name/category/price and relevant ingredients, bundle composition, and variations.
- Ensure nested action buttons do not accidentally open history.

Run focused and full tests; proceed only when green.

### Task 4: Confirm destructive menu archival
**Files:** Modify `src/pages/AdminMenuPage.tsx`; reuse `src/components/molecules.tsx` `Modal` without changing it unless a generic confirmation prop is genuinely required.

Replace immediate archive mutation with an in-app confirmation modal naming the menu and consequence. Cancel makes no mutation; confirm archives once, closes the dialog, and keeps the current filter semantics. Do not add confirmations to reversible/non-destructive actions.

Run archive tests and full tests; proceed only when green.

### Task 5: Implement held-orders count, picker, and safe restore
**Files:** Modify `src/pages/OrderEntry.tsx`; modify `src/styles.css` only as needed.

- Header action displays only the count, e.g. `2 held orders`.
- Clicking opens an accessible modal listing every held order with ID, time/service/table summary, item count, and total.
- Clicking an order with no active cart restores immediately, removes it from held orders, and closes the picker.
- If an active cart exists, open an in-app confirmation modal stating it will be replaced. Cancel returns to the held list unchanged; confirm restores selected order, closes both dialogs, and preserves the existing inactive-coupon warning behavior.
- “Active order” means the current cart has at least one line; do not prompt for an otherwise empty draft.

Run focused then full tests; proceed only when green.

### Task 6: Build, public authenticated E2E, finalize
**Files:** No source changes except fixes proven necessary by verification.

1. Run `npm test -- --run`, `npm run lint`, `npm run typecheck`, and `npm run build`.
2. Deploy the clean build using the established Light POS deployment path discovered from repo/server configuration; do not guess a URL.
3. Perform authenticated public Playwright E2E for every flow above, desktop and mobile, including reload persistence, modal keyboard focus/Escape, no console errors, and cancel/confirm branches.
4. Keep status WORKING/VERIFYING until all public checks pass; READY only after authenticated public E2E.
5. Commit with a verified feature message, push the new branch, and report public link, commit, and push evidence.

## Likely files to change
- `src/pages/OrderEntry.tsx`
- `src/pages/AdminMenuPage.tsx`
- `src/App.test.tsx`
- `src/store.tsx` only if reducer support is missing
- `src/styles.css` only for minimal modal/filter/list styling

## Risks and invariants
- Do not break long-press/context-menu/Shift+Enter menu details or unavailable-item behavior.
- Do not mutate historical menu versions when displaying them.
- Archive filtering must not change New Order’s existing exclusion of archived menus.
- Restore remains atomic: cart, service, table IDs, coupon, and held-record removal update together.
- Use app modals, not `window.confirm`, for consistent accessibility and visual behavior.
- No dependencies, backend, generalized modal framework, or speculative history rollback.

## Implementation Gate
Plan approval is not implementation permission. Implementation starts only after an explicit instruction to proceed.
