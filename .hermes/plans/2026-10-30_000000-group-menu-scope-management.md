# Group Menu Scope Management Implementation Plan

> **For Hermes:** Implement this plan task-by-task after explicit approval.

**Goal:** Let tenant administrators manage unified access profiles that combine feature enablement with menu-category and individual-item scope.

**Architecture:** Merge the user-facing concepts of roles and groups into **Access Profiles**. Existing roles become protected system profiles (Cashier, Manager, Admin, Kitchen, Display) that define capability defaults; admins can duplicate them into tenant-owned custom profiles and adjust enabled features plus menu scope. Each user has one access profile. The server resolves effective capabilities and menu access from that profile, enforces both on every endpoint/mutation, and returns the normalized result to the frontend.

**Tech Stack:** Node.js HTTP server, built-in SQLite, React 18, TypeScript, Vitest, Node test runner, Playwright public E2E.

---

## Confirmed decisions

- Scope supports **both menu categories and individual menu items**.
- Feature enablement and menu scope are managed together as one **Access Profile**; do not expose separate Role and Group concepts to admins.
- Current roles are migrated into protected system profiles: Cashier, Manager, Admin, Kitchen, and Display. Superadmin remains a global system identity and cannot be tenant-edited.
- Tenant admins may duplicate a system profile, rename the copy, enable/disable supported features, and configure menu scope.
- A profile may combine category and item selectors; access is the **union** of selected categories and selected item IDs.
- Each user has exactly one profile. Existing users map automatically from their current role, preserving behavior.
- Feature and menu scope are both allowlists. Empty feature selection enables nothing; empty limited-menu selection grants no menu access. “All menu” is explicit.

## Minimal UX

Add **Users & access** to tenant administration. Use two tabs:

1. **Users** — existing tenant-user records, access-profile assignment, status, and password reset. Remove the separate editable role selector.
2. **Access profiles** — protected system profiles plus tenant-owned custom profiles.

The profile editor has three sections:

1. **Profile details** — name and optional “Start from” system profile when creating.
2. **Enabled features** — checkboxes grouped by product area (Orders, People, Operations, Catalog, Reporting, Administration). Dependencies are explicit: enabling a mutation automatically requires its matching view capability; unsupported combinations are disabled with an explanation.
3. **Menu access** — explicit `All menu` / `Limited menu`; limited mode shows searchable categories and menu items grouped by category, with a live effective-product count.

System profiles can be viewed and duplicated but not edited/deleted. Custom profiles can be edited; deletion is blocked while assigned. Archived menu references remain visible but disabled so saved rules are understandable.

## Role merge and capability model

The current `Role` and `Capability` code is already the correct seed for this merge: `src/domain.ts` defines capability keys and role defaults, while `server/app.mjs` separately defines mutable datasets. Consolidate these into one canonical access-profile policy instead of layering groups over roles.

- Keep stable capability keys for route/navigation checks, but replace `can(role, capability)` with `can(session.capabilities, capability)`.
- Map current roles to immutable system-profile IDs during migration. Keep a minimal internal account kind only where needed for global superadmin and tenant-admin safety boundaries; it is not a second admin-facing permission model.
- Define backend authorization per capability/action, not only broad mutable dataset lists. A profile enabling `manageExpenses` must not inherit unrelated Manager powers.
- Navigation is generated/filtered from effective capabilities; direct routes use the same effective capability set.
- Dashboard landing selects the first valid destination for the profile; no enabled features produces a safe “No access assigned” page.
- Tenant admins cannot grant global superadmin powers, cross-tenant access, access-profile administration, or other reserved capabilities.

## Enforcement rules

- Effective access requires **both** the relevant feature capability and any applicable resource scope. Example: `createOrder` plus menu-item allowance.
- Effective menu access is `selected category OR selected item ID`.
- Bundles are visible only when the bundle itself is selected/in a selected category **and** every required component is accessible; fail closed otherwise.
- Backend enforces capabilities and menu scope on reads and writes. Hidden navigation/UI is not authorization.
- If a custom profile is removed, assigned users must first be reassigned.
- Renaming a category does not silently widen access. Introduce stable category IDs rather than persisting labels.
- Access-profile edits invalidate affected active sessions so revocation is immediate.

## Task 1 — Lock domain semantics with tests

**Files:**
- Modify: `src/domain.ts`
- Modify: `src/App.test.tsx`
- Modify: `server/app.node.test.mjs`

1. Add failing unit cases for capability allowlists, system-profile parity, union menu semantics, empty limited scope, all-menu mode, archived entries, and bundle component denial.
2. Add failing backend tests proving a custom-profile user cannot access a disabled feature or read/sell an unauthorized menu item.
3. Run `npm test -- --run` and `npm run test:backend`; confirm new tests fail for missing behavior.
4. Add minimal pure `hasCapability(capabilities, key)` and `menuAllowed(scope, item, catalog)` helpers shared conceptually by UI/server (duplicate only if runtime boundaries require it).

