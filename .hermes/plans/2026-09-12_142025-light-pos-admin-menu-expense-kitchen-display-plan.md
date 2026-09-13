# Light POS Operations Expansion Implementation Plan

> **For Hermes:** Implement this plan sequentially on a fresh feature branch, using Codex `gpt-5.6-sol` with medium reasoning per approved milestone; independently verify each milestone before starting the next.

**Goal:** Expand the current Light POS frontend demo with configurable operations, catalog/menu governance, richer expenses, experiments, and Kitchen/Display roles while preserving current order workflows.

**Architecture:** Keep the present React/Vite + `localStorage` demo architecture for a reviewable prototype. Move hard-coded operational data into the existing store and domain types. Treat authorization and receipt OCR as explicit prototype boundaries: role UI can be modeled locally, but production-safe permissions, shared kitchen state, durable versioning, and private receipt processing require a backend/API.

**Tech stack:** React 18, TypeScript, React Router, Vitest/Testing Library, native browser file APIs/localStorage, existing Lucide icons. No new dependency unless the approved receipt-parser provider requires its SDK; prefer direct `fetch`.

---

## Problems captured from the request

1. Remove the cashier dashboard **Shift sales** metric card.
2. Admin-managed order types, seeded with **Dine In**, **Takeaway**, and **Delivery**; add, archive, enable, and disable; only enabled types appear in New Order.
3. Admin-managed seats: add, edit, remove/archive, enable/disable, and keep active-order references safe.
4. Expenses support one nested detail level, receipt-image parsing/prefill, category search/history reuse, date filtering, and no **Recorded** label.
5. Admin can perform every action available to other roles.
6. Admin can add, version-edit, and archive menus with name, description, category, ingredients, and price; ingredients default hidden.
7. Long-pressing a menu on New Order opens details and reveals only non-hidden ingredients.
8. Bundle menus combine multiple menus with a custom price.
9. Admin Experiments can model projections from data plus assumptions, define an experimental menu set and per-day sales targets, project ingredient purchasing, permit one active experiment, and finalize into the main menu.
10. Add Kitchen role: order cards, full-screen order detail, mark ready, and mark menu low/sold-out.
11. Add Display role: read-only menu visibility for the current session.

## Current evidence from code inspection

- Repository: `/home/ubuntu/projects/light-pos`; current branch `feat/order-messages-open-orders`; no remote is configured.
- The app is a frontend-only demo. `src/store.tsx` persists one aggregate `Data` object to `light-pos-demo-v1` in `localStorage`.
- Roles are hard-coded to `cashier | manager | admin` in `src/domain.ts`; role control changes routes but is not an authorization boundary.
- Menu and seats are immutable fixtures in `src/mockData.ts`; New Order imports them directly.
- Service modes are a TypeScript union and three hard-coded New Order buttons.
- Expense rows only contain `label`, `amount`, and `date`; the page uses status `Recorded`.
- Existing menu lab is planning notes/classification, not catalog CRUD or experiments.
- Existing tests cover representative local workflows. Nginx publishes the app under `/projects/light-pos/`.

## Confirmed implementation posture

- Use the smallest working extension of the current demo: no speculative backend in this phase.
- Preserve historical snapshots: orders retain menu names/prices; archived types, seats, or menus remain readable on existing records.
- Archive by default instead of destructive deletion when a record is referenced.
- Exactly one nested expense level: expense header → line items; no recursive tree.
- Ingredient visibility defaults to hidden.
- Bundle components reference menu IDs and quantities; checkout stores the sold bundle as a normal immutable order-line snapshot.
- Admin gets the union of cashier, manager, and admin navigation/actions through route-level capability checks.

## Proposed domain model

Modify `src/domain.ts` with compact records:

- `Role = cashier | manager | admin | kitchen | display`
- `OrderType { id, name, enabled, archived, requiresSeat }`
- `Seat { id, name, capacity, status, enabled, archived }`
- `Ingredient { id, name, quantity?, unit?, hidden }`
- `MenuVersion { version, name, description, category, ingredients, price, components?, createdAt }`
- `MenuItem { id, kind: item | bundle, currentVersion, versions, availability: available | low | sold-out, archived }`
- `ExpenseLine { id, description, quantity?, unit?, amount }`
- `Expense { id, label, category, amount, date, lines[] }` where amount equals line sum when lines exist.
- `Experiment { id, name, assumptions, menuDrafts, dailyTargets, projectedRevenue, projectedIngredients, status: draft | active | finalized | archived }`

Migrate old `localStorage` data during `load()` instead of breaking existing saved demos; seed default order types, seats, menu versions, and categories.

## Ordered implementation plan

### Milestone 1 — Remove Shift sales

**Files:** `src/pages/CashierPages.tsx`, `src/App.test.tsx`.

1. Add a failing render test asserting the dashboard has no `Shift sales` metric while the remaining metrics render.
2. Remove only that metric.
3. Run the focused test, then `npm test`, lint, typecheck, and build.

