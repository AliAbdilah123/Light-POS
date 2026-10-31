# Tenants, Users & Roles Management Implementation Plan

> **For Hermes:** implement only after explicit approval, following TDD and the existing Light POS deployment/E2E workflow.

**Goal:** Give global superadmins a Tenants management page, rename Access Profiles to Roles in product language, move user/role create/edit forms into accessible modals, and present users and roles as searchable, filterable, sortable tables.

**Architecture:** Reuse the existing tenant, user, and access-profile APIs and the existing accessible `Modal`/`FormActions` components. Keep `/api/access-profiles`, database tables, capability IDs, and system-profile IDs unchanged in this release; “Roles” is a UI terminology migration, avoiding a risky data migration. Add only the missing superadmin tenant route/page and client-side table controls because current tenant-sized datasets are already returned in full.

**Tech Stack:** React 18, TypeScript, existing CSS/components, Node HTTP server, SQLite, Vitest/Testing Library, Node test runner, Playwright public E2E.

---

## Problems captured from the request

1. Superadmin has no dedicated Tenants page for add, edit, disable, and enable operations.
2. Common forms are inconsistent: Edit user and Create/Edit access profile render at the bottom of the page instead of in modals.
3. “Access Profiles” should be presented as “Roles.”
4. Users and roles need proper data tables with quick search, filtering, and sorting.

## Current implementation evidence

- `server/app.mjs:113-115` already provides superadmin-only `GET /api/tenants`, `POST /api/tenants`, and `PUT /api/tenants/:id`, including the `active` flag. No new schema or tenant endpoint is needed.
- `src/pages/AdminUsersAccessPage.tsx:22-25` renders Users and Access profiles, but users are status rows, roles are cards, and edit/create forms are inline after the content.
- `src/components/molecules.tsx:6-7` already provides an accessible focus-trapping `Modal` and `FormActions`; reuse them.
- `server/app.mjs:116-123` already supports profile/role and user listing/mutations. Keep these contracts stable.
- `src/components/AppShell.tsx:9` has a shared admin navigation model and maps superadmin to it; Tenants must be conditionally visible only to global superadmin.
- Existing backend tests already exercise tenant lifecycle and profile/user enforcement in `server/app.node.test.mjs`.

## Confirmed product decisions / defaults

- “Roles” replaces “Access Profiles” in all user-facing labels, headings, help text, buttons, and validation messages touched by this feature.
- Internal API paths, SQLite table names, capability keys (`viewAccessProfiles`, `editAccessProfiles`), and `profileId` remain unchanged for compatibility.
- Tenant “disable” is reversible and uses the existing `active` flag; no delete action is added.
- Tenant ID is entered only during creation and is immutable during editing.
- Tables use native client-side search/filter/sort with existing dependencies only; no table package.
- Creation and editing use the existing accessible modal. Enable/disable is a quick row action with confirmation before disabling.

## Proposed information architecture

- Add **Tenants** to superadmin navigation, route `/admin/tenants`; hide it from tenant admins.
- Rename **Users & access** to **Users & roles**.
- On Users & roles, retain two tabs: **Users** and **Roles**.
- Each tab has one toolbar above a semantic table: quick search, relevant filters, sortable column headers, result count, and primary create action where supported.

## Table behavior

### Users
- Search: display name and username.
- Filters: Role (all listed roles), Status (All / Active / Inactive).
- Sort: Name, Username, Role, Status.
- Columns: User, Username, Role, Status, Actions.
- Row action: Edit user; existing active checkbox remains in the modal.

### Roles
- Search: role name.
- Filters: Type (All / System / Custom), assignment state (All / Assigned / Unassigned).
- Sort: Name, Type, Assigned users.
- Columns: Role, Type, Assigned users, Menu access, Actions.
- Actions: Duplicate for protected system roles, Edit for custom roles; preserve existing delete rules if exposed.

### Tenants
- Search: tenant name, ID, location.
- Filter: Status (All / Enabled / Disabled).
- Sort: Name, ID, Location, Status.
- Columns: Tenant, ID, Location, Status, Actions.
- Actions: Edit, Disable/Enable. Disabled tenants remain visible and manageable.

## Implementation tasks

### Task 1: Lock terminology and table behavior with frontend tests

**Files:**
- Modify: `src/App.test.tsx`

1. Add a superadmin test asserting Tenants navigation/route is available and tenant admin cannot see it.
2. Add Users & roles tests for visible Roles terminology and absence of “Access profiles” in the rendered UI.
3. Add tests that user and role create/edit actions open dialogs rather than inline page cards.
4. Add table tests for search, role/status/type filters, ascending/descending sorting, and empty results.
5. Run `npm test -- --run src/App.test.tsx`; verify the new tests fail for the expected missing UI.

