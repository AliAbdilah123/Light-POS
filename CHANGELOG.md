# Changelog

## 2026-10-31

- Added a superadmin-only Tenants page for creating, editing, disabling, and enabling tenants.
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