**Acceptance:** no Shift sales card at cashier dashboard; responsive metric grid remains valid.

### Milestone 2 — Persist configurable order types

**Files:** `src/domain.ts`, `src/mockData.ts`, `src/store.tsx`, `src/pages/AdminPages.tsx`, `src/pages/OrderEntry.tsx`, `src/App.tsx`, `src/components/AppShell.tsx`, tests.

1. Add types, default seed, and backward migration from legacy service strings.
2. Add Admin → Order types CRUD/status surface. Names must be trimmed and unique case-insensitively; archive referenced records rather than deleting.
3. Render only enabled, non-archived order types in New Order; repair an invalid current selection to the first enabled value.
4. Use `requiresSeat` instead of comparing to `Dine in`.
5. Tests: defaults, add, disable/enable, archive, selection fallback, historical order rendering, and no-enabled-types empty state.

### Milestone 3 — Persist/administer seats

**Files:** `src/domain.ts`, `src/mockData.ts`, `src/store.tsx`, `src/pages/OrdersSeats.tsx`, `src/pages/OrderEntry.tsx`, admin route/nav, tests.

1. Replace fixture reads with persisted seats and migrate `seatStatuses`.
2. Add Admin seat management: name/identifier, capacity, enabled/archive state, status.
3. Prevent hard deletion when an active order references a seat; archive instead. New Order lists enabled, non-archived, available seats plus its currently selected seat.
4. Tests: add/edit/archive, referenced-seat protection, unavailable filtering, reload persistence.

### Milestone 4 — Expense ledger improvements

**Files:** `src/domain.ts`, `src/mockData.ts`, `src/store.tsx`, `src/pages/ManagerPages.tsx`, styles, tests.

1. Migrate legacy expenses to `category` plus empty `lines`.
2. Add searchable category input backed by distinct historical categories (native `datalist`; no dependency).
3. Add optional one-level line editor with description, quantity/unit, amount, add/remove; derive header amount from lines.
4. Remove `Recorded` badge and use plain date/category metadata.
5. Add From/To date filters; inclusive local-date string comparison; filtered total and count match visible rows.
6. Tests: category reuse, nested sum, validation, remove line, inclusive ranges, empty range, and persistence.

### Milestone 5 — Receipt image parsing/prefill

**Files:** `src/pages/ManagerPages.tsx`, `src/services/receiptParser.ts` (only if needed), tests; environment documentation if provider approved.

1. Add image chooser with type/size validation and preview; do not persist image bytes in `localStorage`.
2. Define a minimal parser result contract: merchant/label, date, category suggestion, and `{description, quantity, unit, amount}[]`.
3. Call the approved OCR/vision endpoint with `fetch`; show parsing/error/retry state; never auto-save—prefill editable fields for admin confirmation.
4. Mock the parser boundary in tests; verify malformed/partial responses, image rejection, prefill, edit-before-save.

**Blocked decision:** provider, credential location, privacy/retention policy, and whether browser-direct upload is acceptable. Production should proxy private receipts through a backend; no API key may be embedded in Vite.

### Milestone 6 — Admin capability union

**Files:** `src/App.tsx`, `src/components/AppShell.tsx`, capability helper in `src/domain.ts` or `src/permissions.ts`, tests.

1. Centralize `can(role, capability)`; admin always returns true.
2. Expose cashier/manager operational pages in admin navigation without duplicating implementations.
3. Guard action visibility and route access consistently; kitchen/display get least privilege.
4. Tests: role-route/action matrix, including admin parity and kitchen/display denial.

**Boundary:** this is demo UX authorization only. Production enforcement belongs on every API mutation/query.

### Milestone 7 — Versioned menu and ingredients

**Files:** `src/domain.ts`, `src/mockData.ts`, `src/store.tsx`, new `src/pages/AdminMenuPage.tsx` (or minimally replace `MenuLab`), `src/pages/OrderEntry.tsx`, tests.

1. Migrate fixture menu into persisted version-1 records.
2. Admin form supports name, description, category, price, ingredient rows, and ingredient hidden toggle defaulting `true`.
3. Editing creates a new immutable version; archive/unarchive controls current availability. Historical orders remain snapshots.
4. New Order reads current, non-archived menu versions and availability.
5. Implement pointer long-press with a native timer plus keyboard/context alternative (`Details` accessible action); cancel on movement, pointer cancel, or normal tap. Modal shows description/category/price and only non-hidden ingredients.
6. Tests: create, validation, version increment/history, archive, hidden filtering, long-press cancellation, keyboard-accessible details.

### Milestone 8 — Bundle menu

**Files:** same menu files plus `src/domain.ts`, cart tests.

