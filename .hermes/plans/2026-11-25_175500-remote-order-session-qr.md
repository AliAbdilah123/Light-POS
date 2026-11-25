# Remote Table Ordering (QR Sessions) — Implementation Plan

**Goal:** Operator creates a short-lived per-table remote ordering session with a QR code. A customer scans the QR, opens a customer-only ordering page with no login, submits a request, and the cashier approves or rejects it — approved requests append lines to that table's open POS order.

**Architecture:** Server-owned sessions/requests live in dedicated SQLite tables (outside the synced `app_state` envelope, matching how printers/payment-QR are stored). Customer page is a public, guest route that reads/writes only through dedicated `/api/remote/*` endpoints. Staff manage sessions and approve/reject through authenticated `/api/remote/*` endpoints. The customer page runs inside the same SPA on the `/projects/light-pos` base, but is reached via a UUID token; it renders no shell/nav.

## Phases (ordered)

1. **Session QR** — create/list/close/revoke sessions; printable QR; per-tenant default TTL (admin-set, default 1 hour).
2. **Customer ordering** — guest page loads active menu + session, builds a cart, submits a request.
3. **Cashier approval** — pending queue; approve (append to open order) / reject (reason).

## Data model (new SQLite tables)

- `tenant_remote_settings (business_id PK, default_minutes, updated_by, updated_at)` — default `60`.
- `remote_sessions (id PK, business_id, table_id, table_name, status open|closed, created_by, created_by_name, created_at, expires_at)`.
- `remote_requests (id PK, session_id, business_id, table_id, table_name, status pending|approved|rejected, customer_note, lines JSON, created_at, resolved_by, resolved_by_name, resolved_at, reject_reason)`.

Serviced per-request by a truncated staff list (menu names alone are not enough to approve append), but customer only ever POSTs menu ids/qty/variations/notes; the server resolves authoritative names/prices from the live catalog at submit time and at approve time (revalidation).

## Endpoints

**Guest (no auth, rate-limited/scoped):**
- `GET  /api/remote/session?session=<id>` — active session truth (menu + table name + brand), or a single reject state.
- `POST /api/remote/order` — `{sessionId, lines:[{menuId, qty, variations?, note?}]}` → creates a `pending` request.

**Staff (auth + CSRF, capability `viewSeats`-adjacent but gate on `createOrder`):**
- `GET  /api/remote/sessions?business=` — sessions + requests for that tenant.
- `POST /api/remote/sessions` — create `{tableId, minutes?}`, defaults to tenant default, returns session + URL.
- `POST /api/remote/sessions/:id/close` — close.
- `POST /api/remote/requests/:id/approve` — revalidate prices/availability, append to or create the table's open `Held` order.
- `POST /api/remote/requests/:id/reject` — `{reason}`.

**Settings:**
- `GET/PUT /api/remote/settings?business=` — `{defaultMinutes}` (admin).

## Frontend

- `src/services/remote.ts` — typed API client.
- `src/pages/CustomerOrderPage.tsx` — guest menu + cart + submit + waiting state. Requires no auth, no shell.
- `src/pages/RemoteOrdersPage.tsx` — staff: create/close sessions, printable QR, pending queue, approve/reject.
- `src/App.tsx` — add `/remote/:sessionId` (outside `AppShell`) and `/admin/remote-orders` / `/remote-orders` routes.
- `AppShell.tsx` — nav `Remote orders` under Service (cashier/admin/manager).
- `AdminPages.tsx` — tenant settings default-TTL control.
- `styles.css` — customer page + staff queue styles.

## Tests
- Backend (`app.node.test.mjs`): guest session read, order submit, duplicate-session rejection, approve creates/updates open order, reject requires reason, expiry, auth/CSRF.
- Frontend (`App.test.tsx` fetch mock + new `remote` page tests): customer submit + waiting, staff approve/reject.

## Verification
`npm run typecheck`, `npm run lint`, `npm test`, `npm run test:backend`, `npm run build`, restart `light-pos.service`, rsync dist → `/usr/share/nginx/html/projects/light-pos/`, public E2E at `https://dev-light-pos.ahsanworks.com/`.

## Risks / open questions
- Approval revalidation rejects lines whose item went `sold-out` after submit; staff sees which lines were dropped.
- Stock is **not** reserved at submit; validated at approve (default chosen earlier).