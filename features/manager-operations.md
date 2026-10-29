# Manager operations

Use a manager account for its assigned tenant. Admins can also access these routes.

## 1. Overview and revenue

1. Open **Overview** and verify revenue pulse, average order, active cashier, coverage/freshness, and team messages.
2. Open **Revenue**.
3. Switch **Daily**, **Weekly**, and **Custom**; for Custom, set From and To dates.
4. Confirm chart/summary context changes and definitions, period, freshness, and coverage remain visible.
5. Cross-check representative completed orders in **Orders**; treat displayed values as sample metrics unless explicitly derived.

## 2. Expenses and receipt prefill

1. Open **Expenses** and choose the add action.
2. Enter date, category/label, and required line-item descriptions and amounts.
3. Add/remove lines; verify the total is computed from lines rather than entered independently.
4. Submit an incomplete line and confirm validation prevents saving.
5. Save; verify the expense row and computed total.
6. Expand the row to inspect line details; edit a line and verify total changes.
7. Delete and confirm the destructive prompt.
8. If receipt parsing is configured, upload an accepted receipt, review the same-origin prefilled fields, correct them, then save. If unavailable, verify a clear non-destructive error and manual entry remains usable.

## 3. Inventory and recipe conversion

1. Open **Inventory & recipes**.
2. Locate Sugar and set purchase quantity to `1` kg and cost to `28000`.
3. Set recipe consumption to `100` g.
4. Verify `1 kg × 1.000 = 1.000 g`.
5. Verify `100 g ÷ 1.000 g × Rp28.000 = Rp2.800/portion` and 10 portions.
6. Change values and verify conversion and cost update.
7. Confirm incompatible mass/volume conversion is rejected rather than silently calculated.
8. Review movement/stock records and low/reorder status where presented.

## 4. Menu profitability

1. Open **Profitability**.
2. Verify each row shows menu, sales price, normalized recipe cost, margin, and a textual signal such as **Healthy**, **Watch**, or **Low**.
3. Change tenant where authorized and verify products change without cross-tenant leakage.
4. Compare a sample row manually: `(price − cost) ÷ price × 100`.

## 5. SOP execution and handoff notes

1. Open **SOP & notes**.
2. Check individual steps and verify progress updates.
3. Confirm completion is unavailable until every required step is checked.
4. Enter an optional handoff note and save; verify it appears in shared notes.
5. Complete the SOP and verify history records template title/version, actor, and time.
6. Refresh and verify completion history persists while the current checklist resets appropriately.
7. Use reset during an incomplete run and verify progress clears without creating history.

## 6. Orders and seats

Managers share the order lifecycle and table flows in [cashier-and-orders.md](cashier-and-orders.md), including reason-required voiding. Verify cashier-only New order navigation is absent for a manager.
