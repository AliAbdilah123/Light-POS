# Changelog

## 2026-11-16

Membership-app visual experiment (branch `experiment/membership-style`). Same markup, routes, and behavior; only the theme layer and component styling change.

- Palette now mirrors `membership-app`: cool near-white surfaces (`oklch` tokens), indigo/violet primary, indigo-tinted hover/active states, and a matching dark theme. Light is the default theme; the toggle still persists to `pos-theme`.
- Radius/controls retuned to the reference: 12px cards, 8px buttons and inputs, 38px control height, subtle `shadow-sm`, 6px pill-free badges, and 2px focus rings.
- Shell restyled: gradient indigo→violet brand marks, white sidebar with rounded nav rows and tinted active state, ghost topbar icon buttons, and indigo auth page backdrop.
- Added a Tailwind `@theme inline` bridge so the shared `components/ui/*` primitives resolve `bg-primary`, `bg-card`, `bg-muted`, `border-input`, `ring-ring`, etc. from the same tokens as the hand-written CSS.
- Tables, modals, product tiles, order ledger, payment options, seats, charts, and empty states rethemed to the same neutral/indigo language.
- Verified in the browser in light and dark at desktop and 390px; 115 frontend tests, lint, typecheck, and production build pass.

## 2026-11-15

Whole-UI refactor (branch `refactor/ui-overhaul`). Same React/Vite/Tailwind/Radix stack; no route, capability, or data-contract changes.

- New design system in `src/styles.css`: calmer dark/light palettes, 16px card radius, 42px controls, consistent spacing, sticky topbar, full-height sidebar, and responsive breakpoints at 1280/1100/900/600px.
- Shell: brand moved into the sidebar, topbar now shows the current section and page, navigation grouped with icons and a scrollable rail, tenant switcher and account card consolidated, and a compact mobile drawer with a topbar brand.
- Shared primitives: `PageHead` actions, `Metric` icons, `SectionTitle`, `StatusRow`, `Modal`, `FormActions`, plus new `PageSection`/`Toolbar`; `DataTable` gained a sticky header, empty state, and live result count.
- Pages reordered around the operator's task: dashboards lead with metrics and quick actions, order entry keeps the category rail/product canvas/ledger with a clearer table picker and cart, orders and seats lead with status summaries, and admin pages use consistent toolbars and card grids.
- Fixed the aggregate superadmin view of Targets & opening hours: it now asks for a single business instead of rendering prefixed schedule keys.
- Tests: 115 frontend tests pass; typecheck and production build pass.

## 2026-11-14

UX and feature audit fixes (branch `fix/ux-audit-critical-high`). Full report: `docs/ux-audit-2026-11-14.html`; before/after walkthrough: `docs/ux-before-after.mp4`.

- Fixed duplicate state writes: `update()` no longer performs its `fetch` inside the `setData` updater, so React StrictMode no longer double-invokes it. Every mutation now sends exactly one `PUT`, and a rejected write keeps its error visible instead of being cleared by the recovery reload.
- Order entry: required variation groups default to their first option and a missing group names itself; the table field is marked required with an inline reason when it blocks Hold/Review & pay; the native multi-select is replaced by a table chip grid; the ledger gains a clear-order action.
- Layout: the three-pane order workspace is kept down to 800px (previously 1100px) and the mobile cart dock is actually displayed; sidebar nav rows no longer stretch to fill the column.
- Data honesty: manager dashboard, revenue periods, admin dashboard, insights, staff metrics and cashier dashboard now derive from stored records instead of literals; the selected business persists across reloads.
- Inline editors: revenue targets and opening hours use a local draft committed on blur, with no-op writes skipped.
- Accessibility: `Progress` renders a single named progressbar; read messages and unavailable tables meet contrast. axe serious/critical is now zero on the audited pages.
- Leave requests: new `approveLeave` capability with `/manager/requests` and `/admin/requests` approval queues, plus withdraw for the requester.
- Seats: the table panel shows the real linked order and can start an order with that table preselected.
- Experiments: activate, finalize and archive confirm in the shared modal; zero-quantity projections are hidden.
- Replaced every native `confirm()`/`prompt()` with the shared modal; grouped the admin navigation; added a password visibility toggle and demo-account hint; the display role now renders a kiosk layout with a 60-second refresh.
- Tests: 112 frontend and 21 backend tests pass; lint, typecheck and production build pass.

## 2026-11-08

- Replaced shared system roles with superadmin-managed template roles that are copied into independent, editable tenant roles; migrated existing users to tenant-owned copies and added the superadmin Template Roles tab.
- Kept tenant role edit actions visible on mobile and routed superadmin template-role edits through the template API with an immediate refresh.

## 2026-10-31

- Added tenant-scoped bulk menu import from up to five validated photos through backend-only Hermes extraction, editable review drafts, and explicit atomic menu creation.
- Added a reusable accessible DataTable with quick search, caller-defined filters and sorting, bulk selection/actions, and infinite-scroll pagination; migrated tenant, user, and role administration to it.
- Added tenant-scoped static payment QR upload/removal for Admin and selected-tenant Superadmin, with authenticated cashier display and fail-closed QRIS checkout when no QR is configured. Images are limited to PNG/JPEG/WebP at 2 MB and validated server-side; provider payment verification remains out of scope.
- Added a "Create user" button and modal dialog to the Users administration page.
- Added a superadmin-only Tenants page for creating, editing, disabling, and enabling tenants.
- Made the top business selector use the live tenant list and refresh immediately after tenant changes.
- Renamed Access Profiles to Roles in the UI, moved user and role forms into accessible modals, and added searchable, filterable, sortable Users and Roles tables.

## 2026-10-30

- Added protected system and tenant-owned custom Access Profiles with separate view/edit administration permissions, one-profile user assignment, capability and menu scope enforcement, and a Users & access UI.
- Migrated existing role accounts to equivalent system profiles so current behavior remains unchanged.

## 2026-10-28

- Added `features/` with an implementation-backed product map and detailed manual UI verification flows for shared platform behavior, cashier/order/seating, manager operations, administration, kitchen, and customer display.
- Re-ran the public role/tenant E2E suite against `https://dev-light-pos.ahsanworks.com/`; all 17 seeded identities passed.

## 2026-10-11

- Fixed order-entry product cards so they fill their grid columns at laptop widths.
- Removed duplicate service-mode tabs from Current order, added direct admin/superadmin seat-management access, and compacted oversized header, catalog-card, and menu-form controls.
## 2026-11-02

- Moved the signed-in user and searchable tenant selector into the sidebar for faster workspace switching.
- Removed the obsolete atoms compatibility module; shared and page controls now consume shadcn/ui components directly while retaining required responsive layout hooks.
- Migrated page-level buttons, inputs, selects, cards, badges, and progress controls from compatibility imports to direct shadcn/ui components while preserving existing form labels, variants, layout hooks, and accessibility.
- Migrated responsive application navigation to the shadcn Sheet primitive while preserving desktop navigation, role-scoped links, focus management, and sign-out behavior.
- Fixed photo menu parsing to use the OpenAI-compatible chat/vision contract, parse chat-completion and SSE responses safely, and route extraction through the Hermes vision-capable model.
- Fixed global superadmins receiving “Business access denied” when selecting newly created tenants such as Lalala Cafe.
# 2026-11-03

- Fixed mobile alignment for admin filters, result counts, user forms, checkboxes, and tables.
- Removed frontend sample-state controls and frontend tenant fixture initialization; tenant labels now load from the API for authorized users.
- Kept tenant-admin role creation and editing backed by tenant-scoped access-profile APIs.
