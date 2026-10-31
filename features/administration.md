# Administration

Use a tenant admin for one business and superadmin for portfolio-wide checks.

## 1. Portfolio and insights

1. Open **Portfolio**. Tenant admin sees **Tenant admin dashboard**; superadmin on All businesses sees **Business portfolio**.
2. Verify revenue, orders, comparison rows, period/freshness/coverage, and tenant names.
3. As superadmin switch business and verify the view scopes accordingly.
4. Open **Insights**; verify busiest/easiest times, favorite/least menu items, metric definitions, sample period, and small-sample warnings.

## 2. Menu catalog and immutable history

1. Open **Menu lab** / menu catalog and select **Add menu**.
2. Choose standard item or bundle; enter unique name, description, category, price, availability, and ingredient details.
3. For variations, add groups/options, mark required where needed, and set non-negative price deltas. Verify duplicate/blank group or option names are rejected.
4. For a bundle, choose at least two distinct current, non-archived standard items with positive whole-number quantities. Verify self-reference, duplicates, nested bundles, or archived components are rejected.
5. Save and verify the item appears in **Active**.
6. Repeat with **Create & add another**; confirm the first item persists, every field resets, and the dialog stays open.
7. Edit an item and save; open its history and verify a new version while previous versions remain visible.
8. Archive it through the confirmation dialog; verify it leaves Active, appears in Archived, and is unavailable in new orders while history remains.
9. Toggle availability and confirm Kitchen, Display, and ordering surfaces reflect the current state.

## 3. Experiments

1. Open **Experiments**, create one with a unique name and assumptions.
2. Edit draft menu values and daily targets.
3. Verify projected revenue and projected ingredient totals; missing/invalid ingredient quantities are called out.
4. Save as draft, activate it, and confirm only one experiment is active.
5. Verify current-session menu surfaces use the active draft.
6. Finalize only after review; verify menu versions are created and the experiment cannot be finalized twice.
7. Archive an obsolete experiment and confirm it no longer drives the session.

## 4. Order types

1. Open **Order types** and add a unique name.
2. Choose whether it is enabled and requires a table.
3. Verify blank/duplicate names are rejected.
4. Edit it and verify order entry updates.
5. Disable/archive it; verify it remains historically represented but cannot be selected for a new order.

## 5. Tables

1. Open **Tables**, add a unique table name and positive whole-number capacity.
2. Verify blank names, duplicate names, zero, negative, and decimal capacities are rejected.
3. Edit status/enabled state and verify **Seats** updates.
4. Archive and confirm it is unavailable for new orders without breaking historical order references.
5. Multi-select enabled tables during a table-required order; confirm unavailable tables remain visible but disabled.

## 6. Coupons

1. Open **Coupons** and add a unique uppercase code.
2. Select fixed or percent, enter a positive value and required reason, and save.
3. Verify duplicate code, missing reason, or non-positive value is rejected.
4. Toggle active state and verify order-entry eligibility changes.
5. Delete through the confirmation path and verify it no longer appears.

## 7. Targets and opening hours

1. Open **Targets & schedule**.
2. Edit a tenant revenue target; verify live progress updates and persists.
3. Edit opening/closing hours; refresh and verify persistence.
4. As tenant admin confirm only the assigned tenant is editable; as superadmin verify authorized tenant selection.

## 8. Staff and shifts

1. Open **Staff & shifts** and review directory/status analytics.
2. Create a shift with staff, date, start, end, and location.
3. Edit the shift and verify the row updates after refresh.
4. Confirm tenant users cannot see foreign staff or shifts.

## 9. SOP templates

1. Open **SOP templates** and create a title with newline-separated steps.
2. Publish/activate and verify managers can run the template.
3. Create a new version; verify the previous published version remains in history and completed records retain their version.
4. Archive a template and verify it is unavailable for new runs but historical completions remain.

## 10. Tenants

1. Sign in as superadmin and open **Tenants**; confirm tenant admins cannot see or open the page.
2. Quick-search by tenant name, ID, or location; filter enabled/disabled tenants and sort each column.
3. Add a tenant in the modal and verify it persists after refresh.
4. Edit its name/location; verify the tenant ID is immutable.
5. Disable it through confirmation; verify it remains listed but cannot be used for operational access.
6. Enable it and verify access is restored.

## 11. Users and roles

1. Open **Users & roles** for a selected tenant.
2. Search, filter by role/status, and sort the Users table; edit a user in the modal.
3. Open Roles, search/filter/sort the table, then create or edit a custom role in the modal.
4. Verify system roles remain protected and duplicating one creates an editable custom role.
5. Verify feature permission dependencies and limited menu scope still apply to assigned users.

## 12. Cross-role operational tools

Admin navigation also exposes New order, Orders, Seats, Shift & requests, Notes, Revenue, Expenses, Inventory & recipes, Profitability, and Run SOP & notes. Verify these using the cashier and manager guides, then verify tenant scope after every business switch.
