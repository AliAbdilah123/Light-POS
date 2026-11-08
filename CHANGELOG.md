# Changelog

## 2026-11-08

- Replaced shared system roles with superadmin-managed template roles that are copied into independent, editable tenant roles; migrated existing users to tenant-owned copies and added the superadmin Template Roles tab.

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
