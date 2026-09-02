# Tablet-first café / restaurant POS — product plan

> Status: planning and prototyping only. This document does **not** authorize production implementation. All example names, prices, sales, schedules, and operational metrics in the prototype are fictional sample data.

## 1. Product intent and scope

Create a tablet-first point-of-sale experience whose primary action is fast, accurate cashier order entry, while giving managers and administrators progressively broader operational visibility. The experience should be touch-first at 1024 × 768, usable on smaller responsive screens, and explicit about business, location, shift, and user context.

### Goals

- Complete a common dine-in or takeaway order with minimal navigation and recoverable mistakes.
- Keep shift cash, voids, discounts, notes, and handoffs auditable.
- Translate purchased inventory units into recipe-consumption units (for example, 1 kg sugar purchased and 100 g consumed by a recipe).
- Give managers useful period summaries and operating controls without distracting cashiers.
- Give administrators comparable cross-business insights without implying unsupported certainty.
- Establish an extensible base for Phase 2 dynamic QRIS payments and governed coupons.

### In scope

- Multi-business overview, seat availability, and order visibility.
- Cashier order entry, order management, shifts and money, messages, work hours, day notes, and leave requests.
- Manager revenue periods, messages, cashier summaries, inventory and recipe composition, unit conversion, voids with reasons, notes, and SOP checklists.
- Admin cross-business insights, busy/easy time analysis, favorite/least-favorite products, menu profitability and planning, packages, notes and results, targets, schedules, staff analytics, shifts, and SOP management.
- Tablet-first prototypes, responsive layouts, interaction states, accessibility requirements, and an implementation-ready backlog.

### Explicitly out of scope for this planning package

- Production code, hardware or fiscal-device integration, real payment capture, accounting/tax filing, payroll, supplier ordering, kitchen display systems, loyalty, reservations, delivery marketplaces, and offline synchronization.
- Predictive claims or benchmarks based on invented data. Prototype metrics are illustrative only.
- Phase 2 capabilities before the gate described below is passed.

## 2. Role and access model

Access is tenant-scoped and location-aware. A person may hold different roles in different businesses; every privileged action records actor, business, location, timestamp, and reason where required.

| Role | Default scope | Core abilities | Guardrails |
|---|---|---|---|
| General / owner view | Authorized businesses and locations | Aggregated multi-business dashboard, seat availability, orders | Aggregate by default; drill-down requires explicit business access |
| Cashier | Assigned business/location and active shift | Open/close shift, count money, enter and manage permitted orders, read/send messages, view work hours, day notes, leave requests | No cost/profit data; voids and discounts follow policy; cash drawer actions audited |
| Manager | Assigned business/location(s) | Revenue periods, messages, cashier summaries, inventory/recipes/conversions, void approval with reason, notes, SOP checklist | Cannot silently edit completed financial events; corrections append records |
| Admin | Authorized organization | Cross-business insight, menu profitability/planning/packages, targets, schedules, staff/shifts analytics, SOP management | Sensitive staff metrics minimized; comparisons include period and completeness context |

Principles: least privilege; deny by default; role checks enforced server-side; location switching is visible; step-up authentication for sensitive actions; append-only audit history for shifts, payments, voids, discounts, and inventory adjustments.

## 3. Information architecture

The order-entry workspace is the cashier home during an active shift. Global navigation changes by role, but business/location and shift status remain visible.

- **General:** Overview, Seats, Orders, Businesses.
- **Cashier:** Order entry, Orders, Shift & money, Messages, Work hours, Notes, Leave.
- **Manager:** Overview, Revenue, Orders, Cashiers, Inventory & recipes, Messages, SOP, Notes.
- **Admin:** Portfolio, Insights, Menu lab, Targets, Schedule, Staff, Shifts, SOP.

## 4. Key workflows

### A. Start, run, and close a cashier shift

