# Changelog

## 2026-11-24 — Offline-first POS

- Added device-local authenticated session and tenant snapshots, a durable mutation outbox (compacted to one cumulative snapshot per user and tenant without changing the original revision guard), offline boot for a previously authenticated user, reconnect/manual sync status, and visible conflict handling. Logout purges the current user's cached data.
- Added authenticated, CSRF-protected, idempotent SQLite sync operations with revision conflict detection and session-owner revalidation before replay; stale full snapshots never overwrite server state, and discarded conflicts cannot be reapplied.
- Added a build-versioned, base-path-safe service worker and web manifest that cache the application shell and immutable assets (never API responses), and disabled online-only admin surfaces while offline.


## 2026-11-22 — Navigation follows assigned access profile

- Fixed users assigned an Admin, Manager, Kitchen, or Display access profile still seeing navigation for their stale legacy role. The active UI role now follows the session capabilities, while preserving Superadmin.
- Added regression coverage for an Admin profile assigned to a user whose legacy role remains Cashier.

- Grouped the role feature-permission checklist to match navigation and covered every app capability; moved Tenants into a Superadmin navigation group.

## 2026-11-22 — Logout route reset

- Sign out now replaces the current browser location with `/`, so the next user starts from their role dashboard instead of inheriting the previous user's page.
- Updated the public E2E login selector to distinguish the password input from its accessible show-password button.

## 2026-11-22 — Tablet sidebar logout visibility

- Fixed the navigation sheet height to follow the visible dynamic viewport, keeping **Sign out** reachable when browser chrome reduces the usable height on unfolded tablets.

## 2026-11-18 — Menu photos, expense-to-stock, inventory table, layout fixes

- Added a per-menu photo: tenant admins upload, replace, or remove a PNG/JPEG/WebP (max 2 MB) from the menu editor. Photos are stored in a new `menu_images` table keyed by menu id and tenant, served by `GET /api/menu-image` with `nosniff` and private caching, listed by `GET /api/menu-images`, and mutated only by admins with `manageCatalog` plus CSRF. Photos appear on catalog cards, order-entry tiles, and the display menu; the emoji icon remains the fallback.
- Added **Add these line items to inventory** to the expense form. Checked lines with a quantity and unit increase stock on hand (matching an existing ingredient by name, converting compatible units, otherwise creating the ingredient with a derived unit cost) and append a `receive` movement noted `Expense: <label>`. The form rejects the checkbox when no line has both a quantity and a unit.
- Added a **Stock on hand** table to **Inventory & recipes** listing every ingredient with on-hand quantity, reorder point, status, unit cost, stock value, and last movement, with search, sorting, and an **Open** action that selects the ingredient for the existing recipe/cost/receive panels.
- Fixed layout defects: checkboxes and radios no longer inherit the 38px text-input chrome (the **Hidden**/**Required** boxes rendered as tall bordered boxes); file inputs use a styled picker button; the seat detail card spaces its badge, order summary, primary action, and status select; the expense line editor uses one aligned header row with per-field labels on narrow screens and a separate total/action footer; the experiment draft prices and daily targets render as an aligned table instead of wrapping label pairs.
- Verified: typecheck, lint, 124 frontend tests, 26 backend tests, and browser checks at 1440px and 390px for the seat card, expense form, experiment dialog, menu photo upload, order/display photos, and the inventory table.

## 2026-11-18 — Sidebar and sign-in cleanup

- Removed the **Demo state** selector from the sidebar and deleted the now-unreachable demo-state feature: `StateBoundary`, the `demo`/`setDemo` store fields, the `DemoMode` type, and the loading/empty/error branches in the kitchen and display pages.
- Added a collapsible desktop sidebar: a toggle in the sidebar header switches between the 272px panel and a 76px icon rail, persists in `localStorage` (`pos-sidebar-collapsed`), and leaves the mobile sheet unchanged.
- Removed the **Demo accounts** block from the sign-in card.
- Replaced the **Show/Hide** text link with an eye icon inside the password field (`aria-label` and `aria-pressed` reflect the state).
- Added a shared `NumberInput` and converted every numeric field (menu price, ingredient and component quantities, variation price deltas, coupon value, revenue targets, table capacity, printer port, shift cash, experiment prices and targets, expense quantities and amounts, recipe portions, unit cost, stock receipts, cash received, imported menu prices). Values format live with `id-ID` grouping (`1.250.000`), keep the caret in place, accept a comma decimal separator where fractions apply, and submit the raw number through a hidden field so existing form parsing is unchanged.
- Verified: typecheck, lint, 121 frontend tests, and browser checks for grouping, decimals, caret placement, form reset, and persisted values.

## 2026-11-16 — Thermal receipt and kitchen printing

- Added tenant-scoped network thermal printer management at **Printers & printing** (`/admin/printers`): unique name, host/IP, TCP port, 58/80 mm paper width, enabled state, test tickets, edit, and removal. Tenant admins manage their own tenant; superadmins must select one business.
- Added per-tenant print routing so receipts and kitchen tickets can use the same or different printers. Automatic receipt printing defaults on; automatic kitchen ticket printing defaults off. Both are persisted server-side and auditable.
- Added ESC/POS rendering and direct TCP delivery from the server, with 32-column (58 mm) and 48-column (80 mm) layouts. Receipts include lines, variations, notes, totals, payment, and change; kitchen tickets omit prices and emphasise the order number.
- Checkout auto-prints the receipt and, when enabled, the kitchen ticket after the order is saved. Held → Preparing auto-prints the kitchen ticket when enabled. Manual **Print receipt**, **Print kitchen order**, and **Print ticket** actions were added to the payment dialog, Orders detail, and Kitchen detail.
- Added **Save receipt as JPG** to the payment-complete dialog and Orders detail. The browser renders an 80 mm receipt image with tenant, order, line details, totals, payment, and change, then downloads `receipt-<order>.jpg`.
- Added a per-tenant **Receipt header phrase** text area. The phrase is centered under the tenant name on printed and JPG receipts, preserves line breaks, and is limited to 500 characters.
- Added a **Receipt image demo** card to **Printers & printing** with a live sample receipt preview built from the current tenant's menu and header phrase and a **Download sample JPG** action.
- Added backend coverage for printer CRUD, tenant isolation, routing validation, test prints, automatic print defaults, disabled/missing printers, manual reprints, and the rendered ESC/POS payloads. Frontend coverage exercises printer setup, routing toggles, test prints, automatic checkout prints, manual copies, receipt row content, and the JPG actions.
- Verified: 25 backend tests, 118 frontend tests, lint, typecheck, and production build pass. The sample JPG was downloaded in a real browser and inspected as a valid 1152×1074 JPEG.

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

UX and feature audit fixes (branch `fix/ux-audit-critical-high`). Full report: `.artifacts/docs/ux-audit-2026-11-14.html`; before/after walkthrough: `.artifacts/docs/ux-before-after.mp4` (gitignored local artifacts).

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
