# Feature ledger — Light POS

Completion status: **all rows verified** on 2 September 2026. All identities, figures, payments, QR payloads, and operational records are fictional sample data. State persists in browser `localStorage`; **Reset demo data** restores fixtures. No backend was added.

| Requirement | Route / component | Implemented interaction | Verification evidence |
|---|---|---|---|
| Atomic design & Rail/Ledger | `styles.css`; `components/atoms`, `molecules`, `AppShell`; `OrderEntry` | Shared tokens and actual button/field/card/badge/progress/modal/status primitives; tablet category rail, product canvas, stable ledger | Build passed; tablet screenshot `screenshots/tablet-order.png` inspected |
| Role switcher & scoped navigation | Global `AppShell` | Cashier/manager/admin selection redirects and swaps route set; role synchronizes on deep links | RTL role workflow passed; Chromium cashier→manager→admin passed |
| Business switcher & aggregate | Global; `/admin/dashboard` | All-business aggregate and individual selection; admin defaults to all | Chromium screenshot inspected: 3 businesses, Rp54.050.000 aggregate |
| Seats / tables | `/seats` | Word/symbol/color statuses, selection, linked-order detail, persisted status mutation | Chromium route at 5 widths; zero overflow/errors |
| Global orders | `/orders`, `/orders/:id` | Business-aware search/filter/detail/status progression | Chromium route at 5 widths; lifecycle unit test passed |
| Header messages panel | Global `AppShell`; `/cashier/dashboard` | Mail trigger with persisted unread badge/count; accessible sender/text/time panel; mark read; close button/outside/Escape; exact “Show all messages” cashier-dashboard link | Focused RTL RED/GREEN workflow passed |
| Named orders | `/cashier/order`, `/orders` | Optional visible trimmed order name persists on paid/held/open orders, clears after save/payment, restores on resume, and appears in list/detail/search | Focused RTL RED/GREEN paid and held workflows passed |
| Open and resumable orders | `/cashier/order`, `/orders` | Dedicated unpaid Open save with no payment, local persistence, Orders status/filter support, safe lifecycle progression, and compact access to every Held/Open order | Focused RTL + domain RED/GREEN workflows passed |
| Cashier dashboard | `/cashier/dashboard` | Active/upcoming shifts, money/orders/hours, manager/admin messages with persisted read state | Chromium tablet/mobile screenshots inspected |
| Fast order entry | `/cashier/order` | Category/search/availability, add/quantity/remove, dine-in/takeaway/delivery, table, modifiers/notes, hold/resume | RTL rendered workflow and Chromium order workflow passed |
| Totals / cash / receipt / history | `/cashier/order`, `/orders` | Fixed calculation, 10% sample tax, cash completion, receipt, persisted order history | Calculation fixtures and rendered checkout test passed |
| Dynamic QRIS | `/cashier/order` | Unique mock intent, local QR graphic, countdown, pending → simulated provider success, receipt | Chromium success assertion + `tablet-qris-success.png` inspected |
| Coupons | `/admin/coupons`, `/cashier/order` | Create/delete/activate, unique code validation, fixed/percent value, reason incl. review incentive, apply and math | Coupon math tests; RTL create; Chromium create/application passed |
| Day notes | `/notes`, `/manager/sop` | Persisted add/edit/delete; manager handoff add/delete; destructive confirmation | Routes inspected and build/typecheck passed |
| Shift and leave requests | `/cashier/people` | Work/shift history; validated dated leave submission and status history | Route inspected at tablet; accessible validation implemented |
| Manager dashboard/revenue | `/manager/dashboard`, `/manager/revenue` | Messages/cashier summaries; daily/weekly/custom dates, freshness/definition/coverage | All routes loaded with headings and no console errors |
| Expenses | `/manager/expenses` | Persisted create/edit/delete with confirmation | Chromium created “Browser test expense” and verified it rendered |
| Ingredients/procurement/recipes | `/manager/inventory` | Editable kg purchase/cost and g recipe composition; normalized cost/portion and movement ledger | `unitConvert` tests pass incl. dimension rejection; `tablet-inventory.png` inspected |
| Required sugar case | `/manager/inventory` | Visible `1 kg × 1.000 = 1.000 g`; `100 g ÷ 1.000 g × Rp28.000 = Rp2.800/portion`; 10 portions | Chromium text assertion passed; screenshot inspected after clipping fix |
| Profitability / margin | `/manager/profitability` | Price, normalized cost, contribution margin and signals | Route loaded; tablet width check passed |
| Void & audit | `/orders`, `/manager/dashboard` | Manager/admin-only, reason-required void; original order retained with actor/time/reason audit | Status mutation/typecheck/build passed; cashier action hidden by role |
| Manager SOP | `/manager/sop` | Checklist progress, completion gate, reset, persisted completion history | Chromium checked every step, completed SOP, verified history text |
| Admin comparison/analytics | `/admin/dashboard`, `/admin/insights` | Cross-business comparison/freshness; busiest/easiest days/hours; favorite/least menu with definitions | Admin deep link role assertion and screenshot passed |
| Menu planning | `/admin/menu` | Loser/profitable/package classification; persisted planning notes and result selects | Route verified at all five widths |
| Targets / schedules | `/admin/operations` | Persisted target editing with live progress; opening/closing schedule editing | Route load/build/typecheck passed |
| Staff / shifts | `/admin/staff` | Directory analytics; persisted shift creation/edit/assignment | Route loaded with no page/console errors |
| SOP templates | `/admin/sop` | Create, prospective version increment, archive/publish | Route loaded with no page/console errors |
| Loading/empty/error/reset | Global demo selector, `StateBoundary`, reset control | Ready/loading skeleton/empty/error+retry; confirmed local reset | Rendered globally; reset is confirmation-guarded |
| Accessibility | Global | Semantic labels/errors/statuses, skip link, visible focus, 48px controls, reduced motion, status not color-only | RTL accessible-role queries passed; CSS inspection and Chromium interaction passed |
| Responsive / theme / assets | Global | Persistent light/dark, local SVG/iconography only, adaptive nav/stacking | Chromium measured `scrollWidth <= clientWidth` on 4 representative routes at 320/375/414/768/1024; screenshots inspected |
| Deep links / fallback | Router + `AppShell` | Direct route resolution synchronizes role; wildcard recovery | 19 direct routes checked; admin deep-link assertion passed |
| Domain and rendered tests | `domain.test.ts`, `App.test.tsx` | Reducer, totals, coupon, unit conversion, lifecycle; order/checkout, unavailable product, role, coupon workflows | `npm test`: 2 files, 10/10 tests passed |