1. Cashier selects the assigned location and verifies device/time context.
2. Cashier enters opening cash by denomination; system records expected and declared amounts.
3. Order entry unlocks. Status shows active shift, elapsed time, and held/open orders.
4. Cash movements require type, amount, and note; exceptions may require manager approval.
5. Close flow blocks or explains unresolved orders, captures closing count, computes variance, records cashier acknowledgement and manager review state.

Acceptance outcome: money events reconcile to the shift ledger; edits never overwrite history.

### B. Create and complete an order

1. Select service mode (dine-in/takeaway) and, for dine-in, an available seat/table.
2. Browse/search/filter menu; unavailable items are visible but not addable.
3. Add items, modifiers, quantities, and order/item notes; the order summary updates immediately.
4. Review taxes/service charges, total, fulfillment details, and validation issues.
5. Enter checkout state, choose an enabled tender, confirm amount, and finish or return safely.
6. System creates payment/receipt events and updates seat/order status atomically.

Acceptance outcome: every tap is idempotent where retries are possible; checkout cannot duplicate payment.

### C. Hold, resume, change, or void an order

1. Cashier holds an order with a recognizable label or table.
2. Authorized user resumes it from open orders.
3. Before payment, permitted changes update the order event history.
4. After submission/payment, void requires a controlled reason and note; policy determines manager approval.
5. Inventory and revenue effects are reversed through linked adjustment events.

Acceptance outcome: original line, reason, actor, approver, timestamps, and financial/inventory effects remain traceable.

### D. Seat availability

1. Floor/seat view distinguishes available, occupied, reserved/blocked (if configured), needs attention, and unavailable.
2. Selecting a seat reveals current order, party/elapsed metadata, and permitted actions.
3. Starting/closing/voiding the linked order updates availability.

Acceptance outcome: status is never communicated by color alone and stale state is visibly detected.

### E. Inventory recipe composition and conversion

1. Manager defines ingredient base unit and allowed purchase units with exact conversion factors.
2. Example: sugar base unit = gram; 1 kilogram purchase unit = 1,000 grams.
3. Recipe line consumes 100 grams; selling one recipe posts 100 grams of theoretical consumption.
4. Receiving, waste, counts, corrections, and void reversals produce separate stock movements.
5. Unit dimensions must match (mass cannot convert to volume without an explicit ingredient-specific density rule).

Acceptance outcome: quantities use decimal-safe arithmetic; conversion source, precision, rounding, and effective dates are recorded.

### F. SOP checklist

1. Admin versions a reusable SOP template; manager assigns it to a location/shift/window.
2. Staff complete steps with notes/evidence only when configured.
3. Required, overdue, skipped, and exception states are visible.
4. Published versions remain immutable; a new version applies prospectively.

Acceptance outcome: completion records identify template version, actor, time, and exception reason.

### G. Insights and planning

1. User selects businesses, locations, and a comparison period.
2. Dashboard presents revenue/order measures with data freshness, coverage, and definitions.
3. Busy/easy times, favorites, least favorites, profitability, staff, target, package, and menu views support drill-down.
4. Menu planning changes remain drafts until reviewed and published.

Acceptance outcome: incomplete periods and small samples are flagged; insights do not present correlation as causation.

### H. Phase 2 QRIS and coupon flow

1. At checkout, backend requests a unique dynamic QRIS payment intent for the exact order amount.
2. UI displays QR, expiry, and pending state; authoritative provider confirmation completes payment.
3. Timeout/cancel/retry preserve a single order/payment intent relationship and support reconciliation.
4. Coupon entry validates code, business/location, time, eligible items, limits, stackability, and user authorization.
5. Manual discount/coupon exceptions require a standardized reason and optional manager approval.

Acceptance outcome: screenshots or client-side callbacks cannot mark payment paid; codes and reasons are auditable without exposing secrets.

## 5. Conceptual data model

All primary records include `id`, tenant/business scope as applicable, timestamps, actor/source, and version metadata. Financial and stock quantities use fixed-precision decimals, never binary floats.

