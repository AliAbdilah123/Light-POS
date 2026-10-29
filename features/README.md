# Light POS feature and UI verification guide

This directory documents the implemented product by user-visible workflow. It is a manual UI acceptance guide, not a roadmap.

## Test environment

- Public app: <https://dev-light-pos.ahsanworks.com/>
- Use the development accounts listed in [`../TEST_CREDENTIALS.md`](../TEST_CREDENTIALS.md).
- Test each role in a separate signed-out browser session. Use fictional data only.
- Select **Demo state → Ready** unless a scenario explicitly tests loading, empty, or error behavior.
- State is tenant-scoped and persisted by the backend. Avoid deleting shared fixtures; use uniquely named test records.

> Historical documents may mention `/projects/light-pos/`; that route currently returns 404. The root-mounted host above is the verified public UI.

## Product map

| Area | Primary role | Route/navigation | Detailed guide |
|---|---|---|---|
| Authentication, tenant scope, shell, messages, themes, failure states | All | Sign-in and global shell | [Shared platform](shared-platform.md) |
| Order entry, checkout, open/held orders, seats, requests, notes | Cashier; also admin where allowed | Dashboard, New order, Orders, Seats, Shift & requests, Notes | [Cashier and orders](cashier-and-orders.md) |
| Revenue, expenses, inventory, profitability, SOP | Manager; also admin | Manager navigation | [Manager operations](manager-operations.md) |
| Portfolio, catalog, experiments, coupons, targets, staff, SOP templates | Admin/superadmin | Admin navigation | [Administration](administration.md) |
| Preparing queue and read-only customer menu | Kitchen/display | Single-purpose dashboards | [Kitchen and display](kitchen-and-display.md) |

## Role boundaries

- **Cashier:** order workflow, shared orders/seats, own shift/request information, and day notes.
- **Manager:** operational reporting, orders/seats, expenses, inventory/recipes, profitability, and SOP execution.
- **Admin:** tenant-wide access to cashier and manager tools plus catalog and administration.
- **Superadmin:** admin tools across all businesses; may select **All businesses**.
- **Kitchen:** preparation queue and menu availability controls only.
- **Display:** read-only menu and availability only.

## End-to-end smoke sequence

1. Sign in as each role and confirm the expected landing heading.
2. Confirm the **Business** selector contains only authorized tenants.
3. Open every visible navigation item and confirm the page heading, data, and no error state.
4. Run the role-specific critical flow from its detailed guide.
5. At phone width, open navigation, select a route, reopen it, and sign out.
6. Attempt `/admin/menu` as a non-admin and confirm **Access unavailable**.

## Verification record

On 28 October 2026, `POS_E2E_URL=https://dev-light-pos.ahsanworks.com/ npm run test:e2e:public` passed all 17 seeded identities: superadmin, five roles for each of Harbor/Garden/North, and the multi-business manager. It verified login, landing pages, tenant markers, role restrictions, business switching, representative role interactions, mobile navigation, logout, and absence of browser/HTTP errors.
