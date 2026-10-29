# Kitchen and customer display

## Kitchen dashboard

**Flow**
1. Sign in as a kitchen user; confirm the **Kitchen** heading.
2. Review **Preparing orders**, oldest first, with order ID, elapsed age, service/table context, and line quantities.
3. Select an order to inspect details.
4. Advance it to ready using the available action; verify it leaves the preparing queue and its shared order status becomes **Ready**.
5. Change menu availability using the kitchen control where offered; confirm ordering and display surfaces update.

**UI verification**
- Confirm only the assigned tenant's menu/order markers appear.
- Confirm no cashier, financial, catalog-edit, or admin navigation is visible.
- With **Demo state → Loading**, verify **Loading kitchen**; with **Error**, verify the retry/error explanation; restore Ready.
- Directly visit `/admin/menu` and confirm **Access unavailable**.

## Customer menu display

**Flow**
1. Sign in as a display user; confirm **Menu display**.
2. Verify current-session item name, category, price, description, and written availability (**Available**, **Low**, or sold-out state).
3. If an experiment is active, verify its session menu is displayed.

**UI verification**
- Confirm the main menu is read-only: no product action buttons, editing controls, checkout, financial data, or private operations.
- Confirm only the assigned tenant's marker appears.
- Test Loading and Error demo states and restore Ready.
- Check phone/tablet layouts for readable cards and no horizontal page overflow.
- Directly visit `/admin/menu` and confirm **Access unavailable**.

## Cross-surface availability scenario

1. In one session sign in as kitchen for a tenant; in another sign in as cashier for the same tenant; optionally use a third display session.
2. Change a menu item to low/sold out in Kitchen.
3. Refresh the cashier and display sessions.
4. Verify the same written availability appears everywhere and sold-out items cannot be added.
5. Restore availability and confirm the add action returns.