| Domain | Main entities and relationships |
|---|---|
| Identity & tenancy | Organization → Business → Location; User ↔ RoleAssignment (role, business/location scope, effective dates); DeviceSession |
| Seating | Location → Area → Seat/Table; SeatingStatusEvent; Order optionally links to Seat/Table |
| Catalog | Menu → Category → MenuItem; ModifierGroup/Option; Price; AvailabilityWindow; Tax/ChargeRule; Package/Bundle |
| Orders | Order → OrderLine → modifier selections; OrderNote; ServiceMode; OrderStatusEvent; Hold; Receipt |
| Payments | PaymentIntent → PaymentAttempt → PaymentEvent; Tender; Refund; CashMovement; all linked to Order and Shift |
| Shifts & staff | Shift → Opening/ClosingCount; WorkSession; Schedule; LeaveRequest; StaffMessage; DayNote |
| Controls | VoidRequest (reason, note, approver) → reversal events; Discount/CouponApplication; AuditEvent |
| Inventory | Ingredient (base unit) → PurchaseUnitConversion; Recipe → RecipeLine; StockLocation; StockMovement; Count; Waste; SupplierItem |
| SOP | SOPTemplate → immutable SOPVersion → Step; Assignment → Completion/Exception |
| Planning & insight | Target; MenuPlan; PlanNote; PlanResult; MetricDefinition; AggregateSnapshot with period/freshness/coverage |
| Phase 2 | QRISPaymentIntent (provider reference, amount, expiry, status); Coupon (hashed/code reference, rules, limits); CouponRedemption |

Key invariants:

- An order belongs to exactly one business/location and at most one active shift context.
- Completed payment totals must equal the amount due or follow an explicit split/partial-payment policy.
- A void links to the event it reverses; reversal and original are retained.
- Recipe units convert to an ingredient base unit before posting stock movements.
- Published menu prices, SOPs, and conversion factors are versioned with effective dates.
- Aggregates are reproducible from defined source events and show their last refresh.

## 6. Phased implementation plan

### Phase 0 — discovery, controls, and prototype validation

- Confirm service modes, taxes/charges, receipt requirements, currencies, cash policy, and device/hardware assumptions.
- Map role permissions and approval thresholds with real operators.
- Test the nine prototype directions on 1024 × 768 tablets and narrow phone widths; select one direction.
- Define metric glossary, event/audit model, retention, backup, privacy, and accessibility targets.
- Produce architecture, threat model, offline decision, integration contracts, and migration approach.

### Phase 1A — transaction foundation

- Tenancy, identity, scoped roles, location/device/shift context.
- Catalog, availability, order entry, modifiers/notes, seat link, hold/resume, totals, cash tender, receipts.
- Shift opening/closing, cash movements, order list, controlled void and audit events.
- Messages, day notes, work hours, leave-request basics.

### Phase 1B — operations and management

- Revenue period views and cashier/shift summaries.
- Ingredient, recipe, purchase-unit conversion, receiving/count/waste, theoretical usage and void reversals.
- SOP template/version/assignment/completion workflow.
- General multi-business overview and seat visualization.

### Phase 1C — administration and planning

- Cross-business insight with freshness/coverage labels.
- Busy/easy periods, favorite/least-favorite items, profitability and menu planning/package workflow.
- Targets, schedules, staff analytics, shift oversight, SOP management, notes/results.

### Phase 2 — governed growth features

- Dynamic QRIS payment intent, expiry, webhook verification, reconciliation, refund/failure handling.
- Coupon lifecycle, eligibility, limits, stacking, standardized code/reason handling, approval and redemption audit.
- Roll out behind business/location feature flags after provider sandbox, security, and reconciliation tests pass.

## 7. Feature-group task backlog

