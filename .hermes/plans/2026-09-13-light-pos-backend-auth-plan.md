# Light POS Backend and Authentication Implementation Plan

**Goal:** Replace browser-owned demo state and role switching with a project-local SQLite backend, authenticated users, server-issued sessions, server-derived roles, and persisted API-backed workflows for every currently implemented screen.

**Architecture:** Keep the existing React UI and domain types. Add one dependency-free Node 22 service using `node:http`, `node:crypto`, and native `node:sqlite`; persist the current aggregate state in SQLite with transactional optimistic revisions, plus normalized users/sessions. The server is the authority for identity, role, business scope, reads, and writes. Keep theme and explicit demo rendering controls client-local; remove role/reset-demo controls from authenticated production chrome.

**Security boundary:** Passwords use salted `scrypt`; sessions use opaque random tokens in HttpOnly/SameSite cookies; login is rate-limited; authorization is deny-by-default on the server. A user cannot change role through payload, URL, or localStorage. API mutations validate payload shape/size, enforce role capabilities and business scope, and use CSRF protection for cookie-authenticated writes.

## Ordered gates

1. **Backend foundation and persistence**
   - Add SQLite schema/bootstrap and seed the current mock dataset only into an empty database.
   - Add health, state-read, and transactional state-mutation API routes with validation, revision conflict handling, audit actor metadata, and role/capability enforcement.
   - Add focused backend tests for bootstrap, persistence after reopen, invalid payloads, conflicting revisions, forbidden role/action/business access, and audit writes.
   - Gate: focused backend tests pass before UI auth work starts.

2. **Authentication and server-derived role UI**
   - Add seeded development accounts for cashier, manager, admin, kitchen, and display, configurable through environment variables; never expose passwords in the client bundle.
   - Add login/session/logout endpoints and React session bootstrap/login page.
   - Remove header role selector and all `pos-role` role persistence/synchronization. Derive navigation, guards, and default route exclusively from `/api/session`.
   - Add logout and signed-in identity/role display. Prevent privileged deep links from changing role.
   - Gate: auth tests and focused UI role-selector/deep-link tests pass.

3. **Application integration**
   - Hydrate all existing `Data` from the API and route every current `update`, order completion, hold/resume, kitchen transition, catalog, table, coupon, expense, note, staff, SOP, experiment, and operations mutation through the backend.
   - Preserve cart editing locally until save/checkout; persist terminal workflow state server-side.
   - Provide loading/error/conflict recovery without silently overwriting server data. Keep `.env` and `sqlite.db` at project root and ignored by git.
   - Gate: integration tests prove reload persistence and authorization for representative mutations in every role.

4. **Final verification and delivery**
   - Run backend tests, frontend tests, lint, typecheck, and production build from the final workspace.
   - Discover and configure the exact Light POS nginx/service deployment; back up/integrity-check the runtime DB before replacement.
   - Run authenticated public Playwright E2E as cashier, manager, admin, kitchen, and display: login/logout/session reload, role-specific navigation, forbidden deep links and APIs, persisted writes, role selector absence, responsive UI, and clean unexpected console/network errors.
   - Commit on the feature branch, push, deploy, and report public URL plus immutable commit.

## Scope ceiling

This implements backend support for the application as it exists now. It does not add roadmap-only payment-provider, offline-sync, hardware, multi-tenant provisioning, or accounting features. Add those only when their external contracts are specified.
