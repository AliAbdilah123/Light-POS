# Changelog

## 2026-10-28

- Added `features/` with an implementation-backed product map and detailed manual UI verification flows for shared platform behavior, cashier/order/seating, manager operations, administration, kitchen, and customer display.
- Re-ran the public role/tenant E2E suite against `https://dev-light-pos.ahsanworks.com/`; all 17 seeded identities passed.

## 2026-10-11

- Fixed order-entry product cards so they fill their grid columns at laptop widths.
- Removed duplicate service-mode tabs from Current order, added direct admin/superadmin seat-management access, and compacted oversized header, catalog-card, and menu-form controls.