| Feature group | Discovery / design | Build tasks | Verification |
|---|---|---|---|
| Platform & roles | Permission matrix; location switching; retention | Tenant boundaries, role middleware, sessions, audit service | Cross-tenant tests; privilege escalation tests; audit completeness |
| Order entry | Observe cashiers; define service/charge rules | Catalog query, cart state, modifiers, notes, totals, hold/resume, idempotency | Task usability; total fixtures; retry/concurrency tests |
| Seats & orders | Define state vocabulary and floor model | Seat events, floor view, order link, stale-state handling | Color-independent states; simultaneous claim tests |
| Shifts & money | Cash policy, denominations, approvals | Counts, cash movements, variance, close blockers | Ledger reconciliation; append-only corrections |
| Cashier support | Message/notes boundaries; leave policy | Inbox, day notes, hours, leave request/status | Privacy/visibility tests; notification fallback |
| Manager reporting | Metric definitions and periods | Revenue and cashier summaries, export policy | Source reconciliation; timezone/period edge cases |
| Inventory & recipes | Units, precision, density rules, costing | Ingredient/unit model, conversions, recipes, movements, counts/waste | 1 kg → 1,000 g fixtures; rounding; reversal tests |
| Voids & discounts | Reason taxonomy, thresholds, approvals | Request/approve/reverse events, reason UI, audit views | Unauthorized/duplicate/partial void tests |
| SOP | Versioning and evidence rules | Template editor, publish, assignment, completion, exceptions | Immutable published versions; offline/time tests |
| Admin insights | Glossary, cohort/privacy rules | Aggregates, comparisons, favorites, profitability, targets/staff views | Freshness/coverage; small-sample and access tests |
| Menu planning | Draft/review/publish lifecycle | Plans, packages, notes, results, effective-dated publish | Price/package conflict and rollback tests |
| Phase 2 QRIS | Provider and settlement contract | Payment intent, QR, webhook, expiry, retry, reconciliation | Signature/replay tests; sandbox end-to-end; outage recovery |
| Phase 2 coupons | Rule and abuse model | Codes, validation, limits, stacking, redemption/reversal | Race/limit tests; audit; enumeration resistance |
| Quality & operations | SLOs, supported devices, recovery objectives | Observability, backup/restore, feature flags, runbooks | Accessibility, load, security, restore and incident drills |

## 8. Cross-cutting acceptance criteria

### Usability and responsive behavior

- Common cashier order can be completed without leaving the order workspace.
- All primary touch targets are at least 48 × 48 CSS pixels at 1024 × 768.
- No horizontal page overflow at 320, 375, 414, 768, or 1024 pixels; content reflows and the order summary stays reachable.
- Keyboard operation follows logical DOM order; visible `:focus-visible` is present; checkout state announces material changes.
- Status, availability, and errors do not rely on color alone; light and dark themes retain readable contrast.
- Reduced-motion preference removes nonessential animation.

### Correctness and resilience

- Order totals, taxes, charges, discounts, refunds, and conversions use deterministic fixed-precision rules with test fixtures.
- Duplicate taps, network retries, and provider callbacks cannot create duplicate orders or payments.
- Concurrent seat/order/inventory changes surface a conflict rather than silently overwrite.
- Time is stored in UTC with business timezone retained for periods; daylight-saving boundaries are tested where relevant.
- Offline behavior is explicitly decided before build; the UI never implies that an unconfirmed payment succeeded.

### Security, privacy, and audit

- Server-side authorization is tested at tenant, business, location, role, and action levels.
- Sensitive secrets/payment credentials never reach logs or the client; transport and stored sensitive data are protected.
- Financial, void, discount, shift, stock, role, menu publish, and SOP publish actions produce queryable audit events.
- Staff analytics expose only necessary data and follow an agreed retention/access policy.

### Reporting integrity

- Every metric has a definition, timezone, source events, exclusions, refresh time, and coverage indicator.
- Revenue and tender reports reconcile to order/payment/shift sources for representative fixtures.
- Sample, incomplete, and unavailable states are visually distinct from live verified results.

## 9. Risks and mitigations