## Task 2 — Persist tenant groups and user assignment

**Files:**
- Modify: `server/app.mjs`
- Modify: `server/app.node.test.mjs`
- Modify: `server/reset-seed.mjs`

1. Extend `initializeSchema` with tenant-owned access profiles, profile capabilities, category-scope, item-scope, and user profile assignment storage, including foreign keys and uniqueness constraints.
2. Migrate existing users from current roles to matching protected system profiles, preserving exact capabilities and access.
3. Seed a Food Cashier example profile without overwriting operator changes on restart.
4. Add transactional repository operations and tests for tenant isolation, duplicate names, reassignment guards, and stale menu references.

## Task 3 — Add access-profile management API

**Files:**
- Modify: `server/app.mjs`
- Modify: `server/app.node.test.mjs`

1. Add admin-authorized tenant endpoints to list/create/duplicate/update/delete profiles and assign users; return the supported editable and reserved capability catalog.
2. Validate CSRF, tenant ownership, allowed capability keys, capability dependencies, reserved grants, explicit scope mode, category IDs, item IDs, and payload sizes.
3. Return normalized profiles with counts and effective menu summaries.
4. Ensure tenant admins cannot read or mutate another tenant’s groups and cannot grant global/superadmin access.

## Task 4 — Return and enforce effective session scope

**Files:**
- Modify: `server/app.mjs`
- Modify: `server/app.node.test.mjs`
- Modify: `src/store.tsx`

1. Include normalized profile ID, effective capabilities, and menu scope in `/api/session` without exposing unrelated administration data.
2. Replace role-only endpoint/mutation checks with effective-capability checks; filter state/catalog responses by capability and menu scope where appropriate.
3. Reject order writes containing unauthorized menu IDs, including crafted requests and inaccessible bundle components.
4. Invalidate or refresh active sessions after profile assignment/capability/scope changes so permissions do not remain stale.

## Task 5 — Build Users & access administration

**Files:**
- Create: `src/pages/AdminUsersGroupsPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/store.tsx`
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`

1. Add the reserved access-profile administration route/capability and navigation entry.
2. Reuse existing button, card, field, badge, and modal primitives.
3. Build Users and Access profiles tabs with loading, empty, error, and success states.
4. Build keyboard-accessible profile create/edit UI with grouped feature checkboxes, dependency guidance, explicit all/limited menu mode, category checkboxes, searchable item checkboxes, effective-count summary, and destructive-action guard.
5. Add user access-profile assignment to create/edit user flow.
6. Keep controls usable at 360px and preserve 44px touch targets.

## Task 6 — Apply scope to order entry

**Files:**
- Modify: `src/pages/OrderEntry.tsx`
- Modify: `src/store.tsx`
- Modify: `src/App.test.tsx`

1. Derive the visible catalog from server-issued effective scope before search/category filtering.
2. Never show unauthorized categories/items in search, detail, customization, held-order restore, or bundle composition.
3. Refuse restoration of a held order containing newly unauthorized products and explain which lines need removal.
4. Test Food Cashier, mixed category + item access, empty scope, and scope changed while signed in.

## Task 7 — Changelog, regression, deployment, and public E2E

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `scripts/public-e2e.mjs`

1. Record the feature in the project changelog.
2. Run `npm test`, `npm run test:backend`, `npm run lint`, `npm run typecheck`, and `npm run build`.
3. Verify every existing role maps to a system profile with identical route and mutation behavior, then commit and push only after all checks pass.
4. Rebuild/restart the live app and deploy the fresh `dist/` artifact.
5. Run public E2E as admin: duplicate Cashier into a Food Cashier profile, disable unrelated features, select a food category plus one out-of-category item, assign a user, then verify enabled/disabled navigation, allowed products, and denied products.
6. Verify a crafted unauthorized order request is rejected server-side.
7. Mark READY only after public E2E passes.

## Acceptance criteria

- Admin can create, duplicate, edit, and safely delete/reassign custom access profiles per tenant.
- An access profile can allow all menu, selected categories, selected items, or a union of category and item selections.
- Access-profile assignment persists and is reflected after login/session refresh.
- Scoped cashiers see only their effective catalog across all order-entry paths.
- Server rejects unauthorized items regardless of client behavior.
- Bundles fail closed when required components are outside scope.
- Existing users retain exact behavior through migrated protected system profiles.
- Tenant isolation, CSRF, accessibility, mobile layout, tests, live deployment, and public E2E all pass.

## Deliberate MVP limits

- One access profile per user; add multi-profile composition only when a real overlap case appears.
- Custom profiles use the existing capability keys; field-level permissions and arbitrary user-specific overrides are deferred.
- No schedule-based or location-subarea scope.

## Implementation gate

This plan is for review only. Do not implement, deploy, or migrate production data until Capt4ce explicitly approves implementation.
