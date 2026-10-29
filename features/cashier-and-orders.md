# Cashier, orders, and seating

## 1. Cashier dashboard

1. Sign in as a cashier; confirm a **Welcome, …** heading.
2. Verify orders served, open-order count, cash in drawer, shift timing, and updates/messages.
3. Open the messages panel and mark an eligible message read.
4. Verify the unread count changes and survives refresh.

## 2. Create and customize an order

1. Open **New order**.
2. Choose an order/service type. If it requires tables, select one or more enabled available tables.
3. Browse the category rail or search the menu.
4. Confirm sold-out/unavailable items stay visible but cannot be added.
5. Select an available product.
6. If the customization dialog opens, choose every required variation, optional variations, quantity, and item note; submit it.
7. Add another product. Use `+`/`−` in the ledger to change quantity; remove by reducing to zero.
8. Select a ledger line to edit variations, quantity, or notes; save and confirm the line price reflects variation surcharges.
9. Enter an optional order name and confirm surrounding whitespace is trimmed when saved.
10. Verify subtotal, coupon discount when present, 10% sample tax, and total update immediately.

## 3. Hold, resume, and protect work in progress

1. Build a non-empty order and select **Hold order**.
2. Confirm the cart clears and the held-order count appears near the page heading.
3. Open held orders and select the saved order.
4. If another cart is active, confirm **Replace current order?** appears; cancel once and verify the current cart remains, then repeat and choose **Replace order**.
5. Confirm all lines, variations, notes, service type, tables, coupon, and order name are restored.

## 4. Checkout with cash

1. Build a valid order and select **Review & pay**.
2. In **Checkout**, verify amount due and fulfillment information.
3. Choose **Cash**.
4. Confirm **Payment complete**, receipt/order identifier, and **Payment recorded and table released**.
5. Select **Start next order** and verify a clean cart.
6. Open **Orders** and verify the completed order, payment method, lines, totals, and tenant.

## 5. Checkout with sample QRIS

1. From checkout choose **QRIS**.
2. Confirm the dialog is explicitly labeled **Dynamic QRIS · sample**, shows a mock QR, exact amount, intent, countdown, and **Awaiting confirmation**.
3. Wait for the simulation; confirm **Payment confirmed** appears.
4. Close the flow and verify the paid order appears in **Orders**.

This is a local/provider simulation; it is not evidence of real QR generation, webhook validation, or settlement.

## 6. Coupons

1. Ask an admin to create and activate a uniquely named coupon in **Coupons**.
2. Return to order entry and enter/select the code.
3. Confirm fixed or percentage discount appears, never exceeds subtotal, and tax is calculated after discount.
4. Disable the coupon as admin; verify it can no longer be newly applied.

## 7. Orders and lifecycle

1. Open **Orders**.
2. Search by order ID or menu item; verify results narrow correctly.
3. Filter by status and business where authorized.
4. Open an order; verify service type/table, line details, subtotal, discount, tax, total, payment, and timestamps.
5. For an active order, use the available status action and verify progression **Held → Preparing → Ready → Completed**.
6. As manager/admin, choose void, enter a required reason, and confirm. Verify **Voided** plus actor/time/reason audit details and retained original values.
7. As cashier, confirm the privileged void action is absent.

## 8. Table availability

1. Open **Seats** and select a table card.
2. Verify name, capacity, written status, and linked-order details when occupied.
3. Change status using the available control and confirm the card updates.
4. Start a dine-in order on an available table; verify it becomes occupied.
5. Complete payment; verify the table is released.
6. Confirm unavailable/archived tables cannot be selected for a new order.
7. Admins can follow **Manage tables** for configuration.

## 9. Shift history and leave request

1. Open **Shift & requests**.
2. Verify work/shift history.
3. Start a leave request; enter type, start date, end date, and reason.
4. Submit with missing data and verify an error.
5. Set end before start and verify **End date must be on or after start date.**
6. Correct it, submit, and verify a **Pending** request appears and persists after refresh.

## 10. Day notes

1. Open **Notes**, choose the add action, enter a unique handoff note, and save.
2. Edit the note; refresh and confirm persistence.
3. Delete it and confirm the destructive prompt before removal.