| Risk | Consequence | Mitigation / decision needed |
|---|---|---|
| Ambiguous tax/service rules | Incorrect totals and receipts | Confirm jurisdiction and inclusive/exclusive rules before schema freeze |
| Weak offline definition | Duplicate/lost orders or misleading payments | Decide offline scope; use durable queues/idempotency; never offline-confirm QRIS |
| Inventory unit errors | Incorrect stock and margin | Dimension-safe base units, decimal precision, effective dates, conversion fixtures |
| Cross-business data leakage | Privacy and commercial harm | Scoped roles, tenant isolation tests, aggregate-first views, audit access |
| Metric misinterpretation | Bad staffing/menu decisions | Glossary, coverage/freshness labels, minimum sample thresholds |
| Cash/void abuse | Financial loss | Reason taxonomy, approval thresholds, append-only audit, exception review |
| Tablet congestion | Slower, error-prone ordering | Field usability tests; 48 px targets; adaptive summary; selected design direction |
| QRIS provider delay/outage | Checkout blockage or double collection | Expiry/retry/reconciliation states, signed callbacks, operational fallback |
| Coupon abuse/races | Margin leakage | Atomic redemption limits, enumeration resistance, approval and reversal audit |
| Scope breadth | Delayed usable core | Phase by transaction value; gate admin breadth behind cashier foundation |

## 10. Open questions

1. Which countries, currencies, taxes, service charges, receipt/fiscal rules, and QRIS provider/acquirer apply?
2. Is dine-in modeled by table, seat, tab, guest count, or a combination? Are reservations required later?
3. Which tenders and split/partial/tip/refund flows are required in Phase 1?
4. Which printer, cash drawer, scanner, and customer-display hardware must be supported?
5. Must order entry work offline? If yes, for how long and which actions remain prohibited?
6. What void/discount thresholds require manager approval, and may managers self-approve?
7. How are ingredient yield, waste, density, substitutions, recipe versions, and cost layers treated?
8. What defines revenue, favorites, profitability, busiest/easiest periods, and staff performance?
9. What staff data may administrators see, for how long, and in which jurisdictions?
10. Are schedules/payroll integrations needed, or is schedule planning standalone?
11. Which messaging channels and notification expectations apply?
12. What are the availability, recovery, backup, support, and data-export expectations?

## 11. Explicit implementation gate

**GATE: DO NOT BEGIN PRODUCTION IMPLEMENTATION OR CONNECT REAL BUSINESS, STAFF, INVENTORY, OR PAYMENT DATA until an accountable product owner, operations lead, security/privacy reviewer, and technical lead have signed off the Phase 0 decision record.**

The record must contain:

- chosen prototype direction and documented cashier/manager usability findings;
- approved scope and role/permission matrix;
- jurisdictional tax, receipt, labor/privacy, cash, void, refund, and discount rules;
- authoritative metric glossary and sample-data labeling standard;
- validated order/payment/shift/inventory event model and unit/rounding policy;
- offline, concurrency, idempotency, device/hardware, QRIS, and integration decisions;
- threat model, audit/retention plan, accessibility review, test strategy, rollout/rollback plan, and operational ownership;
- Phase 1 acceptance baseline and a separately approved Phase 2 provider/security/reconciliation gate.

Passing this planning review only authorizes further design validation. Any unresolved high-impact question keeps the production gate closed.

## 12. Design recommendation

Start usability testing with **Rail & Ledger**, the recommended direction in the design comparison: persistent category rail, broad menu canvas, and stable order ledger make system state visible and efficient on a tablet. Test it against **Counterflow** for speed and **Service Bell** for lower training burden. Select the production direction only after representative cashiers can complete create/edit/hold/checkout recovery tasks, and managers can complete void and inventory conversion tasks, with recorded error rates and qualitative feedback.

Related prototypes: [interactive plan](./pos-app-plan.html) · [nine design options](./pos-design-options.html)