## Final verification record

- `npm test` — PASS: 2 files, 10 tests.
- `npm run lint` — PASS: zero warnings/errors.
- `npm run typecheck` — PASS.
- `npm run build` — PASS: Vite 6.4.3, 1,601 modules, production bundle emitted.
- `node scripts/browser-check.mjs` against the launched Vite app — PASS: 19 routes, five required widths, nine captured workflow screenshots, zero page errors, console errors, or overflow findings.
- Browser workflows exercised: product/cart/coupon/QRIS success, manager expense creation, manager SOP completion/history, admin coupon creation, direct-role synchronization, and all route loads.

## Focused visual correction verification — 2 September 2026

- Mobile order: all five categories fit inside the 375 px rail (`scrollWidth = clientWidth = 355 px`; Kitchen right edge 357 px inside the 365 px rail edge). At narrower widths the same rail remains horizontally scrollable with a visible styled scrollbar. Available add affordances measure exactly 48 × 48 px. Banana loaf renders the full `Unavailable` status and has no plus affordance. The fixed cart dock sits 9 px above the viewport edge, reports item count and total, and exposes a 142 × 48 px `Review & pay` action that opens checkout.
- Manager inventory: the rendered result is exactly `= Rp 2.800/portion`, uses `white-space: nowrap`, and fits its 292 px content width without clipping. The complete conversion expression remains visible. The former green badge is now a non-interactive paragraph callout at 13.44 px with improved padding and line height.
- Admin portfolio: every status badge remains inside its card; all three subtitles render on one line. Revenue row tops are identical at 684.96875 px and progress row tops are identical at 739.25 px. Comparison copy renders at 13.76 px with higher contrast and line height. Tablet header controls remain fully visible.
- `node scripts/visual-correction-check.mjs` — PASS: 19 routes × 5 widths = 95 route-width checks at 320/375/414/768/1024 px; focused visual/interaction assertions passed; zero failures.
- `node scripts/browser-check.mjs` — PASS: 19 routes, five widths, nine workflow screenshots, zero page errors, console errors, or overflow findings.
- `npm test` — PASS: 2 files, 10/10 tests. `npm run lint` — PASS. `npm run typecheck` — PASS. `npm run build` — PASS: 1,601 modules transformed; production bundle emitted.
- Correction screenshots: `/tmp/capt4ce-e2e/correction-order-375.png`, `/tmp/capt4ce-e2e/correction-order-1024.png`, `/tmp/capt4ce-e2e/correction-inventory-375.png`, `/tmp/capt4ce-e2e/correction-inventory-1024.png`, `/tmp/capt4ce-e2e/correction-admin-375.png`, `/tmp/capt4ce-e2e/correction-admin-1024.png`.

## Consciously mock-only boundaries

- QRIS is a timed local simulation. There is no real QR payload, provider intent, webhook signing, settlement, or payment capture.
- Authorization is represented through frontend navigation/action visibility; it is not a server-side security boundary.
- Audit history demonstrates traceable UX but is not tamper-proof append-only storage.
- Inventory movements, insights, attendance, receipts, cash drawer, printing, schedules, concurrency, and offline reconciliation are illustrative local records. Production versions require backend services and the product-plan implementation gate.

## Ordered TDD verification — 12 September 2026

- Header messages RED: `npm test -- src/App.test.tsx -t "opens header messages"` — expected failure, missing “Messages (2 unread)” button. GREEN: same command — 1 passed.
- Order name RED: `npm test -- src/App.test.tsx -t "order name"` — expected failure, 2 tests missing the “Order name” field. GREEN: same command — 2 passed.
- Open orders RED: `npm test -- src/App.test.tsx src/domain.test.ts -t "open order"` — expected failures, missing “Open order” action and `nextStatus('Open')` returning `Open`. GREEN: same command — 2 passed.
- Final `npm test` — PASS: 2 files, 15 tests. `npm run lint` — PASS. `npm run typecheck` — PASS. `npm run build -- --base=/projects/light-pos/` — PASS: 1,601 modules transformed; production bundle emitted.