### Task 2: Add the superadmin Tenants page using existing APIs

**Files:**
- Create: `src/pages/AdminTenantsPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/styles.css`

1. Build a page that loads `GET /api/tenants` and renders a semantic table.
2. Add native controlled inputs for quick search, status filtering, and stable sorting.
3. Reuse `Modal`, `Input`, `Button`, and `FormActions` for create/edit.
4. POST new tenants and PUT edits/status changes through existing endpoints with CSRF.
5. Keep tenant ID immutable after creation; disable requires confirmation; enable is immediate.
6. Add a global-superadmin-only route guard and nav item. Do not infer this from generic admin capability alone.
7. Run the focused frontend tests until green.

### Task 3: Convert Users & access into Users & roles tables and modals

**Files:**
- Modify: `src/pages/AdminUsersAccessPage.tsx`
- Modify: `src/styles.css`

1. Replace user status rows and role cards with semantic responsive tables.
2. Rename visible profile terminology to role terminology while retaining API field names internally.
3. Add quick search, relevant filters, and stable sortable headers with `aria-sort`.
4. Wrap Edit user and Create/Edit role forms in the existing `Modal`; use `FormActions` and preserve focus return/Escape behavior.
5. Preserve all permission dependency logic, protected-role duplication, menu category/item scope, archived-item disabling, assignment counts, API calls, and error handling.
6. On narrow screens, keep the table horizontally scrollable with the first identifying column readable; do not convert records into unrelated cards.
7. Run focused tests until green.

### Task 4: Keep backend contracts and security verified

**Files:**
- Modify only if coverage gaps require it: `server/app.node.test.mjs`

1. Retain existing endpoint names and schema.
2. Assert tenant-admin denial for tenant management and superadmin success for create/edit/disable/enable.
3. Assert disabled tenant access remains denied while the tenant remains listable to superadmin.
4. Run `npm run test:backend`.

### Task 5: Product documentation and full verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `features/administration.md`
- Modify if public E2E selectors need durable labels: `scripts/public-e2e.mjs`

1. Add the implementation entry to the changelog.
2. Update administration feature documentation from Access Profiles to Roles and document Tenants.
3. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:backend`, and `npm run build`.
4. Rebuild/restart and deploy the live artifact using the project’s established path.
5. Run `npm run test:e2e:public` against `https://dev-light-pos.ahsanworks.com/` and manually verify superadmin tenant lifecycle plus users/roles table operations at desktop and mobile widths.
6. Check browser console for errors and verify modal keyboard behavior.
7. Commit and push only after public E2E passes.

## Acceptance criteria

- Only global superadmin can navigate to and use Tenants.
- Superadmin can add, edit, disable, and re-enable a tenant; status persists after reload.
- Disabled tenants stay visible in Tenants but cannot be selected for normal operational access.
- No touched user-facing surface says Access Profile(s); it says Role(s).
- Edit user and create/edit role open accessible dialogs, never inline bottom forms.
- Users, Roles, and Tenants render as semantic tables with working quick search, relevant filters, and reversible sorting.
- Existing capability dependencies, role assignment, menu scope, protected system-role behavior, CSRF, and tenant authorization remain intact.
- Typecheck, lint, frontend tests, backend tests, build, live restart/deploy, and public E2E all pass.
- `CHANGELOG.md` records the implementation.

## Risks and controls

- **Terminology migration accidentally changes contracts:** UI-only rename; preserve API/schema identifiers.
- **Superadmin route leaks to tenant admin:** explicit global-superadmin guard plus backend enforcement and tests.
- **Table controls become over-engineered:** local `useMemo` filtering/sorting; no dependency or reusable table framework until another page proves the need.
- **Large role modal:** retain one modal with scrollable body and sticky actions using existing components; no multi-step wizard.
- **Disabled active tenant context:** after status change, reload tenant data and prevent operational access through existing server checks.

## Postponed scope

- Server-side pagination, bulk tenant/user actions, role deletion redesign, audit-log UI, and API/schema renaming.
- Add pagination only when real tenant/user counts make client-side tables measurably slow.

## Implementation gate

This document and its design preview are for approval only. Do not modify product behavior, deploy, or treat design feedback as implementation permission until the user explicitly approves implementation.

## Review links

- Plan: `https://dev.ahsanworks.com/prd/light-pos-tenants-users-roles-plan.html`
- Design: `https://dev.ahsanworks.com/prd/light-pos-tenants-users-roles-design.html`

→ skipped: API/schema renaming and a table dependency; add only when compatibility can be broken or datasets require server pagination.