1. Add `kind=bundle`, component menu IDs/quantities, custom price; require at least two valid, non-self components.
2. Detect and reject bundle cycles; simplest ceiling is bundles may contain standard menus only.
3. Show bundle composition in admin and menu detail; only non-hidden component/ingredient information reaches cashier/display.
4. Tests: validation, archived component handling, custom-price totals, immutable order snapshot.

### Milestone 9 — Experiments

**Files:** `src/domain.ts`, `src/store.tsx`, new `src/pages/ExperimentsPage.tsx`, `src/App.tsx`, nav/styles/tests.

1. CRUD draft experiments with assumptions and cloned draft menu versions/bundles.
2. Capture per-menu daily targets. Compute projected revenue and ingredient requirements deterministically from target × recipe quantities; clearly label missing recipe quantities.
3. Enforce one active experiment in the update function; activating one deactivates the prior active experiment atomically.
4. `Finalize` requires confirmation, creates new main-menu versions, records finalized timestamp/result, and cannot run twice.
5. Tests: calculation fixtures, one-active invariant, archive, finalize idempotency, and menu-version application.

**YAGNI:** no causal inference or claim that price changes “cause” revenue changes. This is scenario arithmetic based on explicit assumptions.

### Milestone 10 — Kitchen role

**Files:** role/domain/store, new `src/pages/KitchenPage.tsx`, router/nav/styles/tests.

1. Add kitchen route showing actionable `Preparing` orders as cards, sorted oldest first.
2. Click opens full-screen accessible dialog with complete line quantities, modifiers, and notes; mark Ready via existing status transition semantics.
3. Kitchen can set current menu availability to available/low/sold-out. New Order disables sold-out, visibly marks low.
4. Tests: sorting/filtering, modal, Ready transition, low/sold-out propagation, kitchen permission limits.

### Milestone 11 — Display role

**Files:** new `src/pages/DisplayMenuPage.tsx`, router/nav/styles/tests.

1. Add read-only full-session menu grid using current non-archived menu versions.
2. Show availability clearly; expose only non-hidden ingredients and no mutation controls, prices configurable only if confirmed.
3. Tests: visibility filtering, ingredient privacy, no action controls, role route.

### Milestone 12 — Integrated verification and delivery

1. Run focused tests after every milestone before proceeding; stop and fix failures immediately.
2. Final checks from repository root: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build -- --base=/projects/light-pos/`.
3. Run/update browser checks at 320/375/414/768/1024 for all new routes; assert no overflow, uncaught errors, or unexpected console/network errors.
4. Browser E2E matrix: admin order type/seat/menu/expense/experiment; cashier enabled type/seat/menu detail/bundle; kitchen Ready + sold-out; display read-only visibility; reload persistence.
5. Use a new feature branch. Inspect/stage only task files, commit, and push. **Current blocker:** no Git remote exists, so push requires a remote URL.
6. Deploy built `dist/` to the existing Light POS nginx document root only after implementation approval; verify exact public bundle and authenticated/public role flows as applicable.

## Likely files to change

- `src/domain.ts`
- `src/mockData.ts`
- `src/store.tsx`
- `src/App.tsx`
- `src/components/AppShell.tsx`
- `src/pages/CashierPages.tsx`
- `src/pages/OrderEntry.tsx`
- `src/pages/OrdersSeats.tsx`
- `src/pages/ManagerPages.tsx`
- `src/pages/AdminPages.tsx` or focused new admin pages
- `src/styles.css`
- `src/App.test.tsx`, `src/domain.test.ts`, and small focused test files
- browser-check scripts if present/restored

## Risks and tradeoffs

- `localStorage` cannot safely coordinate multiple devices/roles. Kitchen and cashier updates synchronize only within the same browser storage context unless a backend is added.
- Client-only role controls are not security. “Admin can do everything” is demonstrable UX, not enforceable authorization.
- Large receipt images and catalog histories must not be stored directly in `localStorage`; quotas are small and data is unencrypted.
- Menu and experiment version histories can grow; for this demo, retain them locally. Production needs normalized persistent storage and audit identity.
- Changing from string service modes/table IDs requires migration tests so existing saved orders still render.

## Confirmed decisions — 12 September 2026

1. The backend owns OCR/vision provider integration and stores receipt images/results; the frontend uploads through the application API and never embeds provider credentials.
2. Manage **tables**, grouped in availability summaries by capacity (for example, **2 seats: 2/5**, **4 seats: 5/10**). Dine-in order creation supports selecting multiple tables.
3. Archive is preferred for order types, tables, and menus, especially when referenced historically.
4. Display shows prices. “Current app session” resolves the menu set dynamically: use the active experiment menu set when one exists; otherwise use the default menu set.
5. Kitchen lists **Preparing** orders only.
6. Finalizing an experiment applies it to the main menu immediately.

## Implementation gate — approved

Implementation was explicitly approved on 12 September 2026. Create a fresh branch and execute milestones in order, advancing only after each milestone’s focused verification passes. Deployment remains a separate final gate after tests and public browser verification.
